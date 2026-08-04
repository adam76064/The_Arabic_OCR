# 📖 Arabic OCR Rebuilt — Clean, Organized, Lightweight

A rebuilt, well-organized version of **The_Arabic_OCR** desktop app for Arabic OCR review, layout editing, table extraction, Quranic verification, multi-engine OCR, and LAN collaboration.

**Same languages:** Python (backend) + HTML/CSS/JS vanilla (frontend), wrapped in `pywebview`.

This rebuild keeps all proven features but reorganizes the codebase, removes duplication, and ships a consistent lightweight UI design system.

---

## ✨ Key Features

- **Multi-Engine OCR Pipeline**
  - `PaddleOCR` (online, limit-tracked, chunked PDFs)
  - `Google Lens` (high accuracy, async batch)
  - `Locro` offline Chrome ScreenAI
  - `LLM Vision` via `litellm` (Gemini, Claude, GPT-4o, custom OpenAI-compatible) with normalized 0-1000 bbox → 200 DPI mapping
  - Unified cleaning/standardization via `backend/core/ocr/service.py`

- **Layout & Table Engine**
  - 3-tier detection: native PDF vectors → word-coordinate columns → image smear / morphology
  - Geometric grid: rows, columns, spans, ruling lines
  - RTL/LTR aware
  - Interactive editor (`table-editor.js`, `table-model.js`)

- **Quran Verification**
  - Complete dataset `data/Quran.json`
  - Fuzzy search (difflib + sliding windows + gap-fill) and formal citation insertion

- **Arabic Typography**
  - `ArabicTextCleaner`: hamza normalization, tanween, tashkeel stripping, kashida removal, waw fix, punctuation, footnote superscript

- **Lightweight Review UI**
  - Canvas bbox overlay synchronized with text blocks
  - Crop viewer with pan/zoom, thumbnail hover
  - Resizable panels, side-by-side vs top/bottom toggle
  - Custom categories with color dots
  - Full-text preview (editable), dashboard, undo/redo, keyboard shortcuts
  - Word/line/cell tracking engine

- **Collaboration**
  - LAN peer discovery via `zeroconf` mDNS, PSK-derived Fernet encryption (PBKDF2HMAC)
  - Real-time JSON sync, on-demand file transfer with hash check

- **Export**
  - DOCX (RTL, poetry tables with soft-return justification, category formatting), EPUB3, HTML, TXT, JSON — now split into `backend/export/*`

---

## 🏗️ New Architecture

### Backend
```
backend/
  app/
    api.py          # Thin pywebview API facade (~500 lines vs 1000+ before)
    events.py       # Progress → JS emitter
  core/
    config.py       # ConfigManager (data path, migration)
    projects.py     # ProjectManager (atomic writes, raw_ocr backup)
    pdf.py          # PDFProcessor + extract_pdf_range
    text.py         # ArabicTextCleaner
    quran.py        # QuranHandler
    ocr/
      handler.py    # Bbox/geometry standardization at all levels
      service.py    # Unified clean + category formatting (single source)
      base.py       # Adapter interface
      paddle.py / google_lens.py / locro.py / llm.py
  export/
    shared.py       # Markdown/HTML parsing, poetry helpers, color/direction utils
    json_export.py / txt_export.py / docx_export.py / html_epub.py
    __init__.py     # export_project router
  table/
    handler.py      # Bridge
    engine/         # Moved from table_detector/* (line_grid, blob, column, row)
  collab/
    discovery.py / sync.py / merger.py
  utils/
    stitcher.py / retriever.py
```

- **Old flat files remain as shims** (`backend/config_manager.py` imports from `backend.core.config`) for backward compatibility during transition.

### Frontend
```
frontend/
  css/
    tokens.css      # Design tokens (colors, radii, spacing, fonts)
    base.css        # Reset + typography
    components.css  # Buttons, cards, modals, forms, badges
    layout.css      # Sidebar, toolbar, sticky nav
    style.css       # Now just @imports tokens+base+components+layout
    home.css / review.css (use tokens)
  js/
    core/
      api.js        # pywebview ready + call wrapper
      store.js      # Simple reactive store
      utils.js      # escapeHtml, debounce
      events.js     # onPdfProgress, onPaddleProgress listeners
    components/
      sidebar.js / modal.js / notifications.js / toolbar.js
    pages/
      home.js / projects.js (new, use AppApi)
      review/
        state.js    # Centralized review state
        canvas.js   # Wrapper around canvas-rendering.js
        panels.js   # Resizable + layout toggle (extracted)
        editor.js / tracking.js / category.js / preview.js / index.js (orchestrator)
```

**UI consistency:**
- 4 button variants only, 9px 16px padding, 6px radius
- One modal style, one card style
- Sidebar 240px collapsible, token-driven
- CSS <15KB gzipped, no framework

### Data Flow
1. **Create** → PDF hash → render at ~200 DPI → `projects.create`
2. **OCR** → `Api.trigger_*` → adapter → `OCRService.standardize_and_clean` (single cleaning path) → `save_raw_ocr` + `update_project` → emit progress
3. **Review** → canvas draws bboxes, editor edits contenteditable, tracking pans crop viewer
4. **Export** → shared helpers → format-specific builder

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- `pip install -r requirements.txt`

### Run
```bash
python main.py
```

Window opens at 1280x800, URL `file://frontend/index.html` via pywebview.

### Workflow
1. Home → New Project → select PDF, set title/author, optional LAN password.
2. Dashboard → select pages range, choose engine (Paddle / Lens / Locro / LLM), set keys/prompt.
3. Review → edit blocks, change category, split/merge, table layout auto-detect, Quran insert via context menu.
4. Export → DOCX/EPUB/HTML/TXT/JSON with options (page numbering, formatting mode).

---

## 🔧 Efficiency Improvements vs Old Version

- Removed duplicate `_apply_cleaning_to_elements` (was copied in 4 trigger methods) → single `OCRService`.
- Export helpers extracted to `shared.py` reused by DOCX + HTML/EPUB.
- PDF range extraction unified.
- Frontend delegated listeners (one listener for blocks list vs per-block).
- Backend modules <200 lines each, focused responsibility.
- CSS tokens reduce duplicated colors/sizes.

---

## 📁 Project Persistence

```
<data_path>/projects/
  <project_id>/
    project.json
    raw_ocr/
      page_0.json
    images/
      page_0.jpg
  app_settings.json
```

`data_path` resolved via `ConfigManager`: `%APPDATA%/The_Arabic_OCR` on Windows, or `~/AppData/Roaming/...` fallback, user-changeable in settings.

---

## 📝 Original Features Preserved

- All OCR engines, Quran dataset, export formats, LAN sync, table detection algorithms, text cleaning options — logic copied as-is but relocated to organized modules.
- `table_detector/` folder kept for backward import, but new path is `backend/table/engine/`.

---

## 🛠️ Development Notes

- Old import paths still work (shim files).
- `main.py` now 40 lines vs 1000+; real logic in `backend/app/api.py`.
- To add new OCR engine: implement `extract(image_path)` → list of blocks, register in `Api`, use `OCRService` to standardize.
- Frontend: prefer `AppApi.call(method,...)` over direct `window.pywebview.api`.

---

## 📄 License

Same as original — open source.
