import fitz  # PyMuPDF
import hashlib
import os

class PDFProcessor:
    def __init__(self):
        pass

    def get_pdf_hash(self, pdf_path):
        return self.get_pdf_hashes(pdf_path)['sha256']

    def get_pdf_hashes(self, pdf_path):
        md5_h, sha1_h, sha256_h = hashlib.md5(), hashlib.sha1(), hashlib.sha256()
        with open(pdf_path, "rb") as f:
            for block in iter(lambda: f.read(65536), b""):
                md5_h.update(block); sha1_h.update(block); sha256_h.update(block)
        return {'md5': md5_h.hexdigest(), 'sha1': sha1_h.hexdigest(), 'sha256': sha256_h.hexdigest()}

    def process_pdf(self, pdf_path, output_dir, progress_callback=None):
        """progress_callback(current_page_number, total_pages), called
        after each page finishes rendering - current_page_number is
        1-based, so callers can show e.g. "12 / 200" directly."""
        doc = fitz.open(pdf_path)
        pages_info = []
        total = len(doc)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        for page_index in range(total):
            page = doc.load_page(page_index)
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            image_filename = f"page_{page_index}.jpg"
            image_path = os.path.join(output_dir, image_filename)
            pix.save(image_path)

            pages_info.append({
                'pdf_index': page_index,
                'image_path': image_filename,
                'width': pix.width,
                'height': pix.height,
                'native_width': page.rect.width,
                'native_height': page.rect.height,
                'logical_index': None,
                'status': 'pending',
                'ocr_data': []
            })

            if progress_callback:
                try:
                    progress_callback(page_index + 1, total)
                except Exception:
                    pass  # never let a UI-progress hiccup abort the actual processing

        doc.close()
        return pages_info