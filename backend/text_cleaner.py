import re

HINDU_TO_ARABIC_TRANS = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
ARABIC_TO_HINDU_TRANS = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')

class ArabicTextCleaner:
    def __init__(self, config):
        # Fallback to empty dict if config is None
        self.config = config if config else {}

    def clean(self, text):
        if not text or not isinstance(text, str):
            return text

        # 0. Remove Kasheeda (التطويل)
        if self.config.get('remove_kasheeda'):
            text = text.replace('ـ', '')

        # 1. Remove extra lines
        if self.config.get('clean_extra_lines'):
            text = re.sub(r'\n+', '\n', text)

        # 2. Normalize Hamzat (أ، آ، إ -> ا)
        if self.config.get('normalize_hamza'):
            text = re.sub(r'[أآإ]', 'ا', text)

        # 3. Numbers Conversion (Arabic 123 vs Hindu ١٢٣ vs None)
        numbers_opt = self.config.get('numbers_option')
        if numbers_opt == 'to_arabic':
            text = text.translate(HINDU_TO_ARABIC_TRANS)
        elif numbers_opt == 'to_hindu':
            text = text.translate(ARABIC_TO_HINDU_TRANS)

        # 4. Move Tanween
        tanween_opt = self.config.get('tanween_option')
        if tanween_opt == 'before_alf':
            text = text.replace('اً', 'ًا')
        elif tanween_opt == 'on_alf':
            text = text.replace('ًا', 'اً')

        # 5. Tashkeel handling
        tashkeel_all = r'[\u064B-\u0652]'
        tashkeel_except_tanween_shadda = r'[\u064E\u064F\u0650\u0652]'
        if self.config.get('remove_all_tashkeel'):
            text = re.sub(tashkeel_all, '', text)
        elif self.config.get('remove_tashkeel_keep_tanween'):
            text = re.sub(tashkeel_except_tanween_shadda, '', text)

        # 6. Fix Punctuation
        if self.config.get('fix_punctuation'):
            # No space before standard trailing punctuation
            text = re.sub(r'\s+([!؟\?\.\؛؛,:،])', r'\1', text)
            
            # Directional Openers (Parentheses, Brackets, Guillemets): remove space AFTER them
            text = re.sub(r'([\(\[«])\s+', r'\1', text)
            # Directional Closers: remove space BEFORE them
            text = re.sub(r'\s+([\)\]»])', r'\1', text)
            
            # Symmetrical Quotes (Straight double and single): " word " -> "word"
            text = re.sub(r'"\s*(.*?)\s*"', r'"\1"', text)
            text = re.sub(r"'\s*(.*?)\s*'", r"'\1'", text)
            
            # Dashes (Single or Double used as parentheticals): " - word - " or " -- word -- "
            text = re.sub(r'\s*(--?)\s*(.*?)\s*(--?)\s*', r' \1\2\3 ', text)

        # 7. Fix letter "Waw" (Remove space after word-initial Waw)
        if self.config.get('fix_waw'):
            text = re.sub(r'(^|\s)و\s+', r'\1و', text)

        # 8. Footnotes superscript: (1) or (١) -> <sup>(1)</sup>
        if self.config.get('superscript_footnotes'):
            text = re.sub(r'\(([\d\u0660-\u0669]+)\)', r'<sup>(\1)</sup>', text)

        # 9. Remove double spaces
        if self.config.get('clean_double_spaces'):
            text = re.sub(r' +', ' ', text)

        return text.strip()