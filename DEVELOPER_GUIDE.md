# 🛠️ Arabic OCR — Developer & Architecture Guide

> **This document is the maintained onboarding and technical reference for developers and AI agents working on the Arabic OCR Review Tool codebase.**
> For general users who want to install and use the tool, see **[README.md](README.md)**.
>
> It documents the repository structure, major subsystems, data models, coordinate systems, pipelines, and extension points. For implementation details, treat the source code as authoritative.

---

## 📑 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Quick Start](#2-quick-start)
3. [Repository Structure](#3-repository-structure)
4. [Backend Architecture (Python)](#4-backend-architecture-python)
   - [Core / Projects / PDF / Text / Quran](#41-core--projects--pdf--text--quran)
   - [High-Performance JSON & Modular Storage](#42-high-performance-json--modular-storage)
   - [OCR Engine Abstraction & Standardization](#43-ocr-engine-abstraction--standardization)
   - [Pre-Processing Studio (ScanTailor Advanced)](#44-pre-processing-studio-scantailor-advanced)
   - [Post-Processing Pipeline (Reading Order & Pagination)](#45-post-processing-pipeline-reading-order--pagination)
   - [Table Detection & Extraction Engine](#46-table-detection--extraction-engine)
   - [Export Subsystem](#47-export-subsystem)
   - [Collaboration & LAN Sync](#48-collaboration--lan-sync)
   - [App Facade & IPC Events](#49-app-facade--ipc-events)
5. [Frontend Architecture (HTML/CSS/JS)](#5-frontend-architecture-htmlcssjs)
   - [Design Tokens & UI System](#51-design-tokens--ui-system)
   - [Core JS Infrastructure](#52-core-js-infrastructure)
   - [Shared Components](#53-shared-components)
   - [Page Modules](#54-page-modules)
   - [Review Page Deep Dive](#55-review-page-deep-dive)
   - [Pre-Processing Studio Deep Dive](#56-pre-processing-studio-deep-dive)
6. [Data Models & Coordinate Systems](#6-data-models--coordinate-systems)
7. [Key Workflows](#7-key-workflows)
8. [How to Extend](#8-how-to-extend)
   - [Add New OCR Engine](#81-add-new-ocr-engine)
   - [Add New Preprocessing Stage](#82-add-new-preprocessing-stage)
   - [Add New Export Format](#83-add-new-export-format)
   - [Add New Block Category](#84-add-new-block-category)
9. [Interface Localization (i18n)](#9-interface-localization-i18n)
10. [Technical Implementation Notes & Edge Cases](#10-technical-implementation-notes--edge-cases)
11. [Requirements & Setup](#11-requirements--setup)
12. [License & Acknowledgments](#12-license--acknowledgments)

---

## 1. Project Overview

**Goal:** Take a scanned Arabic PDF, optionally pre-process the scans (split spreads, deskew, crop margins, binarize), run OCR with AI (multiple engines), allow visual review and layout correction (blocks, tables, poetry, images), verify Quranic verses against authentic Uthmani text, and export clean, publication-ready DOCX, EPUB, HTML, TXT, or JSON.

**Why Arabic-focused?**
- RTL direction handling everywhere (bidi tags in DOCX, `dir="rtl"` in HTML, CSS `direction: rtl`).
- Arabic typography cleaning (kashida/tatweel removal, hamza normalization, tanween correction, tashkeel removal, punctuation and و spacing).
- Arabic poetry tables: `شعر عمودي` (classical two-hemistichs per row) and `شعر متدرج` (staggered modern poetry) with automatic justification.
- Built-in authentic Uthmani Quran dataset integration.

**Tech Stack:**
- **Backend:** Python 3.10+, `pywebview` (native window), `PyMuPDF` (PDF rasterization), `python-docx`, `OpenCV`, `Pillow`, `numpy`, `orjson`, `requests`, `cryptography`, `zeroconf`, `litellm`, `chrome-lens-py`, `scantailor-advanced` (`stalib`), `locro`.
- **Frontend:** Vanilla JS (no framework), HTML5, modern CSS3 with custom properties (design tokens).
- **IPC Bridge:** `window.pywebview.api.<method>()` promises (JS → Python) and `window.evaluate_js("window.onEvent(payload)")` (Python → JS).

---

## 2. Quick Start

```bash
git clone https://github.com/adam76064/The_Arabic_OCR.git
cd The_Arabic_OCR
pip install -r requirements.txt
python main.py
```

The app opens at 1280x800 loading `frontend/index.html` via `pywebview`.

**Standard User Workflow:**
1. **Home:** Click **+ مشروع جديد** → Select PDF, Title, Author, and Logical Start Page.
2. **Pre-Processing (Optional):** Open Preprocessing Studio to split spreads, deskew, trim margins, and binarize.
3. **Dashboard:** Select page range (e.g. 1-200) → Choose engine (PaddleOCR, Google Lens, Locro Offline, LLM Vision) → Click Start.
4. **Review:** Canvas displays bounding boxes, crop viewer zooms on active text block, edit text directly, change category labels, auto-detect tables, search Quran via right-click.
5. **Export:** Choose pages + target format + options (page numbering `none/pdf/logical`, `text_mode` `formatted/raw`, etc.).

---

## 3. Repository Structure

```
The_Arabic_OCR/
├── main.py                          # 70-line slim entry point, configures pywebview & devtools
├── requirements.txt                 # Clean dependency manifest
├── README.md                        # User-facing documentation
├── DEVELOPER_GUIDE.md               # Developer & architecture guide (this file)
├── data/
│   └── Quran.json                   # Authentic Uthmani Quran text dataset
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── api.py                   # Central pywebview API facade - ALL exposed JS methods
│   │   └── events.py                # EventEmitter: Python → JS asynchronous progress
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                # ConfigManager: data paths, meta_config.json, app settings
│   │   ├── json_utils.py            # High-performance orjson serialization with JSON fallback
│   │   ├── projects.py              # ProjectManager: CRUD, modular storage, fast project load
│   │   ├── pdf.py                   # PDFProcessor: PyMuPDF rasterization & ~160px thumbnail cache
│   │   ├── text.py                  # ArabicTextCleaner: kashida, hamza, tanween, tashkeel, punctuation
│   │   ├── quran.py                 # QuranHandler: search, verification, & citations
│   │   └── ocr/
│   │       ├── __init__.py
│   │       ├── base.py              # OCRAdapter Protocol + OCRResult container
│   │       ├── handler.py           # OCRHandler: converts raw bbox to 72 DPI + relative geometry
│   │       ├── service.py           # OCRService: central orchestrator for standardize + clean
│   │       ├── paddle.py            # PaddleOCRClient: BOS upload + limits tracking
│   │       ├── google_lens.py       # GoogleLensOCR: isolated event loop per thread
│   │       ├── locro.py             # Locro ScreenAI offline engine adapter
│   │       └── llm.py               # LLMOCRHandler: LiteLLM vision integration
│   ├── preprocessing/
│   │   ├── __init__.py
│   │   ├── engine.py                # PreprocessingEngine preview & single-stage execution
│   │   ├── storage.py               # PreprocessingStorage: image backup, split, stage flags
│   │   ├── pipeline.py              # PreprocessingPipeline: sequential multi-stage execution
│   │   ├── worker.py                # Batch worker thread with cancel & progress broadcast
│   │   └── stages/
│   │       ├── base.py              # BaseStage abstract class & fast image conversions
│   │       ├── orientation.py       # Stage 1: FixOrientationStage (0°, 90°, 180°, 270°)
│   │       ├── split.py             # Stage 2: PageSplitStage (spread/single detection & sloped line)
│   │       ├── deskew.py            # Stage 3: DeskewStage (sub-pixel Radon/Hough angle estimation)
│   │       ├── content.py           # Stage 4: ContentSelectionStage (bounding box extraction)
│   │       ├── layout.py            # Stage 5: PageLayoutStage (margins & dimension matching)
│   │       └── output.py            # Stage 6: OutputBinarizationStage (Otsu, Sauvola, Wolf)
│   ├── post_processing/
│   │   ├── __init__.py
│   │   ├── manager.py               # PostProcessingManager orchestrator
│   │   ├── reading_order/
│   │   │   ├── __init__.py
│   │   │   └── sorter.py            # ArabicReadingOrderSorter pure-spatial algorithm
│   │   └── pagination/
│   │       ├── __init__.py
│   │       └── detector.py          # PaginationDetector: header/footer page number detector
│   ├── table/
│   │   ├── __init__.py
│   │   ├── handler.py               # TableHandler: 3-tier layout (vectors → coords → smear)
│   │   └── engine/                  # Computer vision table detection algorithms
│   ├── export/
│   │   ├── __init__.py              # export_project(fmt) router
│   │   ├── shared.py                # Shared export helpers, RTL BiDi helpers, typography parsers
│   │   ├── docx_export.py           # Word DOCX exporter with RTL tables & poetry
│   │   ├── html_epub.py             # EPUB3 & HTML exporters with kashida justification
│   │   ├── txt_export.py            # Plaintext exporter
│   │   └── json_export.py           # Structured JSON exporter
│   ├── collab/
│   │   ├── __init__.py
│   │   ├── discovery.py             # LANDiscovery: zeroconf mDNS browse/register
│   │   ├── sync.py                  # LANSyncServer/Client: PBKDF2HMAC + Fernet encrypted sync
│   │   └── merger.py                # ProjectMerger: conflict detection & timestamp resolution
│   ├── vendor/
│   │   ├── __init__.py
│   │   └── locro/                   # Vendored ScreenAI OCR Python library
│   └── utils/
│       ├── __init__.py
│       ├── stitcher.py              # BlockStitcher: chunked image stitching for OCR
│       └── retriever.py             # Text retriever & layout block alignment
│
└── frontend/
    ├── index.html                   # Home screen
    ├── projects.html                # Projects table screen
    ├── project-dashboard.html       # Project dashboard
    ├── preprocessing.html           # Preprocessing Studio (ScanTailor)
    ├── review.html                  # Side-by-side Review Studio
    ├── layout-editor.html           # Canvas layout editor
    ├── settings.html                # Global application settings
    ├── export.html                  # Export wizard
    ├── lan.html                     # Collaboration screen
    ├── css/
    │   ├── tokens.css               # Design tokens (--color-primary, --radius-md, fonts)
    │   ├── base.css                 # Reset, typography, scrollbars, RTL default
    │   ├── components.css           # Buttons, cards, modals, forms, badges
    │   ├── layout.css               # Application layout & sidebar styles
    │   ├── preprocessing.css        # Preprocessing studio styling & paper drop shadows
    │   ├── review.css               # Review studio layout & crop section styles
    │   └── home.css                 # Hero & home card styles
    └── js/
        ├── core/                    # AppApi, AppStore, utils, events
        ├── i18n/                    # AppI18n & locale catalogs (ar.js, en.js, de.js)
        ├── icons.js                 # Centralized SVG icon registry
        ├── components/              # Sidebar, modal, notifications, tables, formatting, quran
        └── pages/                   # Modular page controllers (review, dashboard, preprocessing)
```

---

## 4. Backend Architecture (Python)

### 4.1 Core / Projects / PDF / Text / Quran

- **`backend/core/config.py`**: Resolves data directories (`%APPDATA%/The_Arabic_OCR/projects` on Windows), reads `meta_config.json`, and handles data path relocations.
- **`backend/core/projects.py`**: Handles project creation, listing, updating, and modular storage.
  - `load_project(project_id)`: Fast read of `project.json` in $\approx 1$ms without scanning per-page OCR files.
  - `load_project_with_ocr(project_id)`: Reads `project.json` and hydrates `ocr_data` for each page from `pages/page_{idx}.json`. Used strictly where text content is needed (Review, Export).
  - `save_page_ocr(project_id, page_index, ocr_data)`: Atomic save of single-page OCR to `pages/page_{idx}.json`.
  - `ensure_project_thumbnails(project_id)`: Background verification and generation of `thumbs/` files for newly split or imported pages.
- **`backend/core/pdf.py`**: Uses `PyMuPDF` (`fitz`) to extract page images at ~200 DPI into `images/page_{idx}.jpg` and dedicated ~160px thumbnails into `thumbs/page_{idx}.jpg`.
- **`backend/core/text.py`**: `ArabicTextCleaner` provides normalized cleaning rules:
  - Tatweel `ـ` removal.
  - Hamza normalization (`أإآ → ا` or standard forms).
  - Tanween normalization (`اً ↔ ًا`).
  - Tashkeel (harakat) removal.
  - Fix punctuation attachments and isolated و spacing (`و ` attached to following word).
- **`backend/core/quran.py`**: Loads `data/Quran.json` containing authentic Uthmani script. Normalizes text for fuzzy searching (exact match, sliding window, difflib, gap-fill) and returns exact Ayah text with citation metadata `[سورة: آية]`.

---

### 4.2 High-Performance JSON & Modular Storage

The system employs [`backend/core/json_utils.py`](backend/core/json_utils.py) which leverages the ultra-fast Rust `orjson` library when available, transparently falling back to Python's standard `json`.

**Modular Storage Architecture:**
- `project.json`: Contains project metadata, global settings, page dimensions, and processing flags (`is_preprocessed`, `is_deskewed`, `is_cropped`, `is_layout_applied`, `preprocessing_stages_applied`).
- `pages/page_{idx}.json`: Stores detailed block arrays (`bbox`, `text`, `category`, `reviewed`, `lines`, `words`) per page.
- `thumbs/page_{idx}.jpg`: Pre-generated 160px JPEG thumbnails (~5-10 KB) for instant rendering across filmstrips and dashboards.
- `raw_images/page_{idx}.jpg`: Pristine original scans backed up automatically on first pre-processing operation for lossless reversion.

---

### 4.3 OCR Engine Abstraction & Standardization

All OCR engines implement the `OCRAdapter` protocol in [`backend/core/ocr/base.py`](backend/core/ocr/base.py):

```python
class OCRAdapter(Protocol):
    def process_page(self, image_path: str, **kwargs) -> OCRResult: ...
```

**Engines:**
- **`paddle.py`**: Uploads image to Baidu PaddleOCR API with daily quota tracking in `paddle_limits.json`.
- **`google_lens.py`**: Google Lens OCR using `chrome-lens-py`. Operates in a dedicated event loop per thread to avoid event loop conflicts with `pywebview`.
- **`locro.py`**: Offline Chrome ScreenAI engine.
- **`llm.py`**: LiteLLM multimodal interface (Gemini, Claude, GPT-4o) with prompt instructing normalized `[0, 1000]` coordinate bounding boxes.

**Coordinate Standardization (`backend/core/ocr/handler.py`):**
Converts arbitrary engine bounding boxes to:
1. Standard 72 DPI PostScript points: `bbox = [x1, y1, x2, y2]`.
2. Normalized percentage coordinates: `geometry = {"x": %, "y": %, "width": %, "height": %}`.

---

### 4.4 Pre-Processing Studio (ScanTailor Advanced)

Located in [`backend/preprocessing/`](backend/preprocessing/), this subsystem wraps ScanTailor Advanced capabilities into an interactive 6-stage studio:

```
Input Scan Image
      │
      ▼
┌─────────────────────────┐
│ 1. Fix Orientation      │ ──► Auto-detect / Lossless orthogonal rotation (0°, 90°, 180°, 270°)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. Page Split           │ ──► Spread detection (w >= h * 1.05) & sloped cutter line ((x1,y1),(x2,y2))
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. Deskew               │ ──► Sub-pixel baseline Radon/Hough angle estimation (-45°..+45°)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. Select Content       │ ──► Morphological gradient text rectangle detection
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 5. Margins & Layout     │ ──► Margin padding (mm/px) + alignment + match_size standardization
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 6. Output Binarization  │ ──► Otsu / Sauvola / Wolf binarization + despeckle + illumination normalization
└───────────┬─────────────┘
            ▼
Preprocessed Clean Page (Saved to project.json, images/, and thumbs/)
```

**Idempotency & Stage Protections:**
- **Deskew Guard**: $|\theta| < 0.15^\circ$ bypasses rotation to prevent interpolation blur and canvas expansion.
- **Content Boundary Guard**: Crop boxes spanning $\le 4\text{px}$ from boundaries preserve dimensions without eating into text.
- **Layout Margin Guard**: Layout detects the true inner non-white bounding box, ensuring re-applying margins replaces rather than compounds borders ($15\text{mm} \to 30\text{mm}$).
- **Granular Stage Tracking**: Stores `is_deskewed`, `is_cropped`, `is_layout_applied`, `is_binarized`, and `preprocessing_stages_applied` in `project.json`. Cleanly cleared on `reset_page_to_original()`.

---

### 4.5 Post-Processing Pipeline (Reading Order & Pagination)

Located in [`backend/post_processing/`](backend/post_processing/):

1. **Arabic Reading Order Sorter (`reading_order/sorter.py`)**:
   - Projects bounding box horizontal intervals to detect multi-column layouts (e.g. 2-column spreads).
   - Partitions columns from Right to Left (Right Column = 1, Left Column = 2).
   - Within each column, sorts blocks Top to Bottom, and within rows from Right to Left.

2. **Pagination Auto-Detector (`pagination/detector.py`)**:
   - Scans candidate blocks in header (top 15%) and footer (bottom 15%) zones.
   - Extracts numbers across ASCII (`0-9`), Arabic-Indic (`٠-٩`), and Persian (`۰-۹`) formats.
   - Validates numerical continuity ($v_{i+1} = v_i + 1$ or $+2$) across pages.
   - Tags verified blocks with `category="Page-number"`.

---

### 4.6 Table Detection & Extraction Engine

Located in [`backend/table/`](backend/table/):
- **Vector Detection**: Scans for explicit horizontal and vertical lines in binary images.
- **Coordinate Clustering**: Clusters word bounding box alignments into columns and rows.
- **Smear Analysis**: Uses morphological smearing to group text paragraphs into discrete cells.
- **Table Data Model**:
  ```json
  {
    "type": "table",
    "rows": 3,
    "cols": 2,
    "cells": [
      { "row": 0, "col": 0, "rowspan": 1, "colspan": 1, "text": "العمود الأول", "bbox": [50, 100, 250, 130] },
      { "row": 0, "col": 1, "rowspan": 1, "colspan": 1, "text": "العمود الثاني", "bbox": [250, 100, 450, 130] }
    ]
  }
  ```

---

### 4.7 Export Subsystem

Located in [`backend/export/`](backend/export/):
- **DOCX (`docx_export.py`)**: Uses `python-docx` with XML manipulations to enforce RTL paragraph direction (`w:bidi`), RTL section direction, Arabic typography font styles (`Traditional Arabic`, `Amiri`), two-hemistich poetry tables, and merged table cells.
- **EPUB3 & HTML (`html_epub.py`)**: Generates valid XHTML and EPUB3 structures with RTL stylesheets, kashida justification, and table markup.
- **TXT & JSON (`txt_export.py`, `json_export.py`)**: Clean plaintext and structured geometry JSON exports.

---

### 4.8 Collaboration & LAN Sync

Located in [`backend/collab/`](backend/collab/):
- **Discovery (`discovery.py`)**: Uses `zeroconf` mDNS to advertise and discover peers on the local network (`_arabic-ocr._tcp.local.`).
- **Encrypted Sync (`sync.py`)**: PBKDF2HMAC password key derivation with Fernet symmetric frame encryption.
- **Conflict Resolution (`merger.py`)**: Compares block edit timestamps and review statuses to resolve simultaneous edits.

---

### 4.9 App Facade & IPC Events

[`backend/app/api.py`](backend/app/api.py) acts as the single point of entry for frontend calls. Key methods:
- Project Management: `load_project()`, `get_projects()`, `create_project()`, `delete_project()`.
- OCR: `run_ocr()`, `get_ocr_limits()`, `cancel_ocr()`.
- Preprocessing: `preview_preprocessing_stage()`, `apply_preprocessing_to_page()`, `batch_preprocess_pages()`, `reset_page_preprocessing()`.
- Post-Processing & Settings: `apply_project_settings_changes()`.
- Review & Layout: `update_page_ocr()`, `split_block()`, `merge_blocks()`, `search_quran()`.
- Export: `export_project()`.

---

## 5. Frontend Architecture (HTML/CSS/JS)

### 5.1 Design Tokens & UI System

- **[`frontend/css/tokens.css`](frontend/css/tokens.css)**: CSS Custom Properties for colors (`--color-primary`, `--color-surface`, `--color-text`), spacing (`--space-md`), border radii (`--radius-md`), and category color mappings.
- **[`frontend/js/icons.js`](frontend/js/icons.js)**: Centralized SVG icon library with stroke-based SVG icons.

---

### 5.2 Core JS Infrastructure

- **`AppApi` ([`frontend/js/core/api.js`](frontend/js/core/api.js))**: Exposes `AppApi.ready()` and promise-wrapped API methods.
- **`AppStore` ([`frontend/js/core/store.js`](frontend/js/core/store.js))**: Reactive store for global application state.
- **`AppI18n` ([`frontend/js/i18n/`](frontend/js/i18n/))**: Multilingual translation engine.

---

### 5.3 Shared Components

- **Sidebar ([`frontend/js/components/sidebar.js`](frontend/js/components/sidebar.js))**: Injects and handles the collapsible navigation sidebar.
- **Modal ([`frontend/js/components/modal.js`](frontend/js/components/modal.js))**: Custom modals and confirmation dialogs (`AestheticDialog`).
- **Notifications ([`frontend/js/components/notifications.js`](frontend/js/components/notifications.js))**: Non-blocking toast notification tray.
- **Quran Component ([`frontend/js/components/quran/quran.js`](frontend/js/components/quran/quran.js))**: Modal for searching, verifying, and inserting Quran verses.

---

### 5.4 Page Modules

- **Home ([`frontend/js/pages/home.js`](frontend/js/pages/home.js))**: Recent projects, statistics, and quick action cards.
- **Projects ([`frontend/js/pages/projects.js`](frontend/js/pages/projects.js))**: Searchable projects table.
- **Dashboard ([`frontend/js/pages/project-dashboard/`](frontend/js/pages/project-dashboard/))**: Modular dashboard with `table.js` (table/grid view with lazy loading), `ocr-modal.js`, `stats.js`, `progress.js`, `collab.js`.
- **Layout Editor ([`frontend/js/pages/layout-editor/`](frontend/js/pages/layout-editor/))**: Full canvas editor for drawing, resizing, and adjusting block bboxes.

---

### 5.5 Review Page Deep Dive

Located in [`frontend/js/pages/review/`](frontend/js/pages/review/):
- **`state.js`**: `ReviewState` singleton tracking `currentProject`, `currentPageIndex`, `selectedBlockIndex`, `cropZoom`, category definitions.
- **`editor.js`**: Binds block editing, contenteditable synchronization, drag reordering, and category changes.
- **`canvas-rendering.js`**: Draws 72 DPI bounding boxes onto canvas using `requestAnimationFrame`.
- **`crop.js`**: Zooms and centers the crop view on the active text block.
- **`toolbar.js`**: Formatting toolbar (Bold, Italic, RTL/LTR, Align, Font Size, Prev/Next, Save).
- **`category.js`**: Categorization dropdown (Title, Text, Table, Quran, Picture, Poetry, Page-number).

---

### 5.6 Pre-Processing Studio Deep Dive

Located in [`frontend/js/pages/preprocessing/`](frontend/js/pages/preprocessing/):
- **`canvas.js`**: Hardware-accelerated (`translate3d`) interactive canvas supporting pan, zoom, and container-centered `fitToScreen()`.
- **`overlays/`**: Modular interactive stage overlays:
  - `orientation-overlay.js`: 90° rotation buttons.
  - `split-overlay.js`: Interactive sloped cutter line with drag handles.
  - `deskew-overlay.js`: Angle slider with alignment grid.
  - `content-overlay.js`: 8-handle resizable content selection box.
  - `layout-overlay.js`: Visual margin guides and alignment indicators.
  - `output-overlay.js`: Interactive split-curtain comparison slider between original scan and binarized output.
- **`toolbar.js`**: Stage navigation tabs, zoom controls, and filmstrip with `IntersectionObserver` lazy loading and smooth auto-scrolling.
- **`batch-modal.js`**: Wizard to execute single stages or the full 6-stage pipeline across all pages or custom ranges.

---

## 6. Data Models & Coordinate Systems

### Data Format (`project.json`)

```json
{
  "metadata": {
    "title": "عنوان الكتاب",
    "author": "اسم المؤلف",
    "logical_start_page": 1,
    "text_features": {
      "normalize_hamza": true,
      "remove_tatweel": true,
      "fix_waw_spacing": true
    },
    "post_processing": {
      "auto_sort_reading_order": true,
      "detect_pagination": true
    }
  },
  "pages": [
    {
      "pdf_index": 0,
      "sub_index": null,
      "image_path": "page_0.jpg",
      "width": 1654,
      "height": 2338,
      "native_width": 595.3,
      "native_height": 841.9,
      "status": "reviewed",
      "is_preprocessed": true,
      "is_deskewed": true,
      "is_cropped": true,
      "is_layout_applied": true,
      "preprocessing_stages_applied": ["orientation", "deskew", "content", "layout"],
      "ocr_data": [
        {
          "bbox": [50.0, 100.0, 545.3, 140.0],
          "text": "بسم الله الرحمن الرحيم",
          "category": "Title",
          "reviewed": true,
          "direction": "rtl",
          "geometry": {
            "x": 8.4,
            "y": 11.9,
            "width": 83.2,
            "height": 4.8
          }
        }
      ]
    }
  ]
}
```

### Coordinate Systems

1. **Physical Image Space**: Dimensions in pixels at ~200 DPI (`width`, `height`).
2. **Standard Document Coordinate Space (72 DPI)**: All stored `bbox` coordinates `[x1, y1, x2, y2]` use standard PostScript points.
3. **Normalized Percentage Space (`geometry`)**: Relative percentages (`0.0` to `100.0`) for responsive UI canvas rendering.

---

## 7. Key Workflows

### 1. New Project & Rasterization
1. User provides PDF file.
2. `PDFProcessor` calculates MD5/SHA256 hash to prevent duplicates.
3. PyMuPDF renders pages at ~200 DPI to `images/page_{idx}.jpg` and ~160px thumbnails to `thumbs/page_{idx}.jpg`.
4. Initializes `project.json` and creates `pages/` directory.

### 2. Pre-Processing Pipeline Execution
1. User adjusts stage parameters in Preprocessing Studio or launches Batch Wizard.
2. Pipeline sequentially runs active stages (`orientation` → `split` → `deskew` → `content` → `layout` → `output`).
3. `PreprocessingStorage` backs up original to `raw_images/`, saves processed image to `images/`, updates `thumbs/`, and records stage flags.

### 3. OCR Recognition & Post-Processing
1. `Api.run_ocr()` sends pages to the selected engine.
2. Raw outputs are standardized to 72 DPI by `OCRHandler`.
3. `OCRService` applies text cleaning rules.
4. `PostProcessingManager` sorts blocks into Arabic reading order and identifies page numbers.
5. Blocks are saved atomically to `pages/page_{idx}.json`.

### 4. Review & Export
1. User edits text, table cells, and verse citations in Review Studio.
2. Edits save to `pages/page_{idx}.json`.
3. Exporter compiles `project.json` and page OCR JSONs into Word (DOCX), EPUB3, HTML, TXT, or JSON.

---

## 8. How to Extend

### 8.1 Add New OCR Engine
1. Create `backend/core/ocr/<engine>.py` implementing `OCRAdapter`.
2. Map engine output to standardized `OCRResult`.
3. Register in `OCRService` ([`backend/core/ocr/service.py`](backend/core/ocr/service.py)).
4. Add engine choice in `frontend/js/pages/project-dashboard/ocr-modal.js`.

### 8.2 Add New Preprocessing Stage
1. Create `backend/preprocessing/stages/<stage>.py` subclassing `BaseStage`.
2. Implement `get_default_params()` and `process(image_np, params, dpi)`.
3. Register in `PreprocessingPipeline` and `PreprocessingEngine`.
4. Create corresponding overlay in `frontend/js/pages/preprocessing/overlays/`.

### 8.3 Add New Export Format
1. Create `backend/export/<format>_export.py`.
2. Implement export logic taking project dict and options.
3. Register in `export_project()` in [`backend/export/__init__.py`](backend/export/__init__.py).
4. Add format in `frontend/export.html`.

### 8.4 Add New Block Category
1. Add identifier to `BASE_CATEGORIES` in [`frontend/js/pages/review/state.js`](frontend/js/pages/review/state.js).
2. Assign color in `CATEGORY_COLORS` in [`frontend/css/tokens.css`](frontend/css/tokens.css).
3. Add translations in `ar.js`, `en.js`, `de.js`.
4. Add formatting handling in `backend/export/`.

---

## 9. Interface Localization (i18n)

The interface supports Arabic (`ar`), English (`en`), and German (`de`).

Locale files are located in [`frontend/js/i18n/locales/`](frontend/js/i18n/locales/).

**Usage:**
- HTML: `data-i18n="key"` or `data-i18n-title="key"`.
- JavaScript: `window.AppI18n.t('key', { param: 'value' })`.

---

## 10. Technical Implementation Notes & Edge Cases

- **PyWebView Logger Silencing**: In `main.py`, the `webview` logger handlers are silenced with `NullHandler` to prevent `OSError: [WinError 1]` when running in windowed mode.
- **Folder Dialogs**: Always use `webview.FileDialog.FOLDER` rather than legacy Dialog attributes.
- **Thread Event Loops**: Google Lens OCR creates a dedicated `asyncio.new_event_loop()` per thread to avoid conflicts with `pywebview`'s GUI thread.
- **Canvas Centering & GPU Compositing**: Preprocessing and Layout canvases use `translate3d(panX, panY, 0)` with explicit `top: 0; left: 0;` on stage wrappers to eliminate subpixel displacement and flex centering conflicts.
- **Offscreen Image Preloading**: Stage image updates preload via offscreen `new Image()` before updating DOM elements, preventing visual flashing and double resize calculations.

---

## 11. Requirements & Setup

Dependencies in `requirements.txt`:
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

# Network & Security
requests>=2.28.0
zeroconf>=0.39.0
cryptography>=38.0.0

# OCR Engines
chrome-lens-py>=0.4.0
litellm>=1.0.0

# Performance
orjson>=3.9.0

# Pre-processing (ScanTailor Advanced)
scantailor-advanced>=1.0.1
```

---

## 12. License & Acknowledgments

- **Core Architecture & Review Tool:** Developed by Adam Mustafa.
- **ScanTailor Advanced (`stalib`):** Adapted from ScanTailor Advanced for scan preprocessing. Special thanks to [Roan George](https://github.com/roangeorge) and [David Bowman](https://github.com/dbowm91).
- **Locro Engine:** Python bridge for Chrome ScreenAI offline recognition (`backend/vendor/locro/`).
- **Quran Dataset:** Authentic Uthmani script text database (`data/Quran.json`).
