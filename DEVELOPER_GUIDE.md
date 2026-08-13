# 🛠️ Arabic OCR — Developer & AI Agent Guide (Rebuilt v2)

> **This file is for programmers and AI agents who want to understand, modify, or extend the codebase.**
> For normal users who just want to install and use the tool, see **[README.md](README.md)** — it explains what the tool does, how to install, and how to use it in simple language.
>
> This guide is a maintained onboarding reference for developers and AI agents. It documents the current repository structure, major modules, data models, coordinate systems, pipelines, and supported extension points. For implementation details, treat the source code as authoritative.

# 📖 Arabic OCR — Rebuilt v2 (Organized, Efficient, Lightweight)

> A desktop-grade, offline-first Arabic OCR review tool built with **Python + pywebview + vanilla HTML/CSS/JS**.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Repository Structure](#repository-structure)
4. [Backend Architecture (Python)](#backend-architecture)
   - [Core / Projects / PDF / Text / Quran](#core)
   - [OCR Pipeline](#ocr-pipeline)
   - [Table Engine](#table-engine)
   - [Export System](#export-system)
   - [Collaboration](#collaboration)
   - [App Facade & Events](#app-facade)
5. [Frontend Architecture (JS/CSS/HTML)](#frontend-architecture)
   - [Design System](#design-system)
   - [Core JS](#core-js)
   - [Components](#components)
   - [Pages](#pages)
   - [Review Page Deep Dive](#review-page-deep-dive)
6. [Data Models & Coordinate System](#data-models)
7. [Key Workflows](#key-workflows)
8. [How to Extend](#how-to-extend)
   - [Add new OCR engine](#add-ocr-engine)
   - [Add new export format](#add-export-format)
   - [Add new block category](#add-category)
9. [Interface localization (i18n)](#interface-localization-i18n)
10. [Debugging & PyWebView Quirks](#debugging--pywebview-quirks)
11. [Known Fixes in Rebuild](#known-fixes)
12. [Requirements & Setup](#requirements)
13. [License](#license)

---

## Project Overview

**Goal:** Take a scanned Arabic PDF, run OCR (multiple engines), let user review/correct layout (blocks, tables, images), verify Quran verses, and export clean DOCX/EPUB/HTML/TXT/JSON.

**Why Arabic-focused?**
- RTL direction handling everywhere (bidi tags in DOCX, `dir="rtl"` in HTML, CSS `direction: rtl`)
- Arabic typography cleaning (kashida, hamza, tanween, tashkeel)
- Poetry tables: `شعر عمودي` (two hemistichs per row) and `شعر متدرج` (staggered)
- Quran dataset integration

**Tech stack (same languages as original):**
- Backend: Python 3.10+, pywebview (native window), PyMuPDF (PDF rasterization), python-docx, OpenCV, Pillow, requests, cryptography, zeroconf, litellm, chrome-lens-py, locro
- Frontend: Vanilla JS (no framework), HTML5, CSS3 with design tokens
- Bridge: `window.pywebview.api.<method>()` promises (JS → Python) and `window.evaluate_js("window.onEvent(payload)")` (Python → JS)

### Current repository notes

- `main.py` starts `backend.app.api.Api` and loads `frontend/index.html` in pywebview. The compatibility modules at the top of `backend/` re-export or preserve older import paths; active implementations are organized under `backend/app`, `backend/core`, `backend/export`, `backend/collab`, `backend/table`, and `backend/post_processing`.
- The frontend is deliberately framework-free. HTML pages load shared scripts in dependency order: core settings, locale catalogs, the i18n service, shared components, then page modules.
- Global user preferences, including `interfaceLanguage`, are stored by `ProjectManager` in `<data path>/projects/app_settings.json`. Settings are loaded by `frontend/js/pages/settings.js` after pywebview is ready.

---

## Quick Start

```bash
git clone https://github.com/adam76064/The_Arabic_OCR.git
cd The_Arabic_OCR
pip install -r requirements.txt
python main.py
```

Window opens 1280x800 loading `frontend/index.html` via pywebview.

**Workflow:**
1. Home → New Project → pick PDF + title/author + optional LAN password
2. Dashboard → select page range (e.g. 1-200) → choose engine (Paddle online, Google Lens, Locro offline, LLM Vision) → set API keys/prompt if needed → Run
3. Review → canvas shows bboxes, crop viewer shows zoomed block, text blocks editable, category change via label, table auto-layout, Quran insert via right-click
4. Export → choose pages + format + options (page numbering `none/pdf/logical`, `text_mode` `formatted/raw`, etc.)

---

## Repository Structure

```
The_Arabic_OCR/
├── main.py                          # 70-line slim entry, disables noisy webview logger, enables debug devtools
├── requirements.txt                 # Minimal, sectioned deps
├── README.md                        # This file
├── DEVELOPER_GUIDE.md                # Canonical developer/architecture reference (absorbs the original rebuild plan)
├── .gitignore
│
├── backend/
│   ├── __init__.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── api.py                   # Thin facade (~900 lines vs old 1068) - ALL pywebview API methods here
│   │   └── events.py                # EventEmitter: Python → JS progress (onPdfProgress, onPaddleProgress, onLanUpdate)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                # ConfigManager: resolves data_path, meta_config.json, legacy migration
│   │   ├── projects.py              # ProjectManager: CRUD, atomic JSON writes, raw_ocr backup, password hashing
│   │   ├── pdf.py                   # PDFProcessor: hash (md5/sha1/sha256), render at ~200 DPI, extract_pdf_range helper
│   │   ├── text.py                  # ArabicTextCleaner: kashida, hamza, numbers, tanween, tashkeel, punctuation, waw, superscript
│   │   ├── quran.py                 # QuranHandler: load Quran.json, normalize, fuzzy search (exact+sliding+diffib+gap-fill)
│   │   └── ocr/
│   │       ├── __init__.py
│   │       ├── base.py              # Protocol OCRAdapter + OCRResult container
│   │       ├── handler.py           # OCRHandler.standardize_page_blocks(): converts any bbox/geometry to unified 72 DPI + relative geometry at all levels
│   │       ├── service.py           # OCRService: single source for standardize+clean+category_formatting (removes duplication)
│   │       ├── paddle.py            # PaddleOCRClient: BOS upload + polling + limits tracking (paddle_limits.json)
│   │       ├── google_lens.py       # GoogleLensOCR: ThreadPool + asyncio new_event_loop per thread to avoid pywebview loop conflict
│   │       ├── locro.py             # run_locro_ocr(): ScreenAI, returns blocks with lines/words/bboxes
│   │       └── llm.py               # LLMOCRHandler: litellm, base64 image, 0-1000 normalized bbox prompt
│   ├── export/
│   │   ├── __init__.py              # export_project(fmt) router
│   │   ├── shared.py                # ALL shared helpers (was scattered in exporter.py): _detect_text_direction, _strip_markdown, parse_inline_runs, poetry parsing, DOCX BiDi helpers, color parsing
│   │   ├── json_export.py           # export_json()
│   │   ├── txt_export.py            # export_txt() with table grid handling
│   │   ├── docx_export.py           # export_docx() – explicit imports of private helpers to avoid NameError from import *
│   │   └── html_epub.py             # export_html(), export_epub3(), get_arabic_css(), get_xhtml_template()
│   ├── table/
│   │   ├── __init__.py
│   │   ├── handler.py               # TableHandler: 3-tier layout (native vectors → word coords → smear), builds cells via text_retriever
│   │   └── engine/                  # Copied from table_detector/ (kept original algorithms as-is)
│   │       ├── __init__.py
│   │       ├── blob_detector.py     # find_blobs(), median_line_height()
│   │       ├── column_finder.py     # find_columns()
│   │       ├── row_grouper.py       # group_column_into_paragraphs()
│   │       ├── row_reconciler.py    # build_row_bands()
│   │       ├── line_grid_detector.py# detect_grid()
│   │       ├── preprocess.py        # preprocess()
│   │       ├── orchestrator.py
│   │       └── ... (grid_builder, cell_ocr, span_detector)
│   ├── collab/
│   │   ├── __init__.py
│   │   ├── discovery.py             # LANDiscovery: zeroconf mDNS browse/register
│   │   ├── sync.py                  # LANSyncServer/Client: PBKDF2HMAC derived Fernet key, HMAC challenge auth, frame send/recv, broadcast_update
│   │   └── merger.py                # ProjectMerger + validate_password_strength
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── stitcher.py              # BlockStitcher: create_stitched_image() for chunked OCR, apply_stitched_text()
│   │   └── retriever.py             # extract_lines_and_words_for_bbox(), populate_layout_blocks_text() – preserves reading order, aligns user edits via difflib
│   ├── block_stitcher.py            # Shim → backend.utils.stitcher
│   ├── text_retriever.py            # Shim → backend.utils.retriever
│   ├── config_manager.py            # Shim → backend.core.config
│   ├── project_manager.py           # Shim → backend.core.projects
│   ├── pdf_processor.py             # Shim → backend.core.pdf
│   ├── text_cleaner.py              # Shim → backend.core.text
│   ├── quran_handler.py             # Shim → backend.core.quran
│   ├── ocr_handler.py               # Shim → backend.core.ocr.handler
│   ├── paddleocr_client.py          # Shim → backend.core.ocr.paddle
│   ├── google_lens_ocr.py           # Shim → backend.core.ocr.google_lens
│   ├── locro_ocr.py                 # Shim → backend.core.ocr.locro
│   ├── llm_ocr.py                   # Shim → backend.core.ocr.llm
│   ├── table_handler.py             # Shim → backend.table.handler
│   ├── lan_discovery.py             # Shim → backend.collab.discovery
│   ├── lan_sync.py                  # Shim → backend.collab.sync
│   ├── project_merger.py            # Shim → backend.collab.merger
│   ├── exporter.py                  # Shim → backend.export
│   └── epub_builder.py              # Shim → backend.export.html_epub
│
├── frontend/
│   ├── index.html                   # Home + cards + recent projects + settings modal (loads core + components + pages/home)
│   ├── projects.html                # Projects table (core + pages/projects)
│   ├── review.html                  # Complex review UI - now loads 20+ organized modules in correct order (vendor marked → core → components → tables → formatting → review legacy extracted → review modular broken monolith state first! → thin orchestrator → quran)
│   ├── settings.html, export.html, project-dashboard.html, lan.html, layout-editor.html, etc. (all updated to new organized paths)
│   ├── css/
│   │   ├── tokens.css               # Design tokens --color-primary, --radius-md, --space-md, --font-ar, etc.
│   │   ├── base.css                 # Reset, typography, scrollbars, RTL default
│   │   ├── components.css           # Buttons .btn-primary/secondary/success/danger/icon, cards, modals, forms, switches, badges, dashboard-table
│   │   ├── layout.css               # body.has-sidebar flex, #sidebar 240px, collapsed with margin-right + transform + visibility + pointer-events, toolbar, page-nav, sticky-nav
│   │   ├── style.css                # ONLY @import tokens,base,components,layout (plus small global tweaks)
│   │   ├── home.css                 # Hero, home-cards grid, recent-card, progress bars
│   │   └── review.css               # Toolbar, editor-container, image-viewer (hidden), text-editor, crop-section, blocks-list, text-block (active/reviewed/drag), category-picker, fullpage-overlay
│   └── js/
│       ├── review.js                # THIN ORCHESTRATOR ~90 lines (was 1400-line monolith) – only initApp() + DOMContentLoaded, calls setup* from modules
│       ├── core/
│       │   ├── api.js               # AppApi.ready() promise, AppApi.call(method,...), wrappers getProjects etc.
│       │   ├── store.js             # AppStore.get/set/subscribe, project/pageIndex/settings
│       │   ├── utils.js             # escapeHtml, debounce, formatBytes, sleep
│       │   └── events.js            # Default onPdfProgress/onPaddleProgress/onLanUpdate loggers if page didn't set
│       ├── components/
│       │   ├── sidebar.js           # Robust injection if missing, has-sidebar class, collapsed toggle with _sidebarBound guard, tab button, exit, console.log for debug
│       │   ├── modal.js             # openModal/closeModal + AestheticDialog fallback
│       │   ├── notifications.js     # showNotif tray bottom-left with colors
│       │   ├── toolbar.js           # Fallback toolbar injector (delegates to formatting toolbar if exists)
│       │   ├── tables/
│       │   │   ├── table-model.js   # TableModel.toModel() / fromModel()
│       │   │   ├── table-selection.js # Table selection logic
│       │   │   ├── table-toolbar.js # Table toolbar (merge/split)
│       │   │   └── table-editor.js  # Table editor
│       │   ├── formatting/
│       │   │   ├── text-formatting.js # injectToolbar() builds formatting toolbar HTML
│       │   │   └── toolbar.js       # Formatting toolbar logic (alignment, dir, color, etc.)
│       │   └── quran/
│       │       └── quran.js         # Quran modal: tabs, search, surah select, load-more, insertion with citation
│       ├── pages/
│       │   ├── home.js              # initHome: getProjects, badge count, recent 4 sorted
│       │   ├── projects.js          # renderProjectsTable, search, back, delete confirm with remember
│       │   ├── settings.js          # App settings persistence, blockFontSize, night mode, custom categories, shortcuts, data path
│       │   ├── ui-shared.js         # AestheticDialog, saveAppSettings(), deleteConfirm, etc.
│       │   ├── project-creator.js   # New project modal wizard
│       │   ├── project-dashboard.js # THIN ORCHESTRATOR ~30 lines (was 715)
│       │   ├── project-dashboard/   # Dashboard submodules
│       │   │   ├── state.js         # Global state for dashboard
│       │   │   ├── table.js         # Projects table rendering
│       │   │   ├── stats.js         # OCR statistics and progress logic
│       │   │   ├── ocr-modal.js     # OCR engine selection and configuration modal
│       │   │   ├── progress.js      # Progress bar and status updates
│       │   │   ├── export.js        # Export functionality
│       │   │   ├── collab.js        # LAN collaboration status
│       │   │   ├── llm.js           # LLM configuration logic
│       │   │   └── index.js         # Dashboard entry point
│       │   ├── project-settings.js  # Per-project settings
│       │   ├── lan.js               # LAN page logic
│       │   ├── layout-editor.js     # THIN ORCHESTRATOR ~30 lines (was 1481)
│       │   ├── layout-editor/       # Layout editor submodules
│       │   │   ├── state.js         # Global state for layout editor
│       │   │   ├── history.js       # Undo/redo stack
│       │   │   ├── selection.js     # Block selection logic
│       │   │   ├── table-tools.js   # Table specific editing tools
│       │   │   ├── properties.js    # Block properties sidebar
│       │   │   ├── canvas.js        # Canvas rendering and interactions
│       │   │   ├── toolbar.js       # Top toolbar actions
│       │   │   ├── navigation.js    # Page navigation
│       │   │   ├── save.js          # Saving logic to backend
│       │   │   ├── events.js        # Event listeners routing
│       │   │   └── index.js         # Layout editor entry point
│       │   └── review/
│       │       ├── state.js         # REAL: globals currentProject, currentPageIndex, selectedBlockIndex, multiSelectedBlocks, activeEditingIndex, cropZoom, CROP_MIN/MAX, scaleRatioX/Y, cropPanX/Y, dragSrcIndex, BASE_CATEGORIES, getCategoryColors(), CATEGORY_ARABIC_MAP, getCategoryNameAR(), getAllCategories(), isTableLike(), ReviewState singleton + sync
│       │       ├── navigation.js    # navigatePage(dir), moveFocusAndReview(dir) with auto-review and intra-table navigation
│       │       ├── save.js          # saveBlockSilently(), autoSaveBlock() -> pywebview.api.update_page_ocr
│       │       ├── fontzoom.js      # BLOCK_FONT_MIN/MAX/STEP/DEFAULT, setupBlockFontZoom(), applyBlockFontSize()
│       │       ├── crop.js          # showCroppedView(bbox), applyCropZoom(), panCropViewTo(bbox) preserves zoom, setupCropControls()
│       │       ├── fullpage.js      # setupFullPageView(), openFullPageView(), closeFullPageView()
│       │       ├── panels.js        # setupResize(), updateSwitchBtnPosition(), setupPanels()/setupResizablePanels() + side-by-side toggle with persistence
│       │       ├── editor.js        # REAL: updateReviewPanel(), updateBlockSelectionUI(), selectBlock(), syncElementFromContent(), refreshIndicatorsFor(), renderBlocksList() (full 200-line with table rendering via TableModel, focus/blur with tracking), setupBlocksListDelegation() (single delegated listener), setupBlockDrag(), reorderBlocks(), deleteBlock()
│       │       ├── toolbar.js       # setupToolbar() with prev/next, undo/redo, formatting mousedown preventDefault, alignment buttons with cell selection via range.intersectsNode, direction buttons, thumb popup, save with force sync
│       │       ├── category.js      # handleTableCategoryChange() with localStorage remember + AestheticDialog, setupCategoryPicker(), openCategoryPicker() with viewport-aware positioning
│       │       ├── tracking.js      # defaultTrackingConfig, savedTrackingConfig from localStorage, track-settings-btn toggle, cfg-track checkboxes persistence, debounce(), updateTrackingHighlight() via TextTrackingEngine, debouncedTrackingUpdate
│       │       ├── preview.js       # escapeHtml(), setupTextPreview IIFE + buildPreviewHTML() with tables/poetry/markdown, renderPreview(), save handling collecting touched pages, showNotif() tray, window.onLanUpdate (join/leave/edit), setupDashboard(), persistBrushEdit()
│       │       ├── canvas.js        # Facade ReviewCanvas wrapping drawBoxes/renderBboxes/renderThumbCanvas/handleCanvasClick
│       │       ├── canvas-rendering.js # drawBoxes(), renderBboxes(), renderThumbCanvas(), handleCanvasClick() scaling 72 DPI via scaleRatio
│       │       ├── block-context-menu.js # BLOCK_CONTEXT_MODALS_HTML, setupBlockContextMenu(), merge/split engine
│       │       ├── undo-redo.js     # pushHistory(), performUndo/Redo, setupUndo()
│       │       ├── keyboard-shortcuts.js # COMMAND_HANDLERS, setupKeyboardShortcuts()
│       │       ├── text-tracking-engine.js # TextTrackingEngine.getHighlightBBox()
│       │       └── index.js         # Final orchestrator: logs new shell init, syncs AppStore, ensures panels setup after pywebview ready, wraps saveBlockSilently
│       └── vendor/
│           └── marked.min.js        # Markdown parser (third-party)
│
├── data/
│   └── Quran.json                   # Complete Quran dataset {id: {text, surah, surah_number, ayah_number, ...}}
│
├── locro/                           # Locro ScreenAI python package (ScreenAI class)
│   └── ...
│
└── table_detector/                  # Original engine folder (kept for backward import, new is backend/table/engine)
    ├── README.md
    └── *.py
```

---

## Backend Architecture

### Core

#### `backend/core/config.py` – ConfigManager
- **Purpose:** Decide where app data lives (projects, settings).
- **Key methods:**
  - `_get_default_appdata_dir()` → `%APPDATA%/The_Arabic_OCR` on Windows, `~/AppData/Roaming/...` fallback
  - `get_data_path()` reads `meta_config.json` `{data_path: ...}` if exists and is dir, else default
  - `change_data_path(new_path)` moves `old_path/projects` to `new_path/projects` (merges if target has content), writes meta_config
  - `auto_migrate_legacy_data()` on first run moves local `./projects` to AppData if it has content
- **Why:** Allows user to change storage location via settings.

#### `backend/core/projects.py` – ProjectManager
- **Thread-safe** via `RLock`, **atomic writes** (write to `.tmp`, `fsync`, `os.replace`)
- **Methods:**
  - `create_project(metadata)` → UUID, creates `images/` folder, `project.json` with `id, created_at, metadata, pdf_path, pdf_hash, pages=[], dictionary=[]`
  - `list_projects()` skips non-dirs, loads each project.json, returns summary `{id, title, author, created_at}`
  - `load_project(id)` reads `project.json` with corruption handling
  - `update_project(id, data)` calls `_save_project_file` (backup to `project_backup.json`)
  - `update_project_metadata(id, new_meta)` merges dicts
  - `delete_project(id, delete_files)` either `rmtree` or rename json to `.disabled`
  - `delete_page(id, page_index, delete_files)` pops page, deletes `images/page_X.jpg` and `raw_ocr/page_X.json` variants
  - `hash_password`, `verify_password` PBKDF2HMAC 200k iterations
  - `load_app_settings` / `save_app_settings` → `projects/app_settings.json` (global shortcuts, user_name, blockFontSize, etc.)
  - `save_raw_ocr(id, page_index, data)` → `raw_ocr/page_X.json` atomic write (pristine backup for tracking)
  - `load_raw_ocr(id, page_index)` → tries raw file, fallback to current `ocr_data`
- **Data persistence diagram** in Data Models section.

#### `backend/core/pdf.py` – PDFProcessor
- `get_pdf_hashes(pdf_path)` reads file in 64KB chunks, returns `{md5, sha1, sha256}`
- `process_pdf(pdf_path, output_dir, progress_callback)`:
  - `fitz.open(pdf_path)`, for each page `pix = page.get_pixmap(matrix=fitz.Matrix(2.0,2.0))` (≈200 DPI), saves `page_{index}.jpg`
  - Returns `pages_info[]` with `pdf_index, image_path, width, height, native_width=page.rect.width, native_height=page.rect.height, logical_index, status, ocr_data=[]`
- `extract_pdf_range(src, start, end, out)` helper used for chunking PaddleOCR (max 200 pages per chunk)

#### `backend/core/text.py` – ArabicTextCleaner
Config-driven cleaning (`text_features` from project metadata):
- `remove_kasheeda`: `ـ` removal
- `clean_extra_lines`: `\n+ → \n`
- `normalize_hamza`: `[أآإ] → ا`
- `numbers_option`: `to_arabic` (Hindi→Arabic) or `to_hindu` via translation tables
- `tanween_option`: `before_alf` vs `on_alf` (`اً ↔ ًا`)
- `remove_all_tashkeel` vs `remove_tashkeel_keep_tanween`
- `fix_punctuation`: no space before `[!؟?.؛؛,:،]`, no space after `([«`, no space before `)]»`, quotes `" • "` → `"•"`, dashes
- `fix_waw`: `(^|\s)و\s+ → \1و`
- `superscript_footnotes`: `(1) → <sup>(1)</sup>`
- `clean_double_spaces`: ` + → space`

Called in `OCRService.clean_existing_elements` for every block text and table cells.

#### `backend/core/quran.py` – QuranHandler
- Loads `data/Quran.json` (dict of ayahs)
- `_normalize_text(text)`: remove tashkeel regex, unify `[أإآٱ]→ا, [ىئ]→ي, ة→ه, ؤ→و`, white-list `[\u0621-\u064A\s]`, collapse spaces
- `get_surahs()` returns unique surahs list
- `search_text(query)`:
  1. Exact substring (1000 points)
  2. Sliding window 4-word chunks if len>=3 (5 or 10 points)
  3. Fuzzy difflib for short queries (ratio>0.75 → 200 pts, word>0.8 → 50 pts)
  4. Gap-fill: if results have gaps <=5 ayahs in same surah, fill missing ayahs inheriting score
  5. Group consecutive ayahs into blocks, sort blocks by max score, flatten, return top 50
- `get_range(surah_id, from, to)` simple filter
- `format_insertion(ayah_ids, with_citation)` → `﴿ text ۝٠١ ... ﴾ [Surah :start-end]` with Arabic numbers via `_to_arabic_number`

### OCR Pipeline

#### `backend/core/ocr/handler.py` – OCRHandler
Central to **coordinate system**. See Data Models for explanation.

`standardize_page_blocks(raw_blocks, native_w, native_h, current_dpi)`:
- If `geometry` present (`center_x, center_y, width, height` percentages) → converts to absolute bbox: `cx = center_x * native_w`, `w = width * native_w`, etc.
- Else if `bbox`/`coordinate` present (absolute but at engine DPI) → scales to 72 DPI: `bbox * (72/current_dpi)`, then computes geometry as percentages: `center_x = (x1+w/2)/native_w`
- Does this at all levels: Block, Line, Word (preserves `confidence` if present)
- Normalizes category via `capitalize()` fallback to `Text`, preserves `table_structure` if present
- Returns standardized blocks with `bbox` at 72 DPI native space, `geometry` as percentages, `lines[]` with `words[]`

#### `backend/core/ocr/service.py` – OCRService (new, removes duplication)
- `standardize_and_clean(raw_blocks, page_data, engine_dpi, text_config, category_formatting)`:
  1. Calls `handler.standardize_page_blocks` with `native_w/h` from `page_data`
  2. Cleans `text` via `ArabicTextCleaner(text_config)`
  3. Applies category formatting defaults (`dir`, `align`) if missing
- `clean_existing_elements` alias for backward compat (used by old `_apply_cleaning_to_elements`)

Previously `main.py` had this logic duplicated in 4 trigger methods → now single source.

#### `backend/core/ocr/paddle.py` – PaddleOCRClient
- `get_limits()` reads `paddle_limits.json` `{date, trials_left}` per day, default 3
- `decrement_limit()`
- `_create_session()` sets User-Agent, Referer, Origin, gets `aistudio.baidu.com/paddleocr` to seed cookies
- `_generate_bce_headers()` builds BCE auth v1 HMAC signature for Baidu Cloud Storage upload
- `process_pdf_chunk(file_path, window)`:
  1. Request BOS credentials via `GET /paddlex/v3/ocr/upload/bosacl?fileOriginName=...`
  2. Upload to `https://{bucket}.bj.bcebos.com{key}?uploads=` (init → PUT part → complete)
  3. Create task `POST /paddlex/v3/ocr/tasks` with `parseModel: PaddleOCR-VL-1.6`
  4. Poll `POST /tasks/batch` every 4s, emits progress via `window.evaluate_js("window.onPaddleProgress(...)")` if window provided
  5. Detail `GET /tasks/{id}/detail`, parse `parsingResult` JSON → `layoutParsingResults[]`
- `parse_paddle_to_app_format(paddle_pages, project_pages, start_idx)`:
  - Scales Paddle's internal canvas `width/height` to target 200 DPI UI: `target_w = (native_w/72)*200`, `scale_x = target_w / json_w`
  - Maps `block_label` to category (table/image/title/text)
  - Returns app blocks with scaled bbox at 200 DPI (later re-standardized to 72 DPI via service)

#### `backend/core/ocr/google_lens.py` – GoogleLensOCR
- `max_workers` ThreadPool, `_extract_single_sync(image_path)`:
  - Creates new `asyncio.new_event_loop()` per thread (to avoid pywebview's loop collision), `LensAPI().process_image(..., output_format='detailed')`
  - Returns `{"text": full, "detailed_blocks": [...], "success": True}`
- `extract_batch(image_paths, progress_callback)` uses `ThreadPoolExecutor` + `as_completed`, keeps order via index

#### `backend/core/ocr/locro.py` – Locro offline
- `get_screen_ai()` → `ScreenAI()` (requires Chrome installed)
- `run_locro_ocr(image_path)` parses `res.to_dict()` → `pages[].blocks[].lines[].words[]` with `bounding_box {x,y,width,height}`
- Maps block_type to category, computes geometry percentages, aggregates block bbox from lines, concatenates line texts

#### `backend/core/ocr/llm.py` – LLM OCR
- Prompt template: instructs model to return JSON with `elements[]` each `bbox [x_min,y_min,x_max,y_max]` 0-1000 normalized, category, text (Markdown/HTML/LaTeX), reading order
- Handles API key routing via env vars: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, etc. Custom provider uses `api_base`
- `extract_page(image_path, llm_config)`: loads image via Pillow, base64 encodes, builds `messages` with text prompt + image_url, calls `litellm.completion(..., temperature=0.0, api_base?)`, cleans markdown fences, parses JSON

### Table Engine

#### `backend/table/handler.py` – TableHandler
3-tier strategy (tries in order until grid found):

1. **Native PDF vectors** (`extraction_method in auto/native`):
   - Opens PDF via fitz, gets `page.get_drawings()`, checks rects intersecting table bbox, draws to `vector_mask`, dilates, calls `line_grid_detector.detect_grid(mask)`
   - If found, converts cols/rows from image pixels back to 72 DPI: `cols_x = (x/scale_x)+tx1`

2. **Word coordinates** (`coordinates`):
   - Collects word bboxes from `table_block.lines[].words[]`, converts to local crop pixels, finds columns via `column_finder.find_columns(blobs, crop_width)`, groups into paragraphs via `row_grouper`, builds row bands via `row_reconciler`
   - Produces cols as band boundaries + tx1/tx2, rows as band boundaries + ty1/ty2

3. **Image smear / morphology** (`smear`):
   - Crops full image to table bbox, `orchestrator.preprocess.preprocess(crop)["binary"]`, tries `line_grid_detector.detect_grid(binary)` for ruling lines
   - If no grid, `blob_detector.find_blobs(binary)`, then same column/row logic as tier 2 (whitespace method)

After grid:
- Sorted unique `cols_x`, `rows_y`
- For each cell `(r,c)` bbox `[cols_x[c], rows_y[r], cols_x[c+1], rows_y[r+1]]`, extracts text via `text_retriever.extract_text_for_bbox(raw_ocr, bbox)` (pristine raw OCR, preserves reading order)
- Builds `cells_72dpi[]` with `row, col, row_span=1, col_span=1, bbox, text`
- Sets `table_block['table_structure'] = {rows, cols, cols_x, rows_y, cells, method}` and `text = "\n".join(all_cell_texts)`
- Saves project

#### `backend/table/engine/` – Algorithms (kept as-is)
Each file heavily commented in original `table_detector/README.md`:
- `blob_detector.py`: connected components, median line height
- `column_finder.py`: x-projection histogram gaps
- `line_grid_detector.py`: Hough lines or morphological line detection
- `preprocess.py`: adaptive threshold, dilation
- etc.

### Export System

#### `backend/export/shared.py` (30k+ lines, heart of export)
Contains ALL helpers previously scattered:

- Constants: `TEXT_CATEGORIES`, `SKIP_CATEGORIES`, regexes `_BLOCK_BOUNDARY_RE`, `_TAG_RE`, `_MD_HEADER_RE`, `_ARABIC_CHAR_RE`, etc.
- Direction detection: `_detect_text_direction()` counts Arabic vs Latin chars, `_extract_html_dir()` parses `dir=` or `direction: rtl`
- Alignment: `_extract_html_align()` parses `text-align` or `align=`
- Line spacing: `_extract_html_line_spacing()`, margin bottom/top
- Text stripping: `_strip_markdown_and_tags()` converts `\n→space`, `<br>→\n`, strips tags, MD bold/italic
- Block splitting: `_split_block_paragraphs()` splits on `</p></div></li>`
- `format_display_text()` = strip each paragraph then join with `\n`
- Color: `_css_color_to_hex()` handles `#abc`, `#aabbcc`, `rgb()`, named colors, `_extract_css_colors()` for bg/fg
- Style from tag: `_style_from_tag(tag, attrs)` returns dict `{bold, italic, underline, strike, superscript, subscript, color, highlight, font_family, font_size, dir, align}` parsing `<b>`, `<i>`, `<font>`, `style="..."`
- Inline parser: `_InlineRunParser(HTMLParser)` walks HTML, stack of styles, toggles bold/italic on `**`/`__`, produces runs list `[(text, style), ...]` with `\n` for `<br>`
- `parse_inline_runs(text)` cleans MD headers, converts `\n→space`, feeds parser
- DOCX BiDi helpers:
  - `_set_paragraph_spacing()`, `_set_line_spacing()`
  - `_add_page_break()`, `_add_page_number_label()`
  - `_set_section_rtl(section, is_rtl)` adds `w:bidi` to sectPr
  - `_set_style_rtl(style, font, size, is_rtl)` sets Normal style pPr `w:bidi` and rPr `w:rFonts` ascii/hAnsi/cs, `w:sz` and `w:szCs` (Complex Script), `w:rtl`
  - `_set_run_font_and_bidi(run, font, size, is_rtl)` sets rPr `w:rFonts`, `w:sz`+`w:szCs`, `w:rtl`+`w:cs`
  - `_set_table_no_borders()`, `_set_row_height()`, `_set_cell_width()`, `_set_cell_valign()`
  - `_apply_poetry_paragraph_layout_v169()` ensures `w:bidi` first in pPr
  - `_fill_poetry_cell()` writes text into poetry table cell with `lowKashida` justify, bottom valign, soft return (Shift+Enter) `w:br` to stretch hemistich
  - `_parse_poetry_lines(el)` prefers `table_structure` cells (handles 2-col and 3-col), fallback splits `text` on `<br>` and `|`
  - `_add_poetry_docx(doc, el, cat, font, size, rtl, cat_fmt)` builds borderless Word table: `شعر عمودي` 3-col [7.2cm 45%, 1.6cm 10%, 7.2cm 45%], `شعر متدرج` 2-col staggered 7.5cm each, exact row height `size*1.6*20` twips, soft return hidden
  - `_set_run_highlight_hex()` uses raw OOXML `w:shd` for exact colors
  - Paragraph layout: `_PYTHON_DOCX_ALIGN_MAP`, `_OPENXML_JC_MAP`, `_PPR_CHILD_ORDER` for XSD sequence compliance, `_reorder_pPr()` sorts pPr children, `_apply_paragraph_layout()` flips left/right when `w:bidi=1` because Word flips jc visually
  - `_add_formatted_paragraph()` builds docx paragraph from inline runs, handles per-paragraph dir/align detection, spacing, first-line indent only for `Text` with standard right alignment

#### `backend/export/json_export.py`
```python
def export_json(project, page_indices, output_path):
    pages = [project['pages'][i] for i in page_indices]
    json.dump({project_id, metadata, pages}, ...)
```
Straightforward.

#### `backend/export/txt_export.py`
- Loops pages, for each block:
  - Skip `SKIP_CATEGORIES`
  - Poetry: `_parse_poetry_lines` → `right | left` lines for عمودي, staggered for متدرج
  - Table: builds grid `num_rows x num_cols`, marks covered for spans, extracts cell text stripping `<br>`, joins with `table_separator` (default `\t`)
  - Text: `format_display_text(raw)` if `formatted` else raw
- Appends page separator `— صفحة X —`

#### `backend/export/docx_export.py`
Fixed in rebuild: **explicit imports** of private helpers (since `import *` skips `_`-prefixed). Imports list includes all `_set_*`, `_parse_*`, etc. plus constants.

`export_docx(project, page_indices, output_path, opts)`:
- Parses opts: `font_name`, `font_size`, `line_spacing`, `para_indent`, `space_after`, `page_numbering` (`none/pdf/logical`), `page_break`, `page_size` (A4/A5/Letter), `landscape`, `rtl`, `text_mode`
- Sets section size, margins, orientation, `w:bidi`
- Sets Normal style BiDi
- Loops pages: optional page break, optional number label at top (center, italic, smaller font)
- For each block: skip `SKIP_CATEGORIES`, determine effective RTL from `el.dir` or category formatting or global `rtl`, determine `el_align`
- Poetry → `_add_poetry_docx`
- Table → creates `doc.add_table(rows, cols)`, merges cells via `row_span/col_span`, populates text preserving formatting via `parse_inline_runs` if `formatted`, applies `w:shd` bg color, sets cell dir/align
- Text → splits via `_split_block_paragraphs`, calls `_add_formatted_paragraph` for each which builds runs with bold/italic/etc.

#### `backend/export/html_epub.py`
- `_prepare_html_text(text)`: preserves HTML, converts MD `**bold**` → `<b>`, `*italic*` → `<i>`, `<br>` → `<br/>`
- `_parse_poetry_lines_html(el)` similar to docx but returns HTML strings
- `_generate_poetry_html(el, cat)` builds `<table class='poetry-table poetry-amudi|mutadarij' dir='rtl'>`
- `_generate_body_html(project, page_indices)` loops pages, skips, poetry, table (with `rowspan/colspan`, border/bg/valign/align/dir attrs), else `<p dir=... style=...>` with clean text
- `get_arabic_css()` returns RTL body, poetry tables 45%/10%/45% and 48%/4%/48%, `text-align: justify; text-align-last: justify; text-justify: kashida`, arab-table border collapse, page-break
- `export_html()` injects CSS directly into template replacing `<link>`
- `export_epub3()` builds ZIP: `mimetype` (uncompressed first), `META-INF/container.xml`, `OEBPS/content.opf` (manifest+spine), `css/styles.css`, `chapter1.xhtml`

#### `backend/export/__init__.py`
Router `export_project(project, fmt, page_indices, output_path, opts, logical_start)` → calls specific exporter.

### Collaboration

#### `backend/collab/discovery.py` – LANDiscovery
- Uses `zeroconf` Zeroconf, ServiceInfo, ServiceBrowser
- `register(project_id, name, port, owner, requires_password, page_count)` advertises `_arabocr._tcp.local.` with TXT records
- `browse(timeout)` discovers peers, returns list
- `unregister()`

#### `backend/collab/sync.py` – LANSyncServer/Client
**Crypto:**
- `_derive_key(project_id, password)` → PBKDF2HMAC SHA256 200k, salt = project_id[:16].ljust(16,b'0'), key = base64 urlsafe 32 bytes → Fernet
- `NO_PASSWORD_MARKER = "__no_password__"` for open projects
- `_send_frame(sock, data)` → 4-byte big-endian length + data
- `_recv_frame`, `_recv_exact`

**Server:**
- `start(port=0)` binds `0.0.0.0`, listens 8, thread `_accept_loop`
- `set_broadcasting(enabled)` – if False, rejects new joins
- `_handle_conn(conn)`:
  1. Expects `HELLO:{project_id}`
  2. Sends `CHALLENGE:{nonce hex}` (16 random bytes)
  3. Expects `AUTH:{hmac_hex}` where client HMACs nonce with derived key
  4. Verifies via `hmac.compare_digest`, sends `AUTH_OK` or `AUTH_FAIL`
  5. Stores peer `{username, fernet, last_seen}`, loops `_on_message`
- `_on_message`: decrypts via fernet, updates `last_seen`, `username`, handles `sync_update` (saves project page ocr_data, calls `on_remote_update` callback which pushes to frontend via `evaluate_js`, broadcasts to others), `file_request`, `presence`
- `_send_file`: only on explicit request, checks hash to avoid transfer, sends `file_skip` or `file_chunk` base64
- `broadcast_update(page_index, ocr_data, username, exclude)`: encrypts JSON with fernet per peer, `struct.pack` frame
- `get_active_peers()` returns usernames where `now - last_seen <60`, includes hostname as host

**Client:**
- `connect_and_sync()`: socket, timeout 5s, `HELLO`, waits `CHALLENGE`, HMAC response, waits `AUTH_OK`, starts `_listen_loop` thread
- `_listen_loop`: recv frame, decrypt, `on_remote_update(payload)`
- `send_update`, `send_presence`, `request_file`

**Security:** Password never transmitted, only HMAC proof; Fernet encrypts all JSON.

#### `backend/collab/merger.py` – ProjectMerger
- `validate_password_strength(password)` → checks length, etc.
- `merge(local, remote, resolutions)` → 3-way merge logic for pages/blocks, returns `{merged_project, conflicts}`

### App Facade & Events

#### `backend/app/events.py` – EventEmitter
- Takes `window_getter` lambda
- `_emit(js_fn, payload)` → `json.dumps` + `evaluate_js("window.<fn> && window.<fn>(data)")` with try/except
- `pdf_progress(stage, current, total)` → `window.onPdfProgress`
- `ocr_progress(stage, message, percentage)` → `window.onPaddleProgress` (also legacy positional support in paddle client)
- `lan_update(payload)` → `window.onLanUpdate`

#### `backend/app/api.py` – Api (thin facade)
Replaces old 1068-line monolith. Composition:
- `ConfigManager`, `ProjectManager`, `PDFProcessor`, `OCRService`, `TableHandler`, `QuranHandler`, `LANDiscovery`, `LANSyncServer/Client`, `EventEmitter`
- `_window` set via `set_window(window)`
- **Dialogs:** `select_pdf`, `select_ocr_json`, `request_directory_dialog` → `FileDialog.OPEN/SAVE/FOLDER`
- **Project lifecycle:** `create_project(metadata, pdf_path)` → hash, `process_pdf` with progress callback → `events.pdf_progress`, register LAN if enabled, `load_project`, `get_projects`, `delete_project`, `delete_page`, `update_page_ocr` (status logic reviewed vs pending, broadcasts update)
- **Metadata:** `update_project_metadata`, `reapply_text_processing_to_project` (cleans all blocks via `ArabicTextCleaner` + category formatting)
- **Cleaning helper:** `_apply_cleaning_to_elements` delegates to `OCRService`
- **OCR triggers:** `trigger_paddle_ocr`, `trigger_locro_ocr`, `trigger_google_lens_ocr`, `trigger_llm_ocr` – each:
  1. Loads project, `text_features`
  2. `tmp_dir = mkdtemp`, `fitz.open(pdf)`, loop pages `start..end`
  3. Render pix at DPI (300 for Lens/Locro, 200 for LLM)
  4. Call adapter (`PaddleOCRClient.process_pdf_chunk`, `GoogleLensOCR.extract_batch`, `run_locro_ocr`, `LLMOCRHandler.extract_page`)
  5. For `full_page` mode: clean via `_apply_cleaning_to_elements` and save raw + update project
  6. For `bboxes` mode: spatial redistribution – for each existing block, clear text, for each word in new OCR, check if center point inside block bbox (+10 margin) and cell bbox (+5), assign word to `_temp_lines` or cell `_ordered_lines`, rebuild text, preserve table_structure via backup
  7. Emits progress, finally `rmtree tmp_dir`
- **Quran:** `quran_get_surahs`, `quran_search`, `quran_get_range`, `quran_format_insertion` → delegates to handler
- **Table:** `auto_layout_table_block`, `repopulate_page_text_from_raw` (uses `populate_layout_blocks_text`)
- **Export:** `export_project(project_id, fmt, page_indices, opts, output_dir)` → loads project, determines `safe_title`, if `output_dir` builds path else asks Save dialog via `FileDialog.SAVE`, routes to `export_json/txt/docx/html/epub3`
- **LAN:** `start_lan_sharing`, `stop_lan_sharing`, `scan_lan_projects`, `join_lan_project`, `get_lan_peers`, `get_display_username` (checks app_settings.user_name, then gdrive_token.json account, then getuser), `broadcast_page_update`, `_push_update_to_frontend`, `get_active_collaborators`, `toggle_broadcasting`, `get_network_status`, `merge_projects_api`, `validate_password_strength`
- **Settings:** `get_app_settings`, `save_app_settings`, `get_system_fonts` (Windows registry `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`, fallback list), `get_app_data_path`, `select_app_data_folder` (fixed: uses `FileDialog.FOLDER` not `FolderDialog`), `change_app_data_path` (moves projects, re-inits ProjectManager and TableHandler)
- **Legacy:** `add_ocr_data` tries file path then JSON string

#### `main.py` – Slim entry (70 lines)
- Silences pywebview logger flood that caused `OSError: [WinError 1] Incorrect function` on WinForms without console:
  ```python
  for name in ['webview', 'webview.platforms.winforms', ...]:
      lg.handlers = [NullHandler()]; lg.setLevel(CRITICAL); lg.propagate=False
  logging.raiseExceptions=False
  ```
- `debug=True` re-enabled for devtools (right-click Inspect) but logging silenced, so no flood
- `Api()`, `webview.create_window('OCR Review Tool - Arabic OCR', url='file://frontend/index.html', js_api=api, 1280x800)`, `api.set_window(window)`, `webview.start(debug=True)`

---

## Frontend Architecture

### Design System

#### `frontend/css/tokens.css`
Single source of truth:
- Colors: `--color-primary #3498db`, `--color-primary-dark #2980b9`, `--color-success #27ae60`, `--color-danger #e74c3c`, `--color-warning #f39c12`, `--color-bg #f8fafc`, `--color-surface #fff`, `--color-border #e0e0e0`, `--color-sidebar #1e293b`, etc. Night variants
- Typography: `--font-ar` Arabic stack, `--text-xs 11px` … `--text-2xl 28px`
- Spacing: `--space-xs 4px` … `--space-2xl 32px`
- Radius: `--radius-sm 4px` … `--radius-full 999px`
- Shadows: `--shadow-sm`, `--md`, `--lg`
- Layout: `--sidebar-width 240px`, `--toolbar-height 52px`

#### `frontend/css/base.css`
- `*{box-sizing:border-box;margin:0;padding:0}`
- `body { font-family:var(--font-ar); background:var(--color-bg); color:var(--color-text); direction:rtl; line-height:1.6 }`
- `a`, `button`, `input`, `img` resets
- `.hidden {display:none !important}`
- Custom scrollbars `::-webkit-scrollbar` 8px, thumb `#cbd5e1`
- Keyframes `slideIn`, `fadeIn`

#### `frontend/css/components.css`
- **Buttons:** `.btn-primary` (blue, 9px 16px, 6px radius, hover dark), `.btn-secondary` (white border), `.btn-success` (green), `.btn-danger` (red), `.btn-icon` 34x34, `.btn-plain`
- **Cards:** `.card` white, border, radius-xl, shadow-sm, hover translateY -2px + shadow-md
- **Modals:** `.modal` fixed inset, z 3000, flex center, fadeIn, `.modal-overlay` rgba(0,0,0,0.45), `.modal-box` 440px max 92vw, shadow-lg, slideIn, header flex space-between, close button
- **Forms:** `.form-group`, inputs width 100% 9px 12px border radius-md focus primary, `.form-row` flex gap 16px, `.form-section` border radius-lg padding 18px, `.path-display` bg muted, etc.
- **Options grid:** 1fr 1fr, `.option-item` flex, hidden checkbox, `.option-check` 18px border 2px, checked blue with ✓
- **Switch:** `.switch` 44x24, `.slider` inset 0 #ccc radius 24px, ::before 18px white circle right 3px bottom 3px, checked green translateX -20px
- **Badges & Tables:** `.status-badge`, `.dashboard-table` full width collapse, header bg muted, hover #fdfdfd

#### `frontend/css/layout.css`
- `body.has-sidebar { display:flex; min-height:100vh; background:var(--color-bg); overflow-x:hidden }`
- `#sidebar`: width 240px, bg #1e293b, flex column, transition margin-right/width/transform/visibility, z 1000, shrink 0, shadow, sticky top 0, height 100vh
- `#sidebar.collapsed { margin-right: -240px; transform: translateX(20%); visibility:hidden; pointer-events:none }` (margin alone sometimes not hiding in flex, so added transform+visibility)
- `#sidebar:not(.collapsed) { transform:0; visible; pointer-events:auto }`
- Toggle row, app name, toggle button hover, nav flex column gap 4px, links 12px 20px #cbd5e1 hover #334155, accent #38bdf8, danger #f87171 border top
- Collapsed tab: fixed top 16px right 0, bg sidebar, color #38bdf8, border-right none, radius 6px 0 0 6px, shadow, hidden display none
- Main containers: `.home-main, .settings-container, #main-content { flex:1; min-width:0; max-width:100%; overflow-x:clip }`
- Project info block, sticky-nav-wrapper (sticky top 0, bg, border bottom), compact-settings-nav flex space-between
- Toolbar: flex gap 10px bg surface padding 9px 14px radius-xl shadow-sm, page-nav flex bg-muted padding 4px 10px radius-full, nav-btn 30px circle blue hover dark scale 1.08
- Night mode overrides

#### `frontend/css/style.css`
Now ONLY:
```css
@import url('tokens.css');
@import url('base.css');
@import url('components.css');
@import url('layout.css');
@import url('icons.css');
/* small global tweaks: settings-card, tool-option.disabled, block-content table */
```

#### `frontend/css/icons.css` — SVG icon system
All emoji previously used in toolbars, the sidebar, the dashboard, and the
layout editor have been replaced with inline SVG icons so the whole app
matches the visual language the review page's formatting/table toolbars
already used (`components/formatting/text-formatting.js`'s `TEXT_ICONS`,
`components/tables/table-toolbar.js`'s `TABLE_ICONS`). Three small,
focused pieces make this possible:

- **`frontend/js/icons.js` (`AppIcons`)** — a single shared icon registry.
  Each icon is an 18×18 stroke-based SVG using `currentColor`, so it
  inherits whatever text colour the surrounding button/link already has
  (including night mode, with zero extra CSS). `AppIcons.get('save')`
  returns the SVG string; `AppIcons.inject(selector, name)` prepends it
  into every match. Add new shared icons here — page-local icon sets
  (like `TEXT_ICONS`/`TABLE_ICONS`) stay local since only one toolbar
  uses them.
- **`frontend/js/apply-icons.js` (`AppApplyIcons(root?)`)** — a tiny
  declarative helper that runs on `DOMContentLoaded`. Static HTML opts in
  with `data-icon="name"` (replaces the element's content with
  `icon + <span>label</span>`, preserving any label text) or
  `data-icon-label="name"` (same, for header-style elements). Pages that
  inject new buttons dynamically after load should call
  `window.AppApplyIcons(containerEl)` on the new markup.
- **`frontend/css/icons.css`** — additive layout rules for icon+label
  pairs (`[data-icon-applied]`), plus the `.lan-status-badge` /
  `.status-badge` styling that replaced a few emoji + inline-style badges
  (dashboard LAN status pill, OCR/review status pills). It only adds new,
  narrowly-scoped rules — it never overrides `components.css` or
  `layout.css`.

Pages using this system: `index.html` (home cards), `projects.html`
(back button), `lan.html` + `js/pages/lan.js` (card icons), `review.html`
(the outer toolbar — undo/redo/save/preview/dashboard/search — now
matches the inner sticky formatting toolbar's SVG style), `layout-editor.html`
(all toolbar buttons), and `project-dashboard.html` +
`js/pages/project-dashboard/{collab,progress,table}.js` (header buttons,
LAN status pill, collaborator pills, and OCR/review status badges via a
small local `iconBadge(name, label)` helper).

**Deliberately left as-is:** the plain "✕" close glyph used throughout
modals and the `⋮⋮` drag handle / `✕` delete button inside individual
review blocks — these are monochrome typographic symbols already
consistent with an icon-only look and used identically everywhere, so
touching them would mean editing every modal and every rendered block for
no visual gain. The right-click table context-menu icons in
`js/pages/layout-editor/table-tools.js` and
`js/components/tables/table-editor.js` (`⬆️⬇️➡️⬅️🗑️🔗`) are a flagged
follow-up: they're built as inline JS template strings rather than
declarative markup, so migrating them cleanly deserves its own small pass.

#### `frontend/css/home.css`
- Home page: `.home-main` 40px 32px max 1100px centered, hero h1 28px, p muted
- `.home-cards` grid `repeat(auto-fill, minmax(200px,1fr))` gap 20px, `.home-card` relative bg surface border radius-xl padding 28px 22px cursor pointer hover translateY -3px shadow-md border primary, icon 32px, title 17px bold, desc 13px #777, primary/secondary/neutral top border 3px, badge absolute top 12px left 12px bg primary white pill
- Recent: h2 18px bold, `.recent-card` flex space-between bg surface border ee radius-lg padding 14px 18px hover shadow-md, title 15px, meta 12px #888, progress 120x6 bg ee radius, fill green
- Projects table page: title row flex space-between, search-box 8px 14px border radius-md focus primary, table-wrapper bg surface radius-xl border, `#projects-table` full collapse, th bg-muted padding 12px 16px right 700 #555 border bottom ee, td 13px 16px border bottom f0f0f0, hover #fafafa, progress-cell flex, table-actions flex gap 8px, table-btn 5px 12px radius 5px
- Night overrides

#### `frontend/css/review.css`
- `.review-page { display:flex; height:100vh; overflow:hidden }`
- `#main-content` flex 1 column padding 14px 18px overflow hidden
- Toolbar same as layout but additionally thumbnail wrapper 36x46, thumb image 36x46 cover border 2px primary, canvas absolute, popup on hover 260px border 2px primary radius 8px shadow 28px, hidden until hover
- Editor container flex 1 gap 14px min-height 0 overflow hidden
- Image viewer (hidden), image-wrapper relative inline-block, page-image max 100%, bbox-canvas absolute 100% cursor pointer
- Text editor panel flex 1 column bg white radius 8px border ddd overflow hidden
- Sticky toolbar flex gap 5px padding 7px 10px border bottom eee bg f8f9fa, disabled opacity 0.4, buttons 4px 11px border ccc radius 4px hover primary white
- Formatting toolbar group flex gap 5px wrap, active blue, sep 1px vertical bg ddd
- Color swatch label inline-flex gap 4px, input type color 20px no border
- Editor panels container flex 1 column min-height 0 relative overflow hidden
- Resizable panels relative shrink 0 min-height 60px overflow hidden, handle absolute bottom 0 left 0 right 0 height 10px gradient transparent→rgba(0,0,0,0.06) cursor ns-resize border top e0e0e0 hover gradient primary 0.25
- Toggle layout button absolute 28x22 bg white border 1.5px #2563eb radius 12px shadow 0 2px 8px rgba(0,0,0,0.22) color primary z 150, hover bg primary white scale 1.18
- Side-by-side mode: container flex row, blocks-list-wrapper order 1 flex 1 height 100%!important, crop-section order 2 width 48% height 100%!important border right cbd5e1, handle vertical ew-resize right -6px width 12px gradient to right, viewport height calc(100%-38px)
- Crop section border bottom eee bg fafafa padding 8px 10px 14px height 200px, viewport relative 100% height calc(100%-34px) bg #222 radius 6px overflow hidden, placeholder color #888 flex center, viewer absolute 100% overflow hidden, image absolute top 0 left 0 bg no-repeat transition transform, controls flex gap 5px center margin top 6px buttons 2px 11px border ccc radius 4px hover primary
- Blocks list wrapper flex 1 min-height 80px overflow hidden column, blocks-list flex 1 overflow-y auto padding 10px
- Text blocks: margin bottom 9px border 1.5px e4e4e4 radius 7px padding 8px 10px transition, hover #b0c8e8, active-block border #f1c40f shadow 0 0 0 2px rgba(241,196,15,0.25) bg #fffdf4, block-reviewed border #27ae60, drag-over border primary bg eaf4fd, drag handle grab #ccc hover primary, dragging opacity 0.45, header flex gap 6px margin bottom 5px, label 11px 700 uppercase cursor pointer padding 2px 7px radius 10px bg rgba(0,0,0,0.05) hover 0.12, review-btn 11px 2px 8px radius 10px border ccc bg white color #888 hover green, reviewed bg green white, delete btn 13px 22x22 radius 4px none #ccc flex center hover #e74c3c bg fdecea, content font-size var(--block-font-size,14px) zoom calc(.../14) line-height var(--block-line-height,1.75) outline none min-height 20px radius 4px padding 2px 4px focus #f0f7ff, rendered markdown p/div/h margins via --block-space-before/after
- Category picker fixed bg white border ddd radius 8px shadow 6px 24px rgba(0,0,0,0.15) z 1000 width 180px max-height 70vh overflow-y auto padding 6px 0 font 13px, title 11px 700 #aaa uppercase border bottom eee, item 7px 12px flex gap 8px hover #f0f0f0 active bold, dot 9px circle
- Fullpage overlay fixed inset 1500 bg #1a1a1a flex column, header flex space-between padding 11px 18px bg #2c3e50 white 14px, close btn bg #e74c3c white 7px 14px radius 6px hover #c0392b, body flex 1 overflow auto flex center padding 20px, wrapper relative inline-block, image max-height calc(100vh-100px), canvas absolute 100% cursor pointer
- Quran modal & context menu: context menu hover #f0f7ff #2980b9 bold, tab btn none border none 8px 16px 15px 600 #888 cursor pointer border-bottom 3px transparent hover #333 active #3498db border-bottom-color, result row hover #fdfdfd, text cell Traditional Arabic 24px line 1.8 #2c3e50, table wrapper max-height 350px overflow-y auto border eee radius 8px relative bg white, scrollbar 8px thumb cbd5e1 radius 4px, sticky header thead th top 0 bg #f1f5f9 z 10 shadow 1px 3px rgba(0,0,0,0.1) 13px, load-more btn 100% 12px bg #f8fafc border none border top eee color #3b82f6 bold hover #e2e8f0
- Night mode overrides for review specific

### Core JS

#### `frontend/js/core/api.js`
- `isApiReady()` checks `window.pywebview.api.get_projects`
- `whenReady()` returns Promise that resolves when api ready, listens `pywebviewready` event, fallback poll interval 100ms
- `call(method, ...args)` awaits ready, checks `api[method]` exists, calls
- `AppApi` global with `ready`, `call`, convenience wrappers `getProjects`, `loadProject`, `createProject`, `deleteProject`, `updatePageOcr`, `getAppSettings`, `saveAppSettings`, `exportProject`

#### `frontend/js/core/store.js`
- `listeners Set`, `state {project, pageIndex, appSettings, appDataPath}`
- `emit()` calls each listener with shallow copy
- `AppStore.get()`, `set(partial)` merges, `subscribe(fn)` returns unsubscribe, `setProject`, `setPageIndex`, `setSettings` (also updates `window.__appSettings`)

#### `frontend/js/core/utils.js`
- `escapeHtml(str)` via div textContent
- `debounce(fn, ms)` clearTimeout/setTimeout
- `formatBytes(bytes)` human readable
- `sleep(ms)` Promise
- `AppUtils` global

#### `frontend/js/core/events.js`
- `initEvents()` sets default handlers if page didn't set: `window.onPdfProgress(payload)` logs, updates `#pdf-progress-log` if exists; `onPaddleProgress` handles object or legacy string+percent; `onLanUpdate` logs
- Called immediately and on `pywebviewready`
- `AppEvents.initEvents`

### Components

#### `frontend/js/components/sidebar.js` (robust, with injection)
- `readCollapsedState()` from localStorage `sidebarCollapsed` true/1
- `injectSidebarIfNeeded()`:
  - If `#sidebar` exists, ensures `has-sidebar` class, respects collapsed state, returns existing
  - Else builds HTML string with `currentPath` active detection, `isCollapsed` class, links: Home, Projects, + New Project (trigger-new-project), Settings, Exit danger, project info block (visible only if path includes review) with title/meta placeholders, collapsed tab button (SVG expand-arrow icon via `AppIcons`, see "UI Icon System" above — previously a raw `▷` glyph)
  - Adds `has-sidebar` to body, inserts afterbegin
- `bindSidebarEvents()`:
  - Gets sidebar, toggle, tab, exit
  - If no sidebar warn and return
  - `setCollapsed(collapsed)` toggles class, tab hidden, localStorage set, adds has-sidebar, logs
  - Applies stored state
  - Binds toggle click (toggle collapsed), tab click (expand), exit click (confirm then `close_app` or `window.close`), guards duplicate binding via `_sidebarBound` flag
  - Active link handling
- `initSidebar()` logs, injects, `setTimeout(bind,0)` and `setTimeout(bind,100)` to ensure DOM tick
- Listens `DOMContentLoaded`, `pywebviewready`, and immediate if readyState interactive/complete

#### `frontend/js/components/modal.js`
- `openModal(id)`, `closeModal(id)` toggle hidden
- Delegated click: if target has `modal-overlay` or `modal-close` class, close closest modal
- `AestheticDialog` fallback if not defined: `show(title, contentHtml, onConfirm)` builds overlay with header, body, form-actions Cancel/Confirm, binds close and confirm callbacks

#### `frontend/js/components/notifications.js`
- `showNotif(msg, type='info')` colors map info blue success green error red warning orange, tray `#notif-tray` or creates fixed bottom 18px left 18px flex column-reverse gap 8px, notification div bg color white padding 10px 16px radius 8px font 13px shadow 4px 14px black 0.2 max-width 280px cursor pointer slideIn 0.25s, click to remove, auto remove after 5s
- Globals `showNotif`, `AppNotify.show`

#### `frontend/js/components/toolbar.js`
- `injectToolbar(targetId, isMain)` calls global `injectToolbar` if exists (from text-formatting.js) else fallback minimal toolbar HTML with align right/center/left/justify and dir RTL/LTR buttons
- `AppToolbar.injectToolbar`

### Pages

#### `frontend/js/pages/home.js`
- `initHome()` uses `AppApi.getProjects` or `call('get_projects')`, badge count, recent 4 sorted by `created_at` desc, builds recent-card with title escaped via `AppUtils.escapeHtml`, author, date ar-EG, progress bar pct = reviewed/total, links to `project-dashboard.html?id=`
- Settings modal close handlers
- Listens DOMContentLoaded or pywebviewready

#### `frontend/js/pages/projects.js`
- `initProjects()` calls `renderProjectsTable()`, back btn history.back or index.html, search input filters rows via textContent includes
- `renderProjectsTable()` gets projects, tbody empty, if empty shows no projects row, else sorts, builds tr with title, author, date, total pages, progress bar, actions Open/Delete with data-id, binds Open to dashboard, Delete to `AestheticDialog.deleteConfirm` with remember checkbox (promptDeleteProject, deleteProjectFiles settings) or direct delete, calls `delete_project` and re-render
- Listens DOMContentLoaded/pywebviewready

#### `frontend/js/pages/review/` – Modular review (REAL implementations after breaking monolith, not facades) + FIXED tracking.js duplicate const bug

**`state.js`**: REAL globals `currentProject`, `currentPageIndex`, `selectedBlockIndex`, `multiSelectedBlocks`, `activeEditingIndex`, `cropZoom`, `CROP_MIN/MAX`, `scaleRatioX/Y`, `cropPanX/Y`, `dragSrcIndex`, `BASE_CATEGORIES`, `getCategoryColors()`, `CATEGORY_ARABIC_MAP`, `getCategoryNameAR()`, `getAllCategories()`, `isTableLike()`, `ReviewState` singleton + `syncFromLegacy/syncToLegacy`

**`navigation.js`**: `navigatePage(dir)` (selectBlock -1, activeEditing -1, updateReviewPanel), `moveFocusAndReview(dir)` with auto-review current block, intra-table cell-by-cell navigation via `tds[next]`, block-to-block skipping Picture, scrollIntoView + focus first td or content

**`save.js`**: `saveBlockSilently()` → `pywebview.api.update_page_ocr`, `autoSaveBlock()` checks `autoSaveReview`

**`fontzoom.js`**: `BLOCK_FONT_MIN/MAX/STEP/DEFAULT`, `setupBlockFontZoom()` reads `__appSettings.blockFontSize`, applies via `--block-font-size` CSS var + pct label, `applyBlockFontSize()`

**`crop.js`**: `showCroppedView(bbox)` calculates scaled box `px=x*scaleRatio`, sets `crop-image` backgroundImage to page image, stores boxX/Y/W/H/naturalW/H, reset zoom, `applyCropZoom()` computes fit `min((vw-20)/bw)`, fs, bgW/H, ox/oy, transform, `panCropViewTo(bbox)` preserves zoom, `setupCropControls()` zoom in/out/reset

**`fullpage.js`**: `setupFullPageView()` close btn + canvas click -> handleCanvasClick + renderThumb, `openFullPageView()` shows overlay, draws boxes, `closeFullPageView()` hides

**`panels.js`**: `setupResize()`, `updateSwitchBtnPosition()` positions toggle button at 50% left=cropW in side-by-side else top=cropH left 50%, `setupPanels()`/`setupResizablePanels()` calls setupResize for crop+blocks, loads SideBySide pref, resize listener, toggle button click toggles class + resets inline + persists setting + re-fit crop

**`editor.js`**: REAL full implementations: `updateReviewPanel()` sets total pages, current input, logical display, image src `file://appDataPath/...`, thumb images, onload calculates `scaleRatioX/Y = naturalWidth/native_width`, calls `renderBboxes`, `renderThumbCanvas`, `renderBlocksList`, `showCroppedView(null)`; `updateBlockSelectionUI()` toggles active-block class, re-renders bboxes/thumbs, shows crop; `selectBlock()` clears multiSelected, adds index, calls updateBlockSelectionUI + scrollIntoView; `syncElementFromContent()` handles Table via TableModel.toModel + fingerprint for bg/border changes + text join <br>, else innerHTML; `refreshIndicatorsFor()` toggles block-reviewed + re-renders bboxes/thumbs; `renderBlocksList()` full 200-line: skip Picture, wrapper active/reviewed, drag handle, label with color + getCategoryNameAR, review btn, delete btn, content contentEditable dir/align + category formatting (fontFamily, fontSize, lineSpacing, color, bg, bold, italic, underline), table rendering via TableModel.fromModel with border/bg/valign/dir/align, else marked.parse, focus/blur with preEditSnapshot + tracking immediate + input/keyup/click debouncedTrackingUpdate + blur auto-mark reviewed + pushHistory + autoSave + refreshIndicators; `setupBlocksListDelegation()` single delegated click handles review toggle, delete, label (openCategoryPicker), ctrl/meta multi-select, shift range; `setupBlockDrag()`, `reorderBlocks()`, `deleteBlock()`

**`toolbar.js`**: `setupToolbar()` prev/next click -> navigatePage, undo/redo -> performUndo/Redo, formatting toolbar mousedown preventDefault, data-align buttons with table cell selection via `range.intersectsNode(td)` + style.textAlign + active toggle + sync + autoSave, data-dir similar, thumb-popup canvas click, toolbar-thumb-wrapper click openFullPageView, save-page click force sync active block + disabled + saveBlockSilently + showNotif

**`category.js`**: `handleTableCategoryChange()` with localStorage remember + AestheticDialog, calls `auto_layout_table_block` + reload project, `setupCategoryPicker()` click outside hides, `openCategoryPicker()` builds list from getAllCategories() with color dot + Arabic name, click -> pushHistory + category change + if isTableLike -> handleTableCategoryChange else updateReviewPanel+autoSave, positions above/below based on viewport

**`tracking.js`**: `defaultTrackingConfig`, `savedTrackingConfig` from localStorage, `__trackingConfig`, track-settings-btn toggle menu, forEach cfg-track checkbox checked from config + change listener saves localStorage + immediate updateTrackingHighlight if active, `debounce()`, `updateTrackingHighlight()` via TextTrackingEngine.getHighlightBBox + setTrackingHighlight + panCropViewTo, `debouncedTrackingUpdate`

**`preview.js`**: `escapeHtml()`, IIFE `setupTextPreview()` with buildPreviewHTML() rendering tables via grid + poetry + markdown via marked, renderPreview() innerHTML, text-preview-btn click open, rawToggle change re-render, close click hide, save click collects touched pages via preview-block-chunk data-block-index, syncElementFromContent for tables or textContent vs innerHTML for raw, pushHistory + autoMarkReviewed, Promise.all update_page_ocr + notif + updateReviewPanel, `showNotif()` tray, `window.onLanUpdate` join/leave/edit notifs + updateReviewPanel if same page, `setupDashboard()` dashboard-btn -> project-dashboard.html, `persistBrushEdit()` for brush tool

**`canvas.js`**: Facade ReviewCanvas wrapping drawBoxes etc.

**`canvas-rendering.js`**: REAL: drawBoxes(), renderBboxes(), renderThumbCanvas(), handleCanvasClick() scaling 72 DPI via scaleRatio

**`block-context-menu.js`**: BLOCK_CONTEXT_MODALS_HTML, setupBlockContextMenu(), mergeSelectedBlocks()

**`undo-redo.js`**: pushHistory(), performUndo/Redo, setupUndo()

**`keyboard-shortcuts.js`**: COMMAND_HANDLERS, setupKeyboardShortcuts()

**`text-tracking-engine.js`**: TextTrackingEngine.getHighlightBBox()

**`index.js`**: Final orchestrator: logs new shell init, syncs AppStore, ensures panels setup after pywebview ready, wraps saveBlockSilently

#### Other legacy JS kept for compatibility (now modularized but still used)

- `canvas-rendering.js`: `drawBoxes(canvas, data, selected)`, `renderBboxes`, `renderThumbCanvas`, `handleCanvasClick` – scales 72 DPI bbox via `scaleRatioX/Y` to image natural size, draws colored rects per category
- `undo-redo.js`: `pushHistory`, `performUndo/Redo`, history stack per page, limit from settings
- `keyboard-shortcuts.js`: `COMMAND_HANDLERS`, `isTypingInPlainFormField`, arrow navigation, Ctrl+S save, etc.
- `block-context-menu.js`: `BLOCK_CONTEXT_MODALS_HTML`, `setupBlockContextMenu()`, merge/split engine – right-click on block shows menu, merge selected blocks, split block from cursor with modal showing image container with red split line and axis radio
- `text-tracking-engine.js`: `getHighlightBBox(contentEl, element, config)` – finds caret position, maps to word/line/cell bbox via range, returns highlight
- `table-model.js`: `TableModel.toModel(table)` walks DOM table to abstract model `{numRows, numCols, cells: [{dom, r, c, rowSpan, colSpan}]}`, `fromModel(table, model)` builds DOM
- `text-formatting.js`: `injectToolbar(targetId, isMain)` builds toolbar HTML with formatting groups (bold, italic, underline, strike, sup/sub, align, dir, color, highlight, font family/size, etc.)
- `quran.js`: Quran modal logic – tabs, search input, surah select, ayah from/to, fetch, table rendering with checkboxes, select-all, load-more pagination, insertion with citation

---

## Data Models & Coordinate System

### Coordinate System – Critical

- PDF native: 72 DPI points (`page.rect.width/height`)
- Rendering for UI: 200 DPI target. Original code used zoom 2.0 (≈144 DPI) but formulas assume 200 DPI target: `targetW = (nativeW/72)*200`
- **Stored bbox:** At 72 DPI native space (points), e.g. `[120.5, 340, 850, 480]` – this is what `project.json` contains after standardization via `OCRHandler`
- **Geometry:** Relative percentages `{center_x, center_y, width, height, angle_deg}` where `center_x = (x1+w/2)/nativeW`, etc. Used for spatial redistribution in bboxes mode
- **LLM normalized:** Model returns 0-1000, converted to UI 200 DPI via `scale_x = ui_w/1000`
- **Paddle internal:** Has its own canvas width/height, scaled to target 200 DPI via `scale_x = target_w / json_w`
- **Canvas rendering:** `scaleRatioX = img.naturalWidth / nativeW`, `scaleRatioY = img.naturalHeight / nativeH` – converts 72 DPI bbox to image pixel coords for drawing

**Always:** Standardize via `OCRHandler.standardize_page_blocks(raw, native_w, native_h, current_dpi)` – handles both geometry and bbox inputs.

### Project JSON Schema

```
projects/
  <uuid>/
    project.json
    images/
      page_0.jpg (rendered at ~200 DPI)
    raw_ocr/
      page_0.json (pristine backup)
  app_settings.json (global)
```

`project.json`:
```json
{
  "id": "uuid",
  "created_at": "ISO",
  "metadata": {
    "title": "...",
    "author": "...",
    "owner": "username",
    "logical_start": 1,
    "text_features": { "remove_kasheeda": true, ... },
    "category_formatting": { "Text": {"dir":"rtl","align":"right","fontFamily":"..."} },
    "lan_enabled": false,
    "lan_password_hash": "salt:hash",
    "lan_broadcasting": true
  },
  "pdf_path": "/abs/path.pdf",
  "pdf_hash": "sha256",
  "pdf_hashes": {"md5","sha1","sha256"},
  "pages": [
    {
      "pdf_index": 0,
      "image_path": "page_0.jpg",
      "width": 1440,
      "height": 2000,
      "native_width": 595.0,
      "native_height": 842.0,
      "logical_index": null,
      "status": "pending|reviewed",
      "ocr_data": [ blocks ]
    }
  ],
  "dictionary": []
}
```

**Block:**
```json
{
  "order": 1,
  "category": "Text|Title|Table|Picture|...",
  "bbox": [x1,y1,x2,y2] at 72 DPI,
  "geometry": {"center_x":0.5, "center_y":0.3, "width":0.8, "height":0.1, "angle_deg":0},
  "text": "بسم الله<br>...",
  "reviewed": false,
  "dir": "rtl",
  "align": "right",
  "lines": [
    {
      "text": "line text",
      "bbox": [...],
      "geometry": {...},
      "words": [
        {"text":"word", "bbox":[...], "geometry":{...}, "confidence":0.99}
      ]
    }
  ],
  "table_structure": { // if Table
    "rows": 3, "cols": 4,
    "cols_x": [x0,x1,x2,x3,x4],
    "rows_y": [y0,y1,y2,y3],
    "cells": [
      {"row":0,"col":0,"row_span":1,"col_span":2,"bbox":[...],"text":"...","align":"","dir":"","border":"","bg_color":"","valign":""}
    ],
    "method": "native_vectors|coordinates|smear_whitespace|smear_lines"
  }
}
```

### App Settings (`app_settings.json`)
```json
{
  "user_name": "Custom display name",
  "blockFontSize": 14,
  "autoSaveReview": true,
  "autoMarkReviewed": true,
  "reviewSideBySideMode": false,
  "customCategories": {"شعر عمودي":"#ff0000", "حاشية":"#00ff00"},
  "shortcuts": {...},
  "promptDeleteProject": true,
  "deleteProjectFiles": true
}
```

---

## Key Workflows

### Create Project
1. JS `select_pdf()` → `pywebview.api.create_project(metadata, pdf_path)` → Python `Api.create_project`
2. `pdf_processor.get_pdf_hashes`, `process_pdf` with `events.pdf_progress` → `window.onPdfProgress`
3. Save `project.json`, optionally `start_lan_sharing`
4. Return project → JS navigates to dashboard

### OCR (example Paddle)
1. Dashboard → `trigger_paddle_ocr(project_id, start, end)` → Python
2. Check limits, `tmpdir`, loop chunks `start..end` max 200 per chunk
3. `extract_pdf_range` → `process_pdf_chunk` (BOS upload + polling) → `parse_paddle_to_app_format` (scale to 200 DPI)
4. For each page: `OCRService.clean_existing_elements(ocr_data, page_data, 200 DPI)` → `save_raw_ocr` + `update_project`
5. Emit `onPaddleProgress` completed

### BBoxes Mode (Google Lens / Locro)
- Existing layout blocks cleared text, then for each new word, center point `wx = geometry.center_x * native_w`, check if point inside existing block bbox (+10 margin) and cell bbox (+5), assign to `_temp_lines` or cell `_ordered_lines`
- Sort lines by y, rebuild `text`, preserve table_structure via backup before cleaning

### Review
1. `review.html?id=...` → `initApp()` parses `id` and `page`, loads `appDataPath`, loads project via `load_project`
2. Injects toolbar, sets sidebar title/meta (guarded + delayed retry), setups toolbar, crop controls, fullpage, category picker, resizable panels, undo, block font zoom, keyboard shortcuts, block context menu, blocks list delegation, network badge
3. `updateReviewPanel()` → sets total pages, current input value, logical display, image src `file://{appDataPath}/projects/{id}/images/{image_path}`, sets thumb images, `img.onload` calculates `scaleRatioX/Y = naturalWidth / native_width`, calls `renderBboxes`, `renderThumbCanvas`, `renderBlocksList`, `showCroppedView(null)`
4. Block selection: `selectBlock(index)` → `multiSelectedBlocks` set, `updateBlockSelectionUI` toggles `active-block` class, re-renders bboxes/thumbs, `showCroppedView(bbox)`
5. Editing: `contentEditable` focus → `activeEditingIndex = index`, `selectBlock`, removes disabled from toolbar, saves pre-edit snapshot for undo, `updateTrackingHighlight`; input/keyup/click → debounced tracking; blur → `syncElementFromContent`, auto-mark reviewed, `pushHistory`, `autoSaveBlock`, `refreshIndicatorsFor`
6. Canvas click → `handleCanvasClick` → finds block containing point, selects
7. Crop viewer: `showCroppedView(bbox)` → calculates scaled box `px = x1*scaleRatioX`, sets `crop-image` backgroundImage to page image src, stores `boxX/Y/W/H/naturalW/H`, `cropZoom=1.0`, `applyCropZoom()` computes fit `min((vw-20)/bw,(vh-20)/bh)`, `fs=fit*cropZoom`, `bgW=nw*fs`, `ox=vw/2-(bx+bw/2)*fs`, sets width/height/bgSize/transform; `panCropViewTo(bbox)` similar without resetting zoom

### Export
- `export_project` → loads project, `safe_title`, if `output_dir` builds path else Save dialog via `FileDialog.SAVE`, routes to format
- DOCX: builds Document, section size, margins, RTL bidi, Normal style, loops pages with optional page break and number label, handles poetry, tables (merge, formatting), formatted paragraphs
- HTML/EPUB: builds body HTML via shared helper, injects CSS or packages ZIP

---

## How to Extend

### Add new OCR engine

1. Create `backend/core/ocr/my_engine.py` with function `def extract(image_path, **kwargs) -> List[Dict]` returning blocks like `{"bbox":[x1,y1,x2,y2], "text":"...", "category":"Text", "lines":[...]}`
2. In `backend/core/ocr/__init__.py` export it
3. In `backend/app/api.py`:
   - Import
   - Add method `trigger_my_engine_ocr(self, project_id, start_idx, end_idx, mode)` similar to others: tmpdir, fitz render, loop pages, call extract, clean via `self._apply_cleaning_to_elements(blocks, text_config, page_data, engine_dpi)`, save raw, update project, emit progress
4. In `frontend/project-dashboard.html` add option in engine select, and JS to call `pywebview.api.trigger_my_engine_ocr`
5. Use `OCRService` to standardize – don't duplicate cleaning

### Add new export format

1. Create `backend/export/my_format_export.py` with `def export_my_format(project, page_indices, output_path, opts=None): ... return output_path`
2. Use helpers from `shared.py`: `SKIP_CATEGORIES`, `_strip_markdown_and_tags`, `format_display_text`, `_parse_poetry_lines`, etc.
3. Register in `backend/export/__init__.py`: import and add to `export_project` router
4. In `backend/app/api.py:export_project` add `elif fmt == 'my_format': return export_my_format(...)`
5. In frontend export page add button + JS calling `export_project` with fmt

### Add new block category

1. In `frontend/js/pages/review/state.js` and `frontend/js/pages/layout-editor/state.js` add `'MyCategory':'#color'` to `BASE_CATEGORIES` (also add to `frontend/js/pages/project-settings.js` `BASE_CATEGORIES`)
2. Add Arabic name in `CATEGORY_ARABIC_MAP` in all those files
3. Backend `OCRHandler.categories` list add `'MyCategory'` (capitalized)
4. Optionally add default formatting in `category_formatting` settings UI (`settings.js`)
5. Export: add handling in `docx_export.py` / `html_epub.py` if special rendering needed (like poetry)

### Add new settings option

1. Add UI in `frontend/settings.html`
2. In `frontend/js/settings.js` read/write via `get_app_settings` / `save_app_settings` → `app_settings.json`
3. Use setting in relevant backend: `text_features` for cleaner, or frontend via `window.__appSettings`

---


## Interface localization (i18n)

The interface language is a global user preference, not a project setting. The supported languages are Arabic (`ar`, RTL), English (`en`, LTR), and German (`de`, LTR). The Settings page updates `window.__appSettings.interfaceLanguage`; `saveAppSettings()` persists it through the existing pywebview API.

### Files and responsibilities

```text
frontend/js/i18n/
├── i18n.js              # language lookup, persistence integration, document lang/dir application
└── locales/
    ├── ar.js            # Arabic catalog and RTL metadata
    ├── en.js            # English catalog and LTR metadata
    └── de.js            # German catalog and LTR metadata
```

`bootstrap.js` runs from each page head before styles load. It reads the cached `localStorage.interfaceLanguage` value and sets the document `lang` and `dir` before first paint. `i18n.js` then reconciles that cache with persisted app settings after pywebview becomes ready.

`i18n.js` exposes `window.AppI18n`:

- `AppI18n.t(key, replacements)` resolves a message, with Arabic as the fallback.
- `AppI18n.setLanguage(code)` validates, applies, and persists a supported language.
- `AppI18n.applyDocumentLanguage()` sets `<html lang>` and `<html dir>`, mirrors the shell through direction-aware CSS, and resolves `data-i18n`, `data-i18n-placeholder`, and `data-i18n-title` attributes.
- `AppI18n.supportedLanguages()` returns the selector-ready metadata list.

Use declarative keys for static markup, for example `<span data-i18n="nav.projects">المشاريع</span>`. Use `AppI18n.t('key')` for messages created in JavaScript. Do not translate OCR output, project titles, user-entered content, category names, or persisted data values.

### Add a language

1. Add `frontend/js/i18n/locales/<code>.js`. Register `window.AppLocales.<code>` with `meta` (`name`, `nativeName`, `direction`) and a complete `messages` object. Use `direction: 'rtl'` only where appropriate.
2. Add the locale script before `js/i18n/i18n.js` in every frontend HTML entry point; retain `js/i18n/bootstrap.js` immediately after the character-set meta tag. This explicit loading is intentional: the app uses regular scripts rather than a bundler.
3. Add an option to the `#interface-language` selector in `frontend/settings.html` and translate its label in every catalog.
4. Mark static UI with `data-i18n`; translate dynamically generated labels through `AppI18n.t()`. Keep keys semantic and grouped by feature (`nav.*`, `settings.*`), rather than using source text as keys.
5. Verify both the new language and Arabic. Check `document.documentElement.lang`, `document.documentElement.dir`, sidebar placement/collapse behavior, form alignment, dialogs, and a reload after saving settings.

Direction belongs to locale metadata, never scattered `language === ...` checks. CSS should prefer logical properties (`margin-inline`, `padding-inline`, `text-align: start/end`) for new UI. Existing direction-specific rules are isolated in the shared styles as compatibility overrides.

## Debugging & PyWebView Quirks

### PyWebView Logging Flood (Fixed)
- **Symptom:** Console floods with `[pywebview] before_load event fired...`, then `OSError: [WinError 1] Incorrect function` from `logging/__init__.py emit stream.write`
- **Root Cause:** When app runs via WinForms without console (pythonw), stderr handle is invalid. `webview` logger is `logging.getLogger('webview')` with default StreamHandler writing to stderr → fails.
- **Fix in `main.py`:**
  ```python
  for name in ['webview', 'webview.platforms.winforms', ...]:
      lg = logging.getLogger(name)
      lg.handlers = [NullHandler()]
      lg.setLevel(CRITICAL)
      lg.propagate=False
  logging.raiseExceptions=False
  webview.start(debug=True) # debug=True re-enabled for devtools, logging silenced so no flood
  ```
  Previously we had `debug=False` to hide flood, but user lost devtools. Now `debug=True` + silenced logger works.

### FolderDialog AttributeError (Fixed)
- **Error:** `AttributeError: module 'webview' has no attribute 'FolderDialog'` in `select_app_data_folder`
- **Fix:** Use `webview.FileDialog.FOLDER` not `FolderDialog`. Now:
  ```python
  result = self._window.create_file_dialog(webview.FileDialog.FOLDER)
  ```

### DOCX Export NameError (Fixed)
- **Error:** `NameError: name '_set_section_rtl' is not defined` in `docx_export.py:62`
- **Cause:** `from .shared import *` skips underscore-prefixed names (Python rule). All helpers `_set_*` were missing.
- **Fix:** Explicit import list in `docx_export.py` header includes all private helpers.

### Sidebar Null & Collapse (Fixed)
- **Error:** `review.js:85 TypeError: Cannot set properties of null (textContent)` at `sidebar-proj-title`
- **Cause:** New `components/sidebar.js` didn't inject sidebar if missing; old injector removed from HTML; `review.js` assumed element exists.
- **Fix:**
  - `components/sidebar.js` now injects HTML if missing, always adds `has-sidebar`, reads collapsed state for both `'true'` and `'1'`, binds toggle/tab with guard `_sidebarBound`, logs for debug
  - `review.js` guarded with `if (titleEl) titleEl.textContent = ...` + delayed retry after 300ms
  - `layout.css` collapsed now also `transform + visibility + pointer-events` for reliable hiding in flex

### General PyWebView Tips
- JS → Python: `await window.pywebview.api.method(args)` returns promise; must await. Ensure method exists, else `not a function`.
- Python → JS: `window.evaluate_js("window.onEvent && window.onEvent(payload)")` – check existence before call
- File dialogs: Use `webview.FileDialog.OPEN/SAVE/FOLDER`, not `FolderDialog`
- Threading: Google Lens uses `asyncio.new_event_loop()` per thread to avoid loop conflict with pywebview's loop
- Paths: Use `file:///${appDataPath}/projects/...` for images, replace backslashes with `/` for Windows

---

## Known Fixes in Rebuild (Summary of Commits)

- `61dcede` – Full rebuild: organized backend/frontend, lightweight UI
- `1228de4` – Fix review.js:85 sidebar null + injection
- `d079d2c` – Fix docx NameError _set_section_rtl + logging OSError WinError 1 + sidebar null guard
- `d7d3f3b` – Fix FolderDialog AttributeError + enable debug console + robust sidebar collapse
- `b7fd4c0` – Break monolith & full frontend reorg + delete legacy folder: review.js 1400→90 lines, 12 new review modules (state,navigation,save,fontzoom,crop,fullpage,panels,editor,toolbar,category,tracking,preview,canvas), organize all js into core/components/tables/formatting/quran/pages/review/vendor, update all 9 HTML files to new paths, delete frontend/js/legacy/
- `ae1a8fb` – Fix tracking ReferenceError: debouncedTrackingUpdate not defined – duplicate const in tracking.js caused SyntaxError, file failed to parse, editor.js focus/input/keyup/click crashed, fixed by single definitions + window.* exposure + guarded calls in editor.js
- `f096203` – Modulize layout-editor (1481→30) + project-dashboard (715→30): layout-editor broken into state/history/selection/table-tools/properties/canvas/toolbar/navigation/save/events/index, dashboard broken into state/table/stats/ocr-modal/progress/export/collab/llm/index, thin orchestrators, update layout-editor.html and project-dashboard.html to load new modular paths
- `c7d9380` – Docs split README laypeople vs DEVELOPER_GUIDE
- `b415353` – Fix canvas.js updateSelectionUI not defined (selection button) + preview.js IIFE semicolon + collab coopPollInterval + layout-editor auto-hide (flex row vs column wrapped in #layout-main)
- `f9e6da2` – Fix review & dashboard & layout-editor runtime errors: preview.js IIFE missing semicolon -> TypeError (intermediate value)(...) is not a function, collab.js coopPollInterval not defined -> ReferenceError, layout-editor content auto-hides due to body flex column vs has-sidebar flex row conflict -> wrapped in #layout-main, tracking.js duplicate const fix + guarded editor.js calls

All pushed to branch `arena/019fce12-the-arabic-ocr`, PR #1.

---

## Requirements

See `requirements.txt`:

```
# Core GUI
pywebview>=4.0.0
# PDF & Document
PyMuPDF>=1.22.0
python-docx>=0.8.11
# Image / CV
Pillow>=9.0.0
opencv-python>=4.6.0
numpy>=1.21.0
# Network
requests>=2.28.0
zeroconf>=0.39.0
cryptography>=38.0.0
# OCR Engines
chrome-lens-py>=0.4.0
litellm>=1.0.0
# Google Drive (optional)
google-api-python-client>=2.0.0
google-auth-httplib2>=0.1.0
google-auth-oauthlib>=0.8.0
# Locro
typer>=0.9.0
```

Install: `pip install -r requirements.txt`

**Note:** `PyMuPDF` provides `fitz` module. `opencv-python` may need `numpy` compatible version. `locro` requires Chrome installed for ScreenAI model.

---

## Post-Processing Module

> **Branch:** `feature/post-processing-pagination`  
> **Module root:** `backend/post_processing/`

The post-processing pipeline runs _after_ OCR extraction to automatically re-order bounding boxes into true **Arabic Reading Order (Top-to-Bottom, Right-to-Left)** and detect **Pagination (Page Numbers)** across project pages.

### Architecture

```
backend/post_processing/
├── __init__.py                 # exports PostProcessingManager
├── manager.py                  # PostProcessingManager orchestrator
├── reading_order/
│   ├── __init__.py
│   └── sorter.py               # ArabicReadingOrderSorter pure-spatial algorithm
└── pagination/
    ├── __init__.py             # exports PaginationDetector
    └── detector.py             # PaginationDetector algorithm
```

### Algorithms

1. **Arabic Reading Order Sorter (`reading_order/sorter.py`)**  
   - Projects bounding box X-spans to detect multi-column vertical gutters (e.g. 2-column layouts).
   - In Arabic, partitions columns from **Right to Left** (Right Column = Column 1, Left Column = Column 2).
   - Within each column/line, sorts blocks **Right to Left** (descending X coordinate: `x2`, `x1`).

2. **Pagination Auto-Detector (`pagination/detector.py`)**  
   - Scans candidate blocks in header (top 15%) and footer (bottom 15%) regions.
   - Extracts standalone integer values (supporting ASCII `0-9`, Arabic-Indic `٠-٩`, and Persian `۰-۹` digits).
   - Validates numeric sequence continuity ($v_{i+1} = v_i + 1$ or $+2$) across consecutive or facing pages.
   - Annotates confirmed blocks with `category="Page-number"` and `is_page_number=True`.

3. **Automatic Execution Hook (`backend/core/ocr/service.py`)**  
   - Integrated into `OCRService.standardize_and_clean()` — the central post-OCR method invoked by all OCR engines (Paddle, Google Lens, Locro, LLM Vision).
   - Automatically executes `PostProcessingManager` immediately upon recognition completion whenever post-processing options are enabled in project settings.

4. **Unified Settings Apply (`backend/app/api.py`)**
   - Implemented `apply_project_settings_changes(project_id, apply_scope)` to apply both pre-processing text formatting rules and post-processing algorithms (like reading order and pagination) seamlessly in a single pass.
   - Called from `frontend/js/pages/project-settings.js` with options to apply to "all" OCRed pages, "unreviewed" pages, or "none".
   - Ensures robust and unified application of any future post-processing logic added to the `PostProcessingManager`.

---


## License

Same as original – open source. Feel free to contribute.

---

## For AI Agents Working on This Tool

If you are an AI with no prior context, read this:

1. **Start with `main.py`** – 70 lines, creates `Api()` and window.
2. **Read `backend/app/api.py`** – all pywebview-exposed methods, delegates to core.
3. **Core is `backend/core/`** – projects, pdf, config, text, quran, ocr/handler+service.
4. **Coordinate system is critical** – always use `OCRHandler.standardize_page_blocks` to convert any engine output to 72 DPI + geometry percentages. Never store 200 DPI bbox directly without standardization (except intermediate paddle parsing).
5. **Project JSON is single source of truth** – `project.json` + `raw_ocr/` backup + `images/` – all atomic writes via ProjectManager.
6. **Frontend is vanilla JS** – no bundler. `core/api.js` ready promise, `store.js` simple reactive, `components/sidebar.js` injects sidebar. Review page is most complex – state in `state.js`, canvas in `canvas-rendering.js`, tracking in `text-tracking-engine.js`.
7. **Design tokens drive UI** – change colors/spacing in `tokens.css`, not hardcoded.
8. **Shims keep backward compat** – old flat files like `backend/config_manager.py` import from new core. Don't delete them until all imports updated.
9. **Export uses shared helpers** – always use `shared.py` for markdown stripping, color parsing, etc.
10. **PyWebView quirks** – folder dialog is `FileDialog.FOLDER`, logger must be silenced with NullHandler to avoid WinError 1, debug=True needed for devtools.
11. **Testing:** No unit tests yet – manually test via `python main.py` workflow: create project → OCR → review → export. Check `py_compile` for syntax.
12. **To add feature:** Follow “How to Extend” section above.

Good luck!  
— Rebuilt with care for future maintainers.
