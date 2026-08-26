"""
PDFProcessor - handles PDF hashing and rasterization at 200 DPI.

Also provides helper extract_pdf_range for OCR chunking.
"""
import os
import hashlib
import fitz  # PyMuPDF


class PDFProcessor:
    def __init__(self):
        pass

    def get_pdf_hash(self, pdf_path: str) -> str:
        return self.get_pdf_hashes(pdf_path)["sha256"]

    def get_pdf_hashes(self, pdf_path: str) -> dict:
        md5_h, sha1_h, sha256_h = hashlib.md5(), hashlib.sha1(), hashlib.sha256()
        with open(pdf_path, "rb") as f:
            for block in iter(lambda: f.read(65536), b""):
                md5_h.update(block)
                sha1_h.update(block)
                sha256_h.update(block)
        return {"md5": md5_h.hexdigest(), "sha1": sha1_h.hexdigest(), "sha256": sha256_h.hexdigest()}

    def process_pdf(self, pdf_path: str, output_dir: str, progress_callback=None):
        """
        Render each PDF page to JPG at ~200 DPI (zoom=2.0 over 72 DPI base),
        and pre-generate a lightweight ~160px thumbnail in thumbs/ directory.
        progress_callback(current_1based, total) called after each page.
        Returns list of page info dicts.
        """
        doc = fitz.open(pdf_path)
        pages_info = []
        total = len(doc)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        project_dir = os.path.dirname(output_dir)
        thumbs_dir = os.path.join(project_dir, "thumbs")
        os.makedirs(thumbs_dir, exist_ok=True)

        for page_index in range(total):
            page = doc.load_page(page_index)
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            image_filename = f"page_{page_index}.jpg"
            image_path = os.path.join(output_dir, image_filename)
            pix.save(image_path)

            # Generate dedicated ~160px thumbnail (~5-10 KB) for instant dashboard loading
            try:
                thumb_zoom = min(1.0, 160.0 / max(1.0, float(page.rect.width)))
                thumb_mat = fitz.Matrix(thumb_zoom, thumb_zoom)
                thumb_pix = page.get_pixmap(matrix=thumb_mat)
                thumb_path = os.path.join(thumbs_dir, image_filename)
                thumb_pix.save(thumb_path)
            except Exception as e:
                print(f"[PDFProcessor] Thumbnail generation error page {page_index}: {e}")

            pages_info.append(
                {
                    "pdf_index": page_index,
                    "image_path": image_filename,
                    "width": pix.width,
                    "height": pix.height,
                    "native_width": page.rect.width,
                    "native_height": page.rect.height,
                    "logical_index": None,
                    "status": "pending",
                    "ocr_data": [],
                }
            )

            if progress_callback:
                try:
                    progress_callback(page_index + 1, total)
                except Exception:
                    pass

        doc.close()
        return pages_info

    def ensure_page_rasterized(self, pdf_path: str, output_dir: str, page_index: int) -> str:
        """
        Ensure the master image and thumbnail for page_index exist on disk.
        Returns the absolute path to the master image.
        """
        image_filename = f"page_{page_index}.jpg"
        image_path = os.path.join(output_dir, image_filename)
        if os.path.exists(image_path):
            return image_path

        os.makedirs(output_dir, exist_ok=True)
        thumbs_dir = os.path.join(os.path.dirname(output_dir), "thumbs")
        os.makedirs(thumbs_dir, exist_ok=True)

        doc = fitz.open(pdf_path)
        if 0 <= page_index < len(doc):
            page = doc.load_page(page_index)
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)
            pix.save(image_path)

            try:
                thumb_zoom = min(1.0, 160.0 / max(1.0, float(page.rect.width)))
                thumb_pix = page.get_pixmap(matrix=fitz.Matrix(thumb_zoom, thumb_zoom))
                thumb_pix.save(os.path.join(thumbs_dir, image_filename))
            except Exception:
                pass
        doc.close()
        return image_path


def extract_pdf_range(src_path: str, start_idx: int, end_idx: int, out_path: str):
    """Extract inclusive pages [start_idx, end_idx] into new PDF."""
    doc = fitz.open(src_path)
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
    new_doc.save(out_path)
    new_doc.close()
    doc.close()
