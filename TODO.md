# TODO - Rebuild Progress (Completed)

## Phase 0 - Planning
- [x] Explore repo, read main.py, backend, frontend
- [x] Write ARCHITECTURE_PLAN.md
- [x] Write TODO.md

## Phase 1 - Backend Core Foundation
- [x] Create directory structure backend/core, backend/utils, backend/app, backend/export, backend/table, backend/collab
- [x] Move/clean ConfigManager -> backend/core/config.py
- [x] Move/clean ProjectManager -> backend/core/projects.py
- [x] Move/clean PDFProcessor -> backend/core/pdf.py + range extraction helper
- [x] Move/clean ArabicTextCleaner -> backend/core/text.py
- [x] Move/clean QuranHandler -> backend/core/quran.py
- [x] Move block_stitcher, text_retriever -> backend/utils/
- [x] Keep shim files for backward compat

## Phase 2 - OCR Refactor
- [x] Create backend/core/ocr/base.py interface
- [x] Move ocr_handler -> backend/core/ocr/handler.py
- [x] Create service.py unified cleaning/standardization
- [x] Adapt paddleocr_client -> backend/core/ocr/paddle.py
- [x] Adapt google_lens_ocr -> backend/core/ocr/google_lens.py
- [x] Adapt locro_ocr -> backend/core/ocr/locro.py
- [x] Adapt llm_ocr -> backend/core/ocr/llm.py
- [x] Shims for old imports

## Phase 3 - Export Split
- [x] Create backend/export/shared.py (strip, parse_inline_runs, poetry helpers)
- [x] Extract json/txt/docx/html_epub into separate modules
- [x] Create router __init__.py with export_project(fmt, ...)
- [x] Keep old exporter.py & epub_builder.py as shims

## Phase 4 - Table & Collab
- [x] Move table_detector/* -> backend/table/engine/*
- [x] Clean table_handler -> backend/table/handler.py
- [x] Move lan_discovery, lan_sync, project_merger -> backend/collab/
- [x] Shims

## Phase 5 - App API Facade
- [x] Create backend/app/api.py thin facade delegating to services
- [x] Create backend/app/events.py progress emitter
- [x] Rewrite main.py to use new App API (slim 40 lines)
- [x] Keep old Api class behavior via new modules

## Phase 6 - Frontend CSS Design System
- [x] Create tokens.css, base.css, components.css, layout.css
- [x] Rewrite style.css as imports
- [x] Keep home.css, review.css but refactor to use tokens (home rewritten)
- [x] Lightweight consistent buttons/cards/modals

## Phase 7 - Frontend JS Core & Simple Pages
- [x] js/core/api.js (pywebview wrapper + ready)
- [x] js/core/store.js (project, settings)
- [x] js/core/utils.js
- [x] js/components/sidebar.js, modal.js, notifications.js, toolbar.js
- [x] Rebuild home.js, projects.js with new core (pages/home.js, pages/projects.js)
- [x] Update index.html, projects.html to load new core

## Phase 8 - Review Page Rebuild
- [x] Split review.js monolith into js/pages/review/*.js modules (state, canvas, panels, editor, tracking, category, preview, index)
- [x] Keep canvas-rendering, undo-redo, tracking engine but integrate via facade
- [x] Rebuild review/index.js as orchestrator
- [x] Update review.html to use new CSS/JS modules + core

## Phase 9 - Final Cleanup & Docs
- [x] Test imports / py_compile flow
- [x] Update README.md (accurate, new architecture)
- [x] Clean requirements.txt
- [x] Mark TODO complete

Notes:
- Old paths remain as shims so existing code doesn't break mid-rebuild.
- Frontend legacy files kept for fallback, new files in js/pages/ and js/core/ are authoritative.
- Next steps (future): fully remove legacy review.js 1400-line monolith after confirming new modules cover all, and remove shim files.
