# 📖 OCR Review Tool (GEM OCR)

An advanced, desktop-grade local web application designed for **Arabic OCR review**, **layout editing**, **table structure extraction**, **Quranic verse verification**, **multi-engine OCR processing**, and **real-time multi-user collaboration**.

Built specifically for Arabic typography, document layout analysis, and translation workflows, **OCR Review Tool** bridges native desktop performance with modern web-based UI interactivity.

---

## 🌟 Key Features & Core Capabilities

### 🤖 Multi-Engine OCR Pipeline
- **Vision LLM OCR**: Integrated with `litellm` supporting Gemini 1.5 Pro/Flash, Claude 3.5 Sonnet, GPT-4o, and OpenAI-compatible endpoints. Coordinates are extracted on a normalized `0-1000` scale and decompressed back to the 200 DPI grid.
- **Customizable LLM System Prompt**: Edit global system prompts in General Settings or override prompts per-project with a persistent *"Remember for this project"* option.
- **Google Drive OCR**: Native document conversion via Google Drive APIs with DOM-based page splitting and block stitching (`block_stitcher.py`).
- **Google Lens OCR**: High-accuracy visual recognition via asynchronous Google Lens extraction (`google_lens_ocr.py`).
- **Dots OCR & PaddleOCR**: Built-in support for online/local Dots OCR and PaddleOCR processing pipelines.

### 📐 Table Structure Detection & Editing (`table_detector`)
- **Geometric Grid & Component Detection**: Detects rows, columns, cell spans, and ruling lines for both bordered and borderless tables.
- **RTL & LTR Reordering**: Automatic right-to-left layout remapping tailored for Arabic/Hebrew typography.
- **Interactive Table Editor**: Full frontend GUI (`table-editor.js`, `table-toolbar.js`) to split/merge cells, adjust boundaries, and edit per-cell OCR text.

### 📖 Quranic Verse Matching & Verification (`quran_handler.py`)
- **Integrated Reference Dataset**: Complete Quranic text dataset (`data/Quran.json`).
- **Fuzzy Verse Search & Verification**: Uses string similarity algorithms (`difflib`) to verify scanned verses against authentic Quranic text and apply instant corrections with formal citations.

### 🧹 Advanced Arabic Typography & Text Cleaning (`text_cleaner.py`)
- **ArabicTextCleaner**: Automatic Hamza normalization, Tanween adjustments, Waw prefixing, excessive Kashida (tatweel) removal, and Tashkeel diacritics stripping.
- **Tashkeel Removal Brush**: Non-destructive DOM-based Tashkeel removal brush that preserves HTML markup, line breaks (`<br>`), and paragraphs.

### 🖥️ Flexible Review Interface (`review.html` / `review.js`)
- **Dual View Layout Switcher**: Interactive switch icon embedded in the middle of the resize handle to toggle between **Top/Bottom Stacked Mode** and **Side-by-Side Split View Mode** (moving Crop Viewer to Left and Block List to Right for long vertical text and multi-row tables).
- **Bounding Box Canvas**: Synchronized canvas overlay mapping bounding boxes directly over page images.
- **Custom Categories**: Define custom color-coded categories (e.g., *شعر عمودي*, *حاشية*) alongside built-in categories (`Text`, `Title`, `Table`, `Picture`, `Formula`, etc.).
- **Customizable Shortcuts**: Fully configurable keyboard shortcuts with instant shortcut assignment.

### 🌐 Real-Time Multi-User Collaboration
- **LAN Peer-to-Peer Sync**: Local network synchronization with mDNS peer discovery (`lan_discovery.py`) and PSK-derived symmetric encryption (PBKDF2HMAC + Fernet AES).
- **Cloud Collaboration**: Encrypted WebRTC-based synchronization using STUN NAT traversal for remote teams over the internet (`cloud_sync.py`).

### 📤 Multi-Format Exporting
- Export complete projects to **DOCX** (with RTL formatting and custom table styling), **EPUB3**, **HTML**, **TXT**, or raw **JSON**.

---

## 🏗️ Architecture & Communication Contract

### 1. Backend-Frontend Bridge (`pywebview`)
The desktop GUI is powered by `pywebview`, acting as a lightweight, native host window around the HTML5/JS frontend:
- **Frontend ➔ Backend**: All calls from JavaScript use asynchronous promises via `window.pywebview.api.<method_name>(...args)`.
- **Backend ➔ Frontend**: Python pushes real-time events, progress metrics, and LAN/Cloud updates directly by evaluating JavaScript (e.g., `window.evaluate_js("window.onLanUpdate(payload)")`).

### 2. Standardized 200 DPI Coordinate System
- PDF pages are natively rasterized at **72 DPI**.
- To ensure absolute coordinate precision across screen resolutions and high-DPI displays, `pdf_processor.py` extracts images at **200 DPI**.
- All bounding box coordinates stored in the database map strictly to this **200 DPI pixel grid**:
  $$\text{Target Width} = \left(\frac{\text{Native Width}}{72.0}\right) \times 200.0$$

