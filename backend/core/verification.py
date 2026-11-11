"""
verification.py — Cryptographic Linguistic Integrity & Character Diff Engine.

Provides mathematical verification that no words, characters, or diacritics
have been omitted, altered, or hallucinated between the source PDF and
the generated DOCX or project text data.
"""

from typing import List, Dict, Any, Tuple, Optional
import hashlib
import re
import unicodedata
import fitz
import docx

from .digital_extractor import DigitalPDFExtractor, RE_ARABIC_CHAR, RE_TASHKEEL


class IntegrityVerifier:
    """
    Verifies character-level equivalence and computes canonical hashes
    between source documents and target representations.
    """

    def __init__(self, ignore_kashida: bool = True, ignore_whitespace: bool = True, ignore_tashkeel: bool = False):
        self.ignore_kashida = ignore_kashida
        self.ignore_whitespace = ignore_whitespace
        self.ignore_tashkeel = ignore_tashkeel
        self.digital_extractor = DigitalPDFExtractor()

    def canonicalize_text(self, text: str) -> str:
        """
        Normalizes text into a canonical linguistic byte stream:
        1. Un-shapes presentation forms via NFKC.
        2. Normalizes non-breaking spaces and linebreaks.
        3. Optionally strips tatweel/kashida (purely stylistic).
        4. Optionally strips diacritics / tashkeel marks.
        5. Normalizes whitespace runs to a single space.
        """
        if not text:
            return ""

        # Step 1: NFKC presentation forms normalization
        norm = unicodedata.normalize("NFKC", text)
        norm = norm.replace("\xa0", " ")

        # Step 2: Strip stylistic kashida / tatweel if requested
        if self.ignore_kashida:
            norm = norm.replace("ـ", "")

        # Step 3: Strip tashkeel / diacritics if requested
        if self.ignore_tashkeel:
            norm = RE_TASHKEEL.sub("", norm)

        # Step 4: Strip zero-width control characters
        norm = re.sub(r"[\u200b-\u200f\ufeff]", "", norm)

        # Step 5: Whitespace normalization
        if self.ignore_whitespace:
            norm = re.sub(r"\s+", " ", norm).strip()

        return norm

    def compute_canonical_hash(self, text: str) -> str:
        """Computes SHA-256 fingerprint of the canonical text stream."""
        canonical = self.canonicalize_text(text)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def compute_merkle_root(leaf_hashes: List[str]) -> str:
        """
        Computes the cryptographic Merkle root hash of an ordered list of leaf hashes (e.g. per-page hashes).
        Guarantees mathematical tamper-evident verification of document structure and content.
        """
        leaves = [h for h in leaf_hashes if h]
        if not leaves:
            return hashlib.sha256(b"").hexdigest()

        current_level = leaves[:]
        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                h1 = current_level[i]
                h2 = current_level[i + 1] if i + 1 < len(current_level) else h1
                parent = hashlib.sha256((h1 + h2).encode("utf-8")).hexdigest()
                next_level.append(parent)
            current_level = next_level

        return current_level[0]

    def extract_pdf_canonical_text(self, pdf_path: str, page_indices: Optional[List[int]] = None) -> Tuple[str, List[str]]:
        """
        Extracts raw canonical text per-page and concatenated from source PDF.
        Normalizes presentation forms, visual reversals, diacritics, and kashida.
        """
        doc = fitz.open(pdf_path)
        pages_text: List[str] = []
        indices = page_indices if page_indices is not None else list(range(len(doc)))

        for idx in indices:
            if 0 <= idx < len(doc):
                raw_text = doc[idx].get_text("text") or ""
                # Normalize line-by-line using digital extractor to resolve visual byte reversals
                clean_lines = []
                for line in raw_text.splitlines():
                    cl = self.digital_extractor.normalize_arabic_string(line).strip()
                    if cl:
                        clean_lines.append(cl)
                canon = self.canonicalize_text(" ".join(clean_lines))
                pages_text.append(canon)
            else:
                pages_text.append("")

        doc.close()
        full_text = " ".join(pages_text) if self.ignore_whitespace else "\n\n".join(pages_text)
        return self.canonicalize_text(full_text), pages_text

    def extract_docx_canonical_text(self, docx_path: str) -> str:
        """
        Extracts all paragraph and table text from a Word DOCX into a canonical stream.
        """
        doc = docx.Document(docx_path)
        collected_parts: List[str] = []

        # Paragraphs
        for p in doc.paragraphs:
            if p.text:
                collected_parts.append(p.text)

        # Tables
        for tbl in doc.tables:
            for row in tbl.rows:
                for cell in row.cells:
                    if cell.text:
                        collected_parts.append(cell.text)

        combined = " ".join(collected_parts) if self.ignore_whitespace else "\n".join(collected_parts)
        return self.canonicalize_text(combined)

    def extract_project_canonical_text(self, project: Dict[str, Any], page_indices: Optional[List[int]] = None) -> Tuple[str, List[str]]:
        """
        Extracts canonical text from project pages / OCR JSON data.
        """
        pages = project.get("pages", [])
        indices = page_indices if page_indices is not None else list(range(len(pages)))
        pages_text: List[str] = []

        for idx in indices:
            if 0 <= idx < len(pages):
                page = pages[idx]
                ocr_data = page.get("ocr_data", [])
                p_text_parts = [b.get("text", "") for b in ocr_data if b.get("text")]
                canon_p = self.canonicalize_text(" ".join(p_text_parts))
                pages_text.append(canon_p)
            else:
                pages_text.append("")

        full_text = " ".join(pages_text) if self.ignore_whitespace else "\n\n".join(pages_text)
        return self.canonicalize_text(full_text), pages_text

    def verify_integrity(
        self,
        source_text: str,
        target_text: str,
        source_pages: Optional[List[str]] = None,
        target_pages: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Performs character-level diff and hash audit between source and target texts.
        Computes cryptographic SHA-256 and Merkle root hashes for tamper-evident verification.
        """
        s_canon = self.canonicalize_text(source_text)
        t_canon = self.canonicalize_text(target_text)

        s_hash = hashlib.sha256(s_canon.encode("utf-8")).hexdigest()
        t_hash = hashlib.sha256(t_canon.encode("utf-8")).hexdigest()

        # Compute Merkle root hashes
        if source_pages:
            s_leaf_hashes = [self.compute_canonical_hash(p) for p in source_pages]
            s_merkle = self.compute_merkle_root(s_leaf_hashes)
        else:
            s_merkle = s_hash

        if target_pages:
            t_leaf_hashes = [self.compute_canonical_hash(p) for p in target_pages]
            t_merkle = self.compute_merkle_root(t_leaf_hashes)
        else:
            t_merkle = t_hash

        options = {
            "ignore_kashida": self.ignore_kashida,
            "ignore_whitespace": self.ignore_whitespace,
            "ignore_tashkeel": self.ignore_tashkeel,
        }

        if s_hash == t_hash:
            return {
                "ok": True,
                "is_verbatim_match": True,
                "match_percentage": 100.0,
                "source_hash": s_hash,
                "target_hash": t_hash,
                "source_merkle_root": s_merkle,
                "target_merkle_root": t_merkle,
                "merkle_match": (s_merkle == t_merkle),
                "source_char_count": len(s_canon),
                "target_char_count": len(t_canon),
                "discrepancies": [],
                "options": options,
            }

        # Fine-grained diff using difflib
        import difflib
        matcher = difflib.SequenceMatcher(None, s_canon, t_canon)
        ratio = matcher.ratio()

        discrepancies: List[Dict[str, Any]] = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                continue
            discrepancies.append({
                "type": tag,
                "source_segment": s_canon[i1:i2],
                "target_segment": t_canon[j1:j2],
                "source_pos": [i1, i2],
                "target_pos": [j1, j2],
            })

        return {
            "ok": True,
            "is_verbatim_match": False,
            "match_percentage": round(ratio * 100.0, 2),
            "source_hash": s_hash,
            "target_hash": t_hash,
            "source_merkle_root": s_merkle,
            "target_merkle_root": t_merkle,
            "merkle_match": (s_merkle == t_merkle),
            "source_char_count": len(s_canon),
            "target_char_count": len(t_canon),
            "discrepancies": discrepancies[:50],  # cap to first 50 discrepancies
            "total_discrepancy_count": len(discrepancies),
            "options": options,
        }
