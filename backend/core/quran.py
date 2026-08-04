"""
QuranHandler - fuzzy verse search & verification.
Cleaned version, same algorithm, better structure.
"""
import os
import json
import re
import difflib


def get_resource_path(relative_path):
    import sys
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), relative_path)


class QuranHandler:
    def __init__(self, json_path=None):
        if json_path is None:
            json_path = get_resource_path(os.path.join("data", "Quran.json"))
        self.json_path = json_path
        self.data = []
        self.surahs = []
        self.search_corpus = []
        self._load_data()

    def _load_data(self):
        if not os.path.exists(self.json_path):
            print(f"[Quran] Quran.json not found at {self.json_path}")
            return
        with open(self.json_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        self.data = list(raw_data.values())

        seen = set()
        for ayah in self.data:
            s_id = ayah["surah"]["id"]
            if s_id not in seen:
                self.surahs.append(
                    {
                        "id": s_id,
                        "name_arabic": ayah["surah"]["name_arabic"],
                        "verses_count": ayah["surah"]["verses_count"],
                    }
                )
                seen.add(s_id)

            norm_text = self._normalize_text(ayah["text"])
            self.search_corpus.append(
                {
                    "id": ayah["id"],
                    "ayah": ayah,
                    "norm_words": set(norm_text.split()),
                    "surah_number": ayah["surah_number"],
                    "ayah_number": ayah["ayah_number"],
                }
            )

    def _normalize_text(self, text):
        if not text:
            return ""
        tashkeel = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]")
        text = re.sub(tashkeel, "", text)
        text = re.sub(r"[أإآٱ]", "ا", text)
        text = re.sub(r"[ىئ]", "ي", text)
        text = re.sub(r"ة", "ه", text)
        text = re.sub(r"ؤ", "و", text)
        text = re.sub(r"[^\u0621-\u064A\s]", "", text)
        return re.sub(r"\s+", " ", text).strip()

    def _to_arabic_number(self, num):
        arabic_numbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]
        return "".join(arabic_numbers[int(d)] for d in str(num))

    def get_surahs(self):
        return self.surahs

    def search_text(self, query):
        clean_query = self._normalize_text(query)
        if not clean_query:
            return []

        query_words = clean_query.split()
        length = len(query_words)
        scores = {}

        # 1. Exact substring
        for entry in self.search_corpus:
            clean_text = self._normalize_text(entry["ayah"]["text"])
            if clean_query in clean_text:
                scores[entry["id"]] = scores.get(entry["id"], 0) + 1000

        # 2. Sliding window >=3 words
        if length >= 3:
            chunk_size = min(4, length)
            default_threshold = chunk_size - 1
            for i in range(length - chunk_size + 1):
                chunk = query_words[i : i + chunk_size]
                for entry in self.search_corpus:
                    matches = sum(1 for w in chunk if w in entry["norm_words"])
                    ayah_unique = len(entry["norm_words"])
                    required = default_threshold if ayah_unique >= 3 else ayah_unique
                    if matches >= required and matches > 0:
                        points = 10 if matches >= chunk_size else 5
                        scores[entry["id"]] = scores.get(entry["id"], 0) + points
        else:
            # short query fuzzy
            for entry in self.search_corpus:
                clean_text = self._normalize_text(entry["ayah"]["text"])
                if difflib.SequenceMatcher(None, clean_query, clean_text).ratio() > 0.75:
                    scores[entry["id"]] = scores.get(entry["id"], 0) + 200
                else:
                    for w in entry["norm_words"]:
                        if difflib.SequenceMatcher(None, clean_query, w).ratio() > 0.8:
                            scores[entry["id"]] = scores.get(entry["id"], 0) + 50
                            break

        if not scores:
            return []

        top_entries = sorted(
            [entry for entry in self.search_corpus if entry["id"] in scores],
            key=lambda x: scores[x["id"]],
            reverse=True,
        )[:30]

        top_entries.sort(key=lambda x: x["id"])
        results = [entry["ayah"] for entry in top_entries]

        # 4. Gap fill
        if len(results) > 1 and length >= 2:
            filled_results = []
            for i in range(len(results) - 1):
                filled_results.append(results[i])
                curr_ayah = results[i]
                next_ayah = results[i + 1]
                if curr_ayah["surah_number"] == next_ayah["surah_number"]:
                    gap = next_ayah["ayah_number"] - curr_ayah["ayah_number"]
                    if 1 < gap <= 5:
                        for missing_num in range(curr_ayah["ayah_number"] + 1, next_ayah["ayah_number"]):
                            missing_ayah = next(
                                (
                                    a["ayah"]
                                    for a in self.search_corpus
                                    if a["surah_number"] == curr_ayah["surah_number"]
                                    and a["ayah_number"] == missing_num
                                ),
                                None,
                            )
                            if missing_ayah and missing_ayah not in filled_results:
                                filled_results.append(missing_ayah)
                                scores[missing_ayah["id"]] = scores.get(curr_ayah["id"], 0)
            if results[-1] not in filled_results:
                filled_results.append(results[-1])
            results = filled_results

        if not results:
            return []

        blocks = []
        current_block = [results[0]]
        for i in range(1, len(results)):
            curr = results[i]
            prev = results[i - 1]
            if curr["surah_number"] == prev["surah_number"] and curr["ayah_number"] == prev["ayah_number"] + 1:
                current_block.append(curr)
            else:
                blocks.append(current_block)
                current_block = [curr]
        blocks.append(current_block)

        blocks.sort(key=lambda block: max(scores.get(ayah["id"], 0) for ayah in block), reverse=True)

        final_results = []
        for block in blocks:
            final_results.extend(block)

        return final_results[:50]

    def get_range(self, surah_id, from_ayah, to_ayah):
        results = []
        s_id = int(surah_id)
        f_ayah = int(from_ayah)
        t_ayah = int(to_ayah)
        for ayah in self.data:
            if ayah["surah_number"] == s_id and f_ayah <= ayah["ayah_number"] <= t_ayah:
                results.append(ayah)
        return results

    def format_insertion(self, ayah_ids, with_citation=True):
        if not ayah_ids:
            return ""
        ayahs = [a for a in self.data if a["id"] in ayah_ids]
        ayahs = sorted(ayahs, key=lambda x: x["id"])
        if not ayahs:
            return ""
        formatted_text = ""
        for ayah in ayahs:
            num = self._to_arabic_number(ayah["ayah_number"])
            formatted_text += f"{ayah['text']} ۝{num} "
        formatted_text = f"﴿ {formatted_text.strip()} ﴾"

        if with_citation:
            surah_name = ayahs[0]["surah"]["name_arabic"]
            start_num = ayahs[0]["ayah_number"]
            end_num = ayahs[-1]["ayah_number"]
            if start_num == end_num:
                citation = f"[{surah_name} :{start_num}]"
            else:
                citation = f"[{surah_name} {start_num}-{end_num}]"
            formatted_text += f" {citation}"
        return formatted_text
