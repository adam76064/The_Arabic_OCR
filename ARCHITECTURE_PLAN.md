# Arabic OCR - Rebuild Architecture Plan

## Overview
Rebuild the existing Arabic OCR desktop app (Python + pywebview + HTML/JS/CSS) into a clean, organized, efficient, lightweight-consistent version while reusing proven pieces.

Same languages:
- Backend: Python (pywebview, PyMuPDF, python-docx, etc.)
- Frontend: HTML5, vanilla JS (no framework), CSS.

## Goals
- Organized: clear separation of concerns, no 1000-line god files.
- Efficient: avoid duplicated parsing, reuse standardized OCR pipeline.
- Lightweight UI: single design system with tokens, consistent components.
- Preserve features: multi-engine OCR, table detection, Quran verification, text cleaning, collaborative LAN, export (DOCX/HTML/EPUB3/TXT/JSON).

## Current Problems Identified
1. `main.py` 1000+ lines Api class mixing PDF, OCR, LAN, export, UI events.
2. `backend/` has 15+ flat files, no grouping; circular logic duplicated in trigger_* OCR methods.
3. `frontend/css/` 3 large files with overlapping rules, inconsistent variables.
4. `frontend/js/review.js` 1400+ lines: canvas, editor, tracking, preview, dashboard all in one.
5. Exporter.py 1350 lines mixing docx html parsing logic.
6. Table detection duplicated logic in table_handler vs orchestrator.

## New Architecture

### Backend Layout
```
backend/
  app/
    api.py          # Thin pywebview API facade (delegates to services)
    events.py       # UI event emitter (progress -> JS)
  core/
    config.py       # ConfigManager (data path)
    projects.py     # ProjectManager (CRUD, atomic writes, raw_ocr backup)
    pdf.py          # PDFProcessor (render at 200 DPI, hash, chunking)
    text.py         # ArabicTextCleaner
    quran.py        # QuranHandler
    ocr/
      base.py       # OCRAdapter interface: extract(image_path) -> blocks
      handler.py    # OCRHandler standardization (bbox+geometry at all levels)
      service.py    # Unified: standardize + clean + apply category formatting
      paddle.py     # PaddleOCRClient adapter
      google_lens.py# GoogleLensOCR adapter
      locro.py      # Locro adapter
      llm.py        # LLMOCR adapter
  export/
    shared.py       # HTML/markdown parsing, poetry helpers, direction detection
    json_export.py
    txt_export.py
    docx_export.py  # docx logic
    html_epub.py    # formerly epub_builder
    __init__.py     # router export_project(fmt,...)
  table/
    handler.py      # TableHandler bridge (calls engine)
    engine/         # moved table_detector/* -> line_grid, blob, column, row, etc.
  collab/
    discovery.py    # LANDiscovery (zeroconf)
    sync.py         # LANSyncServer/Client (Fernet encryption)
    merger.py       # ProjectMerger
  utils/
    stitcher.py     # block_stitcher
    retriever.py    # text_retriever
```

Key improvements:
- Api class shrinks to ~300 lines, each method delegates: `self.projects.create(...)`, `self.pdf.render(...)`, `self.ocr_service.run('paddle', ...)`.
- Single `_apply_cleaning_to_elements` lives in `ocr/service.py`, reused by all triggers.
- PDF extraction `extract_pdf_range` moved to `core/pdf.py`.
- Export router small; each format isolated.
- Table engine import path `backend.table.engine` but keeps original algorithm reusable as-is.

### Frontend Layout
```
frontend/
  index.html, projects.html, review.html, settings.html, export.html
  css/
    tokens.css      # --color-primary, --radius, --font-ar, spacing scale
    base.css        # reset, typography, html dir
    components.css  # buttons, cards, modals, forms, badges, tables
    layout.css      # sidebar, toolbar, editor-container, resizable panels
    home.css        # home-specific
    review.css      # review-specific canvas & blocks
    style.css       # now just @import tokens,base,components,layout
  js/
    core/
      api.js        # wrapper: pywebviewReady() + call(method,...args)
      store.js      # simple reactive store: project, pageIndex, settings
      utils.js      # escapeHtml, debounce, format helpers
      events.js     # progress listeners (onPdfProgress, onPaddleProgress)
    components/
      sidebar.js    # collapsed/expand, nav active
      modal.js      # generic modal open/close, AestheticDialog
      toolbar.js    # formatting toolbar injection & handlers
      notifications.js # showNotif tray
    pages/
      home.js
      projects.js
      settings.js
      export.js
      review/
        index.js        # initApp, state vars
        canvas.js       # drawBoxes, renderBboxes, thumb canvas, fullpage
        editor.js       # renderBlocksList, syncElementFromContent, selection
        tracking.js     # word/line/cell tracking wrapper around engine
        panels.js       # resizable panels + layout toggle
        category.js     # category picker
        context-menu.js # block context menu merge/split
        undo.js         # undo-redo wrapper
        preview.js      # text preview overlay
        quran.js        # kept but uses core/api.js
```

UI consistency rules:
- Single font stack: 'Segoe UI', Tahoma, 'Simplified Arabic', sans-serif.
- RTL default.
- 4 button variants only: primary, secondary, success, danger, icon.
- One modal style, one card style.
- CSS variables for colors: --primary #3498db, --success #27ae60, etc.
- Remove duplicated toolbar CSS.

### Data Flow
1. User creates project: PDF selected -> pdf.get_hashes -> pdf.render_pages (200 DPI) -> projects.create.
2. OCR: frontend requests trigger_* -> api routes to ocr/service which:
   - renders temp images if needed (or chunks PDF)
   - calls adapter (paddle/google/locro/llm)
   - standardizes via handler.standardize_page_blocks(native_w,h, dpi)
   - cleans via text_cleaner + category_formatting
   - saves via projects.save_raw_ocr + update.
   - emits progress via events.
3. Review: canvas.js shows bboxes, editor.js edits contenteditable, tracking highlights word bbox and pans crop viewer.
4. Export: export router builds body HTML via shared helpers, then format-specific builder writes file.

### Efficiency Gains
- Remove duplicate `_apply_cleaning_to_elements` copied in main.py triggers -> single service.
- PDF range extraction reused.
- Export shared parsing (`parse_inline_runs`) extracted to shared.py reused by docx + html.
- Frontend delegated event listeners (one listener for blocks list vs per-block).
- Lazy-load heavy JS only on review page.

### Phases
Phase 1 – Core: config, projects, pdf, text, quran, utils.
Phase 2 – OCR: handler + adapters + service, keep old files as shims.
Phase 3 – Export: split exporter.
Phase 4 – Table & Collab.
Phase 5 – App API facade + main.py slim.
Phase 6 – Frontend CSS design system.
Phase 7 – Frontend JS core + home/projects/settings pages clean rebuild.
Phase 8 – Review page rebuild (biggest) + Quran integration.
Phase 9 – Cleanup, README rewrite, testing flow.

### Compatibility
- Keep old import paths working via shim files that import from new core locations, so existing code doesn't break mid-rebuild.
- project.json schema unchanged (bbox at 200 DPI scaled target, etc.)

### Lightweight UI Principles
- No external framework, vanilla JS.
- CSS <15KB gzipped.
- All icons via text symbols (＋,📂,⚙) not images.
- Sidebar 240px, collapsible.
- Modals centered, overlay 0.45.
- Buttons 9px 16px padding consistent.
