"""
worker.py — Background thread worker for batch pre-processing.
"""
from typing import Any, Callable, Dict, List, Optional
import threading
import time


class BatchPreprocessingWorker:
    """
    Executes pre-processing across multiple project pages on a background worker thread.
    Calculates unified project-wide content bounds and runs per-page auto-detection.
    Handles split-page index shifting seamlessly by running reverse-order iteration when splitting.
    """

    def __init__(
        self,
        engine,
        project_id: str,
        page_indices: List[int],
        stages_params: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        completed_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.engine = engine
        self.project_id = project_id
        self.page_indices = page_indices
        self.stages_params = stages_params
        self.options = options or {}
        self.progress_callback = progress_callback
        self.completed_callback = completed_callback

        self._stop_requested = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.is_running = False

    def start(self):
        """Start the background processing thread."""
        if self.is_running:
            return
        self._stop_requested.clear()
        self.is_running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        """Request worker thread to stop."""
        self._stop_requested.set()

    def _run(self):
        total = len(self.page_indices)
        split_spread = bool(self.options.get("split_spread", False))
        dpi = int(self.options.get("dpi", 300))
        stages_to_run = self.options.get("stages_to_run")
        from_original = bool(self.options.get("from_original", True))

        # 1. Pre-calculate widest content size across pages for uniform page margins
        max_content_size = None
        if stages_to_run is None or "layout" in stages_to_run:
            try:
                max_content_size = self.engine.get_project_max_content_size(
                    self.project_id, self.page_indices, dpi=dpi
                )
            except Exception as e:
                print(f"[BatchPreprocessingWorker] max_content_size estimation error: {e}")

        # When splitting spreads, iterate in reverse order so inserted sub-pages never shift unprocessed indices
        exec_indices = sorted(self.page_indices, reverse=split_spread)

        processed_count = 0
        errors = []
        start_time = time.time()

        try:
            for idx_pos, page_idx in enumerate(exec_indices):
                if self._stop_requested.is_set():
                    break

                # Notify progress
                if self.progress_callback:
                    pct = int(((idx_pos + 1) / float(total)) * 100)
                    self.progress_callback({
                        "project_id": self.project_id,
                        "status": "processing",
                        "current": idx_pos + 1,
                        "total": total,
                        "page_index": page_idx,
                        "percentage": pct,
                    })

                try:
                    self.engine.process_and_save_page(
                        self.project_id,
                        page_idx,
                        stages_params=self.stages_params,
                        stages_to_run=stages_to_run,
                        from_original=from_original,
                        split_spread=split_spread,
                        dpi=dpi,
                        is_batch=True,
                        max_content_size=max_content_size,
                    )
                    processed_count += 1
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    errors.append({"page_index": page_idx, "error": str(e)})

            # Final completed callback
            elapsed = round(time.time() - start_time, 2)
            if self.completed_callback:
                self.completed_callback({
                    "project_id": self.project_id,
                    "status": "cancelled" if self._stop_requested.is_set() else "completed",
                    "processed_count": processed_count,
                    "total": total,
                    "elapsed_seconds": elapsed,
                    "errors": errors,
                })
        finally:
            self.is_running = False