### 3. Data Persistence & JSON Schema
Project files and metadata are stored locally in the `projects/` directory.

#### Project File Structure
```
projects/
└── <project_id>/
    ├── project.json
    ├── raw_ocr/
    └── images/
        ├── page_1.jpg
        └── page_2.jpg
```

#### Text Block Schema
```json
{
  "bbox": [120.5, 340.0, 850.0, 480.25],
  "category": "Text",
  "text": "بسم الله الرحمن الرحيم",
  "reviewed": false,
  "dir": "rtl",
  "align": "right"
}
```

---

## 📁 Repository Structure

```
OCR Review Tool/
├── backend/                  # Python Business Logic & Core API
│   ├── block_stitcher.py     # HTML DOM block stitcher & text re-mapper
│   ├── cloud_sync.py         # Cloud & WebRTC real-time sync engine
│   ├── dotsocr_client.py     # Dots OCR client integration
│   ├── epub_builder.py      # EPUB3 & HTML export generator
│   ├── exporter.py          # DOCX, TXT, and JSON exporter
│   ├── google_drive_ocr.py  # Google Drive API document OCR converter
│   ├── google_lens_ocr.py   # Async Google Lens OCR integration
│   ├── lan_discovery.py     # mDNS local peer discovery
│   ├── lan_sync.py          # Encrypted P2P socket sync server & client
│   ├── llm_ocr.py           # Vision LLM OCR interface via LiteLLM
│   ├── ocr_handler.py       # Unified OCR data parser & normalizer
│   ├── paddleocr_client.py   # PaddleOCR API client
│   ├── pdf_processor.py     # PyMuPDF page rasterization & SHA256 hashing
│   ├── project_manager.py   # Storage, metadata, & project lifecycle manager
│   ├── quran_handler.py     # Quranic verse search & verification engine
│   ├── table_handler.py     # Table structure management bridge
│   └── text_cleaner.py      # Arabic typography & text cleaning utilities
├── data/
│   └── Quran.json           # Complete Quranic text dataset
├── frontend/                 # PyWebView User Interface
│   ├── index.html           # Main home entrance
│   ├── projects.html        # Projects list page
│   ├── new-project.html     # Project creation wizard
│   ├── project-dashboard.html # Control center for batch OCR
│   ├── project-settings.html  # Per-project settings page
│   ├── review.html          # Interactive OCR review & layout editor
│   ├── settings.html        # General settings & shortcuts configuration
│   ├── css/                 # Modern UI styles
│   └── js/                  # Modular JavaScript libraries (100% offline)
├── table_detector/           # Standalone geometric table structure engine
│   ├── line_grid_detector.py # Bordered ruling-line grid finder
│   ├── blob_detector.py     # Text component blob finder
│   ├── column_finder.py     # Column alignment algorithm
│   ├── row_grouper.py       # Line and paragraph grouper
│   ├── row_reconciler.py    # Cross-column row union algorithm
│   ├── span_detector.py     # Cell merge and span detector
│   └── orchestrator.py      # Main table structure orchestrator
├── main.py                   # Main PyWebView application entry point
├── VERSION_HISTORY.md        # Comprehensive version & backup changelog
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+** (Python 3.10, 3.11, 3.12, or 3.14 supported).
- Internet connection only required for online OCR APIs (Google Lens, Vision LLMs, Google Drive). The core review UI, Quran matching, and local table detection are **100% offline**.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/ocr-review-tool.git
   cd "OCR Review Tool BETA"
   ```

2. **Install Required Python Dependencies**:
   ```bash
   pip install pywebview PyMuPDF python-docx opencv-python numpy pillow requests cryptography litellm aiortc google-api-python-client google-auth-oauthlib chrome-lens-py zeroconf
   ```

3. **Verify Data Files**:
   Confirm that `data/Quran.json` is located in the repository for Quranic verification functionality.

---

## 🏃 Running the Application

Launch the desktop interface by executing `main.py`:

```bash
python main.py
```

The native desktop window will open, presenting the **OCR Review Tool** dashboard.

---

## 💡 Quick Workflow Guide

1. **Create Project**: Click **New Project**, select a PDF, and choose the target OCR engine.
2. **Batch OCR Ingestion**: On the **Dashboard**, select page ranges, set LLM or API keys, customize system prompts, and monitor batch processing.
3. **Review & Edit**: Open `review.html` to review extracted text blocks, adjust bounding boxes, format tables, or clean Arabic text.
4. **Layout View Mode**: Click the **`⇄`** switch icon in the middle of the resize handle to toggle between **Top/Bottom** and **Side-by-Side** views for viewing long vertical texts.
5. **Verify Quran**: Select text and press right-click or launch Quran Verification to auto-correct scanned verses with formal citations.
6. **Export**: Export clean Word documents (`.docx`), EPUBs, HTML, TXT, or JSON.

---

## 📄 License & Attribution

Distributed under standard open-source licensing terms.