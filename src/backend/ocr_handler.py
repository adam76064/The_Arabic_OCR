import json
from .text_cleaner import ArabicTextCleaner

class OCRHandler:
    def __init__(self):
        # Supported categories as per prompt
        self.categories = [
            'Caption', 'Footnote', 'Formula', 'List-item', 
            'Page-footer', 'Page-header', 'Picture', 
            'Section-header', 'Table', 'Text', 'Title'
        ]

    def parse_dots_ocr(self, ocr_json_str, text_config=None):
        """
        Parses DOTS.OCR JSON and returns a list of layout elements.
        Handles both {"elements": [...]} and a direct list [...]
        """
        try:
            data = json.loads(ocr_json_str)
            
            if isinstance(data, dict):
                elements = data.get('elements', [])
            elif isinstance(data, list):
                elements = data
            else:
                elements = []

            if text_config:
                cleaner = ArabicTextCleaner(text_config)
                for el in elements:
                    if 'text' in el and el.get('category') != 'Picture':
                        el['text'] = cleaner.clean(el['text'])
                
            print(f"Successfully parsed {len(elements)} OCR elements.") # Helpful terminal log
            return elements
            
        except Exception as e:
            print(f"Error parsing OCR JSON: {e}")
            return []

    def merge_ocr_to_pages(self, project_data, ocr_data, page_range=None):
        """
        Merges OCR data into the project's pages.
        ocr_data is expected to be a list of results for each page or a single result.
        """
        # Logic to append ocr_data to specific pages
        # If ocr_data is a dict (one page), it might map to a specific pdf_index
        # If ocr_data is a list, we assume it aligns with page_range
        pass
