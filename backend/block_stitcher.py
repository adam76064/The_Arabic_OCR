import os
import re
from PIL import Image, ImageDraw, ImageFont, ImageOps

class BlockStitcher:
    def __init__(self, separator="BLOCK BREAK"):
        self.separator = separator

    def create_stitched_image(self, image_path, ocr_data, output_path, base_dpi=200, target_dpi=300):
        if not output_path.lower().endswith('.pdf'):
            output_path = output_path.rsplit('.', 1)[0] + '.pdf'

        img = Image.open(image_path).convert("RGB")
        scale = target_dpi / base_dpi
        
        text_blocks = []
        for i, block in enumerate(ocr_data):
            if block.get("category") not in ["Picture"]:
                text_blocks.append((i, block))
                
        if not text_blocks:
            return None, []

        text_blocks.sort(key=lambda b: b[1]["bbox"][1])

        block_images = []
        mapping = [] 
        
        try:
            bold_font = ImageFont.truetype("arialbd.ttf", 34)
        except:
            bold_font = ImageFont.load_default()
        
        # حساب عرض النص لضمان عدم اقتصاصه
        dummy_draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        sep_text = f"==== {self.separator} ===="
        try:
            text_width = dummy_draw.textbbox((0, 0), sep_text, font=bold_font)[2]
        except:
            text_width = 350
            
        for original_idx, block in text_blocks:
            x1, y1, x2, y2 = [int(coord * scale) for coord in block["bbox"]]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(img.width, x2), min(img.height, y2)
            
            if x2 <= x1 or y2 <= y1:
                continue
                
            cropped = img.crop((x1, y1, x2, y2))
            padded = ImageOps.expand(cropped, border=50, fill="white")
            
            # توسيع الصفحة إذا كانت أضيق من الفاصل
            final_width = max(padded.width, text_width + 80)
            sep_height = 80
            
            final_page = Image.new("RGB", (final_width, padded.height + sep_height), color="white")
            
            # توسيط الصورة المقصوصة
            paste_x = (final_width - padded.width) // 2
            final_page.paste(padded, (paste_x, 0))
            
            # رسم الفاصل
            draw = ImageDraw.Draw(final_page)
            draw.text(((final_width - text_width) // 2, padded.height + 20), sep_text, fill="#1a1a1a", font=bold_font)
            
            block_images.append(final_page)
            mapping.append(original_idx)

        if not block_images:
            return None, []

        first_page = block_images[0]
        other_pages = block_images[1:]
        
        first_page.save(
            output_path, 
            "PDF", 
            resolution=target_dpi, 
            save_all=True, 
            append_images=other_pages
        )

        return output_path, mapping

    # def apply_stitched_text(self, raw_text, ocr_data, mapping):
    #     if not raw_text:
    #         return ocr_data

    #     raw_text = raw_text.replace('\x0c', '\n')
        
    #     # التقطيع بناءً على الفاصل الذي قرأه الـ OCR
    #     pattern = re.compile(r'(?i)=*\s*' + re.escape(self.separator).replace(r'\ ', r'\s+') + r'\s*=*\s*')
    #     parts = [p.strip() for p in pattern.split(raw_text)]
    #     parts = [p for p in parts if p]

    #     limit = min(len(parts), len(mapping))
    #     for i in range(limit):
    #         original_idx = mapping[i]
    #         ocr_data[original_idx]['text'] = parts[i]
            
    #     return ocr_data




    def apply_stitched_text(self, raw_text, ocr_data, mapping):
        if not raw_text:
            return ocr_data

        raw_text = raw_text.replace('\x0c', '\n')
        
        # 1. التقطيع الديناميكي الفعّال: 
        # نبحث عن الفاصل كاملاً، أو عن أي 3 علامات = متتالية فأكثر 
        # هذا سيلتهم علامات ===== ويجعلها تعمل كمقص حتى لو سقطت الكلمة الإنجليزية
        pattern = re.compile(r'(?i)=*\s*' + re.escape(self.separator).replace(r'\ ', r'\s+') + r'\s*=*\s*|={3,}')
        parts = [p.strip() for p in pattern.split(raw_text)]
        parts = [p for p in parts if p]

        limit = min(len(parts), len(mapping))
        for i in range(limit):
            original_idx = mapping[i]
            
            # 2. طبقة أمان نهائية: إزالة أي علامات = متبقية بالخطأ في بداية أو نهاية النص
            clean_text = re.sub(r'^=+\s*|\s*=+$', '', parts[i]).strip()
            
            ocr_data[original_idx]['text'] = clean_text
            
        return ocr_data