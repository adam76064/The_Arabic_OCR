import re

class ArabicTextCleaner:
    def __init__(self, config):
        self.config = config

    def clean(self, text):
        if not text or not isinstance(text, str):
            return text

        # 1. Remove extra lines
        if self.config.get('clean_extra_lines'):
            text = re.sub(r'\n+', '\n', text)

        # 2. Normalize Hamzat (أ، آ، إ -> ا)
        if self.config.get('normalize_hamza'):
            text = re.sub(r'[أآإ]', 'ا', text)

        # 3. Move Tanween
        tanween_opt = self.config.get('tanween_option')
        if tanween_opt == 'before_alf':
            text = text.replace('اً', 'ًا')
        elif tanween_opt == 'on_alf':
            text = text.replace('ًا', 'اً')

        # 4. Tashkeel handling
        tashkeel_all = r'[\u064B-\u0652]'
        tashkeel_except_tanween_shadda = r'[\u064E\u064F\u0650\u0652]'
        if self.config.get('remove_all_tashkeel'):
            text = re.sub(tashkeel_all, '', text)
        elif self.config.get('remove_tashkeel_keep_tanween'):
            text = re.sub(tashkeel_except_tanween_shadda, '', text)

        # 5. Fix Punctuation
        if self.config.get('fix_punctuation'):
            # No space before !?.;:,،؛
            text = re.sub(r'\s+([!؟\?\.\؛؛,:،])', r'\1', text)
            
            # Dashes: " - word - " -> " -word- "
            text = re.sub(r'\s*-\s*(.*?)\s*-\s*', r' -\1- ', text)
            
            # Parentheses: " ( word ) " -> " (word) "
            text = re.sub(r'\(\s+', '(', text)
            text = re.sub(r'\s+\)', ')', text)

        # 6. Fix letter "Waw" (Remove space after word-initial Waw)
        if self.config.get('fix_waw'):
            text = re.sub(r'(^|\s)و\s+', r'\1و', text)

        # 7. Footnotes superscript: (1) -> <sup>(1)</sup>
        if self.config.get('superscript_footnotes'):
            text = re.sub(r'\((\d+)\)', r'<sup>(\1)</sup>', text)

        # 8. Remove double spaces
        if self.config.get('clean_double_spaces'):
            text = re.sub(r' +', ' ', text)

        return text.strip()
