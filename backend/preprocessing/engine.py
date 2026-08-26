"""
engine.py — Main Preprocessing Pipeline Engine (ScanTailor Advanced Orchestration).
Executes individual stages or full composite pipelines with state management.
"""
from typing import Any, Dict, List, Optional, Tuple, Union
import cv2
import numpy as np

from .stages.base import BaseStage, numpy_to_base64_jpeg
from .stages.orientation import OrientationStage
from .stages.split import PageSplitStage
from .stages.deskew import DeskewStage
from .stages.content import ContentSelectionStage
from .stages.layout import PageLayoutStage
from .stages.output import OutputStage
from .storage import PreprocessingStorage

ALL_STAGES = ["orientation", "split", "deskew", "content", "layout", "output"]


class PreprocessingEngine:
    """
    Core Pipeline Engine for ScanTailor Advanced.
    Coordinates the 6 sequential stages and communicates with disk storage.
    """

    def __init__(self, project_manager):
        self.storage = PreprocessingStorage(project_manager)
        self.stages: Dict[str, BaseStage] = {
            "orientation": OrientationStage(),
            "split": PageSplitStage(),
            "deskew": DeskewStage(),
            "content": ContentSelectionStage(),
            "layout": PageLayoutStage(),
            "output": OutputStage(),
        }
        self._max_content_size_cache: Dict[str, Dict[str, int]] = {}

    def get_stage_defaults(self) -> Dict[str, Any]:
        """Return default parameters for all 6 stages."""
        return {name: stage.get_default_params() for name, stage in self.stages.items()}

    def get_project_max_content_size(
        self,
        project_id: str,
        page_indices: Optional[List[int]] = None,
        dpi: int = 300,
        force_refresh: bool = False,
    ) -> Dict[str, int]:
        """
        Calculate the maximum content bounding box (width & height) across the project.
        Uses cached / fast metadata estimates to avoid heavy disk image scans.
        """
        if not force_refresh and page_indices is None and project_id in self._max_content_size_cache:
            return self._max_content_size_cache[project_id]

        project = self.storage.project_manager.load_project(project_id)
        if not project or "pages" not in project:
            return {"max_width": 1000, "max_height": 1400}

        pages = project["pages"]
        indices = page_indices if page_indices is not None else list(range(len(pages)))

        max_cw = 0
        max_ch = 0

        for i in indices:
            if i < 0 or i >= len(pages):
                continue
            pg = pages[i]
            saved_params = pg.get("preprocessing_params", {})
            c_rect = saved_params.get("content_rect")
            if c_rect and isinstance(c_rect, dict) and c_rect.get("width", 0) > 20:
                cw = int(c_rect["width"])
                ch = int(c_rect["height"])
            else:
                # Fast estimate using page dimensions without reading image from disk
                cw = int(pg.get("width", 1000) * 0.88)
                ch = int(pg.get("height", 1400) * 0.88)

            max_cw = max(max_cw, cw)
            max_ch = max(max_ch, ch)

        max_cw = max(100, max_cw)
        max_ch = max(100, max_ch)

        result = {"max_width": max_cw, "max_height": max_ch}
        if page_indices is None:
            self._max_content_size_cache[project_id] = result
        return result

    def preview_stage(
        self,
        project_id: str,
        page_index: int,
        target_stage: str,
        stages_params: Optional[Dict[str, Any]] = None,
        from_original: bool = True,
        dpi: int = 300,
    ) -> Dict[str, Any]:
        """
        Execute pipeline up to target_stage and return downscaled base64 image + stage metadata for live UI preview.
        Loads project.json once and passes it through to storage to avoid repeated disk reads.
        """
        stages_params = stages_params or {}
        if target_stage not in self.stages:
            raise ValueError(f"Invalid stage name: {target_stage}")

        # Load project once for this entire preview operation
        project = self.storage.project_manager.load_project(project_id)
        stage_metadata: Dict[str, Any] = {}

        if from_original:
            curr_img = self.storage.get_original_image(project_id, page_index, project=project)
            target_idx = ALL_STAGES.index(target_stage)
            stages_to_run = ALL_STAGES[: target_idx + 1]

            unprocessed_img = None
            for s_name in stages_to_run:
                stage_processor = self.stages[s_name]
                p = stages_params.get(s_name, {})

                if s_name == "output":
                    unprocessed_img = curr_img.copy()

                if s_name == "split":
                    res = stage_processor.process(curr_img, params={**p, "apply_split": False}, dpi=dpi)
                elif s_name == "content":
                    should_crop = (target_stage in ["layout", "output"])
                    res = stage_processor.process(curr_img, params={**p, "apply_crop": should_crop}, dpi=dpi)
                elif s_name == "layout":
                    content_rect = stage_metadata.get("content", {}).get("content_rect") or p.get("content_rect")
                    max_size = self.get_project_max_content_size(project_id, dpi=dpi)
                    res = stage_processor.process(
                        curr_img,
                        params={
                            **p,
                            "content_rect": content_rect,
                            "max_content_width": max_size["max_width"],
                            "max_content_height": max_size["max_height"],
                            "apply_layout": True,
                        },
                        dpi=dpi,
                    )
                else:
                    res = stage_processor.process(curr_img, params=p, dpi=dpi)

                curr_img = res["image"]
                stage_metadata[s_name] = res.get("metadata", {})
        else:
            curr_img = self.storage.get_active_image(project_id, page_index, project=project)
            stage_processor = self.stages[target_stage]
            p = stages_params.get(target_stage, {})

            unprocessed_img = curr_img.copy() if target_stage == "output" else None

            if target_stage == "split":
                res = stage_processor.process(curr_img, params={**p, "apply_split": False}, dpi=dpi)
            elif target_stage == "content":
                res = stage_processor.process(curr_img, params=p, dpi=dpi)
            elif target_stage == "layout":
                max_size = self.get_project_max_content_size(project_id, dpi=dpi)
                res = stage_processor.process(
                    curr_img,
                    params={
                        **p,
                        "max_content_width": max_size["max_width"],
                        "max_content_height": max_size["max_height"],
                        "apply_layout": True,
                    },
                    dpi=dpi,
                )
            else:
                res = stage_processor.process(curr_img, params=p, dpi=dpi)

            curr_img = res["image"]
            stage_metadata[target_stage] = res.get("metadata", {})



        preview_h, preview_w = curr_img.shape[:2]
        max_preview_dim = 1000
        if max(preview_h, preview_w) > max_preview_dim:
            scale = max_preview_dim / float(max(preview_h, preview_w))
            preview_img = cv2.resize(curr_img, (int(preview_w * scale), int(preview_h * scale)), interpolation=cv2.INTER_AREA)
            preview_orig = cv2.resize(unprocessed_img, (int(preview_w * scale), int(preview_h * scale)), interpolation=cv2.INTER_AREA) if unprocessed_img is not None else None
        else:
            preview_img = curr_img
            preview_orig = unprocessed_img

        b64_image = numpy_to_base64_jpeg(preview_img, quality=80)
        b64_orig = numpy_to_base64_jpeg(preview_orig, quality=80) if preview_orig is not None else None

        actual_h, actual_w = preview_img.shape[:2]
        full_h, full_w = curr_img.shape[:2]

        return {
            "success": True,
            "stage": target_stage,
            "image": b64_image,
            "original_image": b64_orig,
            "width": actual_w,
            "height": actual_h,
            "full_width": full_w,
            "full_height": full_h,
            "metadata": stage_metadata.get(target_stage, {}),
            "all_metadata": stage_metadata,
        }

    def apply_stage_to_page(
        self,
        project_id: str,
        page_index: int,
        stage_name: str,
        stage_params: Optional[Dict[str, Any]] = None,
        dpi: int = 300,
    ) -> Dict[str, Any]:
        """
        Apply a SINGLE stage directly to the active working page image and commit changes to disk.
        """
        stage_params = stage_params or {}
        active_img = self.storage.get_active_image(project_id, page_index)

        if stage_name == "orientation":
            res = self.stages["orientation"].process(active_img, params=stage_params, dpi=dpi)
            updated = self.storage.save_preprocessed_page(project_id, page_index, res["image"], stage_name="orientation")
            return {"success": True, "stage": "orientation", "page": updated}

        elif stage_name == "split":
            p = dict(stage_params)
            p["apply_split"] = True
            res = self.stages["split"].process(active_img, params=p, dpi=dpi)
            sub_pages = res["image"]
            if isinstance(sub_pages, list) and len(sub_pages) > 1:
                updated_proj = self.storage.split_project_spread_page(project_id, page_index, sub_pages)
                return {"success": True, "stage": "split", "split": True, "project": updated_proj}
            else:
                final_img = sub_pages[0] if isinstance(sub_pages, list) else sub_pages
                updated = self.storage.save_preprocessed_page(project_id, page_index, final_img, stage_name="split")
                return {"success": True, "stage": "split", "split": False, "page": updated}

        elif stage_name == "deskew":
            res = self.stages["deskew"].process(active_img, params=stage_params, dpi=dpi)
            updated = self.storage.save_preprocessed_page(project_id, page_index, res["image"], stage_name="deskew")
            return {"success": True, "stage": "deskew", "page": updated, "angle": res["metadata"].get("angle")}

        elif stage_name == "content":
            p = dict(stage_params)
            p["apply_crop"] = True
            res = self.stages["content"].process(active_img, params=p, dpi=dpi)
            updated = self.storage.save_preprocessed_page(
                project_id,
                page_index,
                res["image"],
                params={"content_rect": res["metadata"].get("content_rect")},
                stage_name="content",
            )
            return {
                "success": True,
                "stage": "content",
                "page": updated,
                "content_rect": res["metadata"].get("content_rect")
            }

        elif stage_name == "layout":
            p = dict(stage_params)
            p["apply_layout"] = True
            max_size = self.get_project_max_content_size(project_id, dpi=dpi)
            p["max_content_width"] = max_size["max_width"]
            p["max_content_height"] = max_size["max_height"]
            res = self.stages["layout"].process(active_img, params=p, dpi=dpi)
            updated = self.storage.save_preprocessed_page(project_id, page_index, res["image"], stage_name="layout")
            return {"success": True, "stage": "layout", "page": updated}

        elif stage_name == "output":
            res = self.stages["output"].process(active_img, params=stage_params, dpi=dpi)
            updated = self.storage.save_preprocessed_page(project_id, page_index, res["image"], stage_name="output")
            return {"success": True, "stage": "output", "page": updated}

        else:
            raise ValueError(f"Unknown stage: {stage_name}")

    def run_pipeline(
        self,
        image_np: np.ndarray,
        stages_params: Optional[Dict[str, Any]] = None,
        stages_to_run: Optional[List[str]] = None,
        apply_split: bool = False,
        dpi: int = 300,
        is_batch: bool = False,
        max_content_size: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """
        Execute selected stages (or full 6-stage pipeline) on an image array.
        Builds each stage on top of the previous stage output.
        In batch mode, per-page features (content box, split cutter, auto-skew) are computed independently per page.
        """
        stages_params = stages_params or {}
        stages_to_run = stages_to_run or ALL_STAGES

        curr = image_np

        # 1. Orientation
        if "orientation" in stages_to_run:
            s1 = self.stages["orientation"].process(curr, params=stages_params.get("orientation"), dpi=dpi)
            curr = s1["image"]

        # 2. Split
        if "split" in stages_to_run:
            s2_params = dict(stages_params.get("split", {}))
            s2_params["apply_split"] = apply_split
            if is_batch:
                # Let each page detect its own split line unless forced
                s2_params["split_line"] = None
            s2 = self.stages["split"].process(curr, params=s2_params, dpi=dpi)
            sub_images = s2["image"] if isinstance(s2["image"], list) else [s2["image"]]
        else:
            sub_images = [curr]

        processed_sub_images = []

        for sub_img in sub_images:
            s_curr = sub_img

            # 3. Deskew (executed on the split sub-page)
            if "deskew" in stages_to_run:
                s3_params = dict(stages_params.get("deskew", {}))
                if is_batch and not s3_params.get("manual", False):
                    # Auto-detect skew angle per individual page
                    s3_params["angle"] = None
                    s3_params["auto_detect"] = True
                s3 = self.stages["deskew"].process(s_curr, params=s3_params, dpi=dpi)
                s_curr = s3["image"]

            # 4. Content Selection
            content_rect = None
            if "content" in stages_to_run or "layout" in stages_to_run:
                s4_params = dict(stages_params.get("content", {}))
                if is_batch:
                    # Auto-detect content box for EACH page independently
                    s4_params["content_rect"] = None
                    s4_params["auto_detect"] = True

                should_crop = ("content" in stages_to_run and "layout" not in stages_to_run)
                s4_params["apply_crop"] = should_crop
                s4 = self.stages["content"].process(s_curr, params=s4_params, dpi=dpi)
                content_rect = s4.get("metadata", {}).get("content_rect")
                s_curr = s4["image"]

            # 5. Page Layout & Margins (strictly outside content box, standardized to widest page)
            if "layout" in stages_to_run:
                s5_params = dict(stages_params.get("layout", {}))
                s5_params["apply_layout"] = True
                s5_params["content_rect"] = content_rect
                if max_content_size:
                    s5_params["max_content_width"] = max_content_size.get("max_width")
                    s5_params["max_content_height"] = max_content_size.get("max_height")
                s5 = self.stages["layout"].process(s_curr, params=s5_params, dpi=dpi)
                s_curr = s5["image"]

            # 6. Output & Binarization
            if "output" in stages_to_run:
                s6 = self.stages["output"].process(s_curr, params=stages_params.get("output"), dpi=dpi)
                s_curr = s6["image"]

            processed_sub_images.append(s_curr)

        return {
            "images": processed_sub_images,
            "is_split": len(processed_sub_images) > 1,
        }

    def process_and_save_page(
        self,
        project_id: str,
        page_index: int,
        stages_params: Optional[Dict[str, Any]] = None,
        stages_to_run: Optional[List[str]] = None,
        from_original: bool = True,
        split_spread: bool = False,
        dpi: int = 300,
        is_batch: bool = False,
        max_content_size: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """
        Process a single page using selected stages and commit the result.
        """
        if from_original:
            start_img = self.storage.get_original_image(project_id, page_index)
        else:
            start_img = self.storage.get_active_image(project_id, page_index)

        res = self.run_pipeline(
            start_img,
            stages_params=stages_params,
            stages_to_run=stages_to_run,
            apply_split=split_spread,
            dpi=dpi,
            is_batch=is_batch,
            max_content_size=max_content_size,
        )

        images = res["images"]
        if split_spread and len(images) > 1:
            updated_proj = self.storage.split_project_spread_page(project_id, page_index, images)
            return {"success": True, "split": True, "project": updated_proj}
        else:
            final_img = images[0]
            updated_page = self.storage.save_preprocessed_page(
                project_id, page_index, final_img, params=stages_params
            )
            return {"success": True, "split": False, "page": updated_page}
