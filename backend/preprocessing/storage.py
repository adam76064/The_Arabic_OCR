"""
storage.py — Storage manager for original and preprocessed images, project updates, and page splitting.
"""
from typing import Any, Dict, List, Optional, Tuple
import os
import shutil
import cv2
import numpy as np

from .stages.base import image_to_numpy


STAGE_FLAG_MAP = {
    "orientation": ["is_orientation", "is_oriented"],
    "split": ["is_split", "is_splitted"],
    "deskew": ["is_deskew", "is_deskewed"],
    "content": ["is_content", "is_cropped", "is_content_selected"],
    "layout": ["is_layout", "is_layout_applied", "has_margins"],
    "output": ["is_output", "is_binarized"],
}


class PreprocessingStorage:
    """
    Manages image files and project.json synchronization for pre-processing workflows.
    """

    def __init__(self, project_manager):
        self.project_manager = project_manager

    def get_project_dir(self, project_id: str) -> str:
        return os.path.join(self.project_manager.projects_dir, project_id)

    def _get_page(self, project_id: str, page_index: int, project: Optional[Dict] = None) -> Tuple[Dict, str]:
        """Internal: return (page_dict, project_dir) using a cached project if available."""
        if project is None:
            project = self.project_manager.load_project(project_id)
        pages = project.get("pages", [])
        if page_index < 0 or page_index >= len(pages):
            raise IndexError(f"Page index {page_index} out of range")
        return pages[page_index], self.get_project_dir(project_id)

    def ensure_original_backup(self, project_id: str, page_index: int, project: Optional[Dict] = None) -> str:
        """
        Ensure the original unedited scan of a page is backed up in 'raw_images/' directory.
        Returns the path to the pristine original image.
        """
        page, p_dir = self._get_page(project_id, page_index, project)
        images_dir = os.path.join(p_dir, "images")
        raw_images_dir = os.path.join(p_dir, "raw_images")
        os.makedirs(raw_images_dir, exist_ok=True)

        img_name = os.path.basename(page.get("image_path", f"page_{page_index}.jpg"))
        active_img_path = os.path.join(images_dir, img_name)
        raw_img_path = os.path.join(raw_images_dir, img_name)

        if not os.path.exists(raw_img_path) and os.path.exists(active_img_path):
            shutil.copy2(active_img_path, raw_img_path)

        return raw_img_path if os.path.exists(raw_img_path) else active_img_path

    def get_original_image(self, project_id: str, page_index: int, project: Optional[Dict] = None) -> np.ndarray:
        """
        Load the pristine original image as a NumPy array.
        """
        raw_path = self.ensure_original_backup(project_id, page_index, project=project)
        return image_to_numpy(raw_path)

    def get_active_image(self, project_id: str, page_index: int, project: Optional[Dict] = None) -> np.ndarray:
        """
        Load the currently active image for a page.
        """
        page, p_dir = self._get_page(project_id, page_index, project)
        img_name = os.path.basename(page.get("image_path", f"page_{page_index}.jpg"))
        active_path = os.path.join(p_dir, "images", img_name)
        return image_to_numpy(active_path)

    def save_preprocessed_page(
        self,
        project_id: str,
        page_index: int,
        processed_img: np.ndarray,
        params: Optional[Dict[str, Any]] = None,
        stage_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Save the preprocessed image into the project's 'images/' directory and update page metadata.
        Loads project once and reuses across backup + metadata update.
        """
        # Load project once for this entire operation
        project = self.project_manager.load_project(project_id)

        self.ensure_original_backup(project_id, page_index, project=project)

        p_dir = self.get_project_dir(project_id)
        images_dir = os.path.join(p_dir, "images")
        os.makedirs(images_dir, exist_ok=True)

        page = project.get("pages", [])[page_index]

        img_name = os.path.basename(page.get("image_path", f"page_{page_index}.jpg"))
        target_path = os.path.join(images_dir, img_name)

        # Write image safely
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 92]
        success, encimg = cv2.imencode(".jpg", processed_img, encode_param)
        if not success:
            raise ValueError(f"Failed to encode preprocessed image for page {page_index}")

        tmp_path = target_path + ".tmp"
        with open(tmp_path, "wb") as f:
            f.write(encimg.tobytes())
        if os.path.exists(target_path):
            try:
                os.remove(target_path)
            except Exception:
                pass
        os.replace(tmp_path, target_path)

        # Update thumbnail in thumbs/ directory
        try:
            thumbs_dir = os.path.join(p_dir, "thumbs")
            os.makedirs(thumbs_dir, exist_ok=True)
            thumb_path = os.path.join(thumbs_dir, img_name)
            thumb_scale = 160.0 / max(w, h) if max(w, h) > 160 else 1.0
            thumb_w = max(1, int(round(w * thumb_scale)))
            thumb_h = max(1, int(round(h * thumb_scale)))
            thumb_img = cv2.resize(processed_img, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
            _, enc_thumb = cv2.imencode(".jpg", thumb_img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            with open(thumb_path, "wb") as f:
                f.write(enc_thumb.tobytes())
        except Exception as e:
            print(f"[Storage] Preprocessed thumb error: {e}")

        # Update page dimensions
        h, w = processed_img.shape[:2]
        page["width"] = int(w)
        page["height"] = int(h)
        # 72 DPI native approximation for 200 DPI render
        page["native_width"] = float(round((w / 200.0) * 72.0, 1))
        page["native_height"] = float(round((h / 200.0) * 72.0, 1))
        page["is_preprocessed"] = True
        
        if params:
            existing_params = page.get("preprocessing_params", {})
            if isinstance(existing_params, dict):
                page["preprocessing_params"] = {**existing_params, **params}
            else:
                page["preprocessing_params"] = params

        stages_applied = set(page.get("preprocessing_stages_applied", []))
        if stage_name:
            stages_applied.add(stage_name)
            for flag in STAGE_FLAG_MAP.get(stage_name, [f"is_{stage_name}"]):
                page[flag] = True
        elif params:
            for s in STAGE_FLAG_MAP:
                if s in params:
                    stages_applied.add(s)
                    for flag in STAGE_FLAG_MAP[s]:
                        page[flag] = True

        if stages_applied:
            page["preprocessing_stages_applied"] = sorted(list(stages_applied))

        self.project_manager.update_project(project_id, project)
        return page

    def reset_page_to_original(self, project_id: str, page_index: int) -> Dict[str, Any]:
        """
        Revert a page back to its original scan from raw_images.
        """
        p_dir = self.get_project_dir(project_id)
        project = self.project_manager.load_project(project_id)
        pages = project.get("pages", [])
        page = pages[page_index]

        img_name = os.path.basename(page.get("image_path", f"page_{page_index}.jpg"))
        raw_path = os.path.join(p_dir, "raw_images", img_name)
        active_path = os.path.join(p_dir, "images", img_name)

        if os.path.exists(raw_path):
            shutil.copy2(raw_path, active_path)
            orig_img = image_to_numpy(active_path)
            h, w = orig_img.shape[:2]
            page["width"] = int(w)
            page["height"] = int(h)
            page["native_width"] = float(round((w / 200.0) * 72.0, 1))
            page["native_height"] = float(round((h / 200.0) * 72.0, 1))
            page["is_preprocessed"] = False
            page.pop("preprocessing_params", None)
            page.pop("preprocessing_stages_applied", None)
            for s, flags in STAGE_FLAG_MAP.items():
                for flag in flags:
                    page.pop(flag, None)
            self.project_manager.update_project(project_id, project)

            # Update thumbnail to reverted image
            try:
                thumbs_dir = os.path.join(p_dir, "thumbs")
                os.makedirs(thumbs_dir, exist_ok=True)
                thumb_scale = 160.0 / max(w, h) if max(w, h) > 160 else 1.0
                thumb_img = cv2.resize(orig_img, (max(1, int(round(w * thumb_scale))), max(1, int(round(h * thumb_scale)))), interpolation=cv2.INTER_AREA)
                _, enc_thumb = cv2.imencode(".jpg", thumb_img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                with open(os.path.join(thumbs_dir, img_name), "wb") as f:
                    f.write(enc_thumb.tobytes())
            except Exception as e:
                print(f"[Storage] Reset thumb error: {e}")

        return page

    def split_project_spread_page(
        self,
        project_id: str,
        page_index: int,
        sub_images: List[np.ndarray],
    ) -> Dict[str, Any]:
        """
        Split a spread page into two discrete pages in project.json.
        Loads project once and reuses for backup + metadata update.
        """
        # Load project once for this entire operation
        project = self.project_manager.load_project(project_id)
        self.ensure_original_backup(project_id, page_index, project=project)

        p_dir = self.get_project_dir(project_id)
        images_dir = os.path.join(p_dir, "images")
        thumbs_dir = os.path.join(p_dir, "thumbs")
        os.makedirs(thumbs_dir, exist_ok=True)

        pages = project.get("pages", [])
        orig_page = pages.pop(page_index)

        base_id = orig_page.get("pdf_index", page_index)
        new_pages = []

        for i, sub_img in enumerate(sub_images):
            sub_name = f"page_{base_id}_sub_{i+1}.jpg"
            sub_path = os.path.join(images_dir, sub_name)

            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 92]
            _, encimg = cv2.imencode(".jpg", sub_img, encode_param)
            with open(sub_path, "wb") as f:
                f.write(encimg.tobytes())

            sh, sw = sub_img.shape[:2]

            # Generate thumbnail for the sub-page
            try:
                thumb_path = os.path.join(thumbs_dir, sub_name)
                thumb_scale = 160.0 / max(sw, sh) if max(sw, sh) > 160 else 1.0
                thumb_img = cv2.resize(sub_img, (max(1, int(round(sw * thumb_scale))), max(1, int(round(sh * thumb_scale)))), interpolation=cv2.INTER_AREA)
                _, enc_thumb = cv2.imencode(".jpg", thumb_img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                with open(thumb_path, "wb") as f:
                    f.write(enc_thumb.tobytes())
            except Exception as e:
                print(f"[Storage] Sub-page thumb error: {e}")

            new_page = {
                "pdf_index": orig_page.get("pdf_index", page_index),
                "sub_index": i + 1,
                "image_path": sub_name,
                "width": int(sw),
                "height": int(sh),
                "native_width": float(round((sw / 200.0) * 72.0, 1)),
                "native_height": float(round((sh / 200.0) * 72.0, 1)),
                "logical_index": None,
                "status": "pending",
                "ocr_data": [],
                "is_preprocessed": True,
            }
            new_pages.append(new_page)

        # Insert new pages at page_index
        for offset, np_entry in enumerate(new_pages):
            pages.insert(page_index + offset, np_entry)

        project["pages"] = pages
        self.project_manager.update_project(project_id, project)
        return project
