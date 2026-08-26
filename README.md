# 📖 Arabic OCR Review Tool

> **A desktop-grade application to convert scanned Arabic PDFs into clean, beautifully structured Word (DOCX), EPUB, HTML, and text documents.**

Arabic OCR Review Tool takes scanned Arabic books and documents, performs AI-powered OCR with multi-engine support, provides an interactive ScanTailor-powered Pre-Processing Studio, lets you review and format text boxes, tables, and Quran verses visually, and exports clean, publication-ready documents.

Runs offline as a native desktop window via Python and `pywebview`.

---

## ✨ Features

### 1. Pre-Processing Studio (ScanTailor Advanced)
An interactive 6-stage studio to enhance scan quality and prepare pages before OCR:
- **1. Orientation:** Auto-orientation detection and 90°/180°/270° rotation.
- **2. Page Split:** Automatic detection of book spreads vs. single pages with sloped cutter line and sub-page generation.
- **3. Deskew:** Sub-pixel skew estimation (Radon / Hough baselines) and fine-angle interactive slider (-45° to +45°) with alignment grid.
- **4. Select Content:** Smart bounding box detection to extract text areas and eliminate dark scanner borders.
- **5. Margins & Layout:** Configurable margins (mm / px) and multi-axis alignment (center, top, bottom) with project-wide dimension standardization (`match_size`).
- **6. Output & Binarization:** Otsu, Sauvola, and Wolf binarization engines, illumination normalization, despeckling, and an interactive split-curtain slider to compare original scans with binarized results.
- **Batch Processing Wizard:** Apply single stages or the full pipeline across all pages or custom page ranges.

### 2. Multi-Engine Arabic OCR
- **PaddleOCR:** Free cloud recognition with automatic daily limit tracking.
- **Google Lens:** High-accuracy vision extraction for complex Arabic typography.
- **Locro Offline:** Fully offline OCR powered by Chrome's ScreenAI engine (no internet required).
- **LLM Vision:** Support for Gemini, Claude, GPT-4o, and OpenAI-compatible vision models with custom system prompts.

### 3. Visual Review & Layout Editing
- **Side-by-Side Review:** High-resolution page scan and interactive text bounding boxes side-by-side with pan and zoom.
- **Block Formatting:** Classify text into Title, Section Header, Paragraph, Caption, Footnote, Quran, Picture, Table, Poetry, or Page Number.
- **Arabic Poetry Formatting:** First-class support for two-hemistich classical poetry (`شعر عمودي`) and staggered modern poetry (`شعر متدرج`) with automatic justification.
- **Table Engine:** Auto-detects table grids, rows, and columns using visual line heuristics, word coordinates, and smear algorithms.
- **Quran Verification & Citation:** Right-click any text block to search the built-in Uthmani Quran database, verify against authentic text, and insert with citation references (e.g. `[الفاتحة: 5]`).
- **Arabic Typography Cleaning:** One-click normalization of hamza (`أإآ → ا`), tatweel (`ـ`), tanween (`اً ↔ ًا`), tashkeel removal, and punctuation/waw spacing fixes.

### 4. Post-Processing Pipeline
- **Arabic Reading Order Auto-Sorter:** Multi-column spatial layout detection that sorts blocks in true Arabic reading order (Top-to-Bottom, Right-to-Left).
- **Pagination Auto-Detector:** Automatically identifies page numbers in headers and footers across Arabic-Indic (`٠-٩`), Persian (`۰-۹`), and ASCII digits, validating numerical sequence continuity.

### 5. Multi-Format Document Export
- **DOCX (Word):** True RTL layout, embedded font styling, Arabic poetry tables, and merged table cells.
- **EPUB3 & HTML:** Responsive RTL styling with kashida justification.
- **TXT & JSON:** Clean plaintext with page separators and structured bounding box JSON data.

### 6. Team Collaboration & LAN Sharing
- Share projects over your local network (LAN) with password-protected sync to collaborate with team members in real time.

### 7. Multilingual Interface
- Available in **Arabic** (RTL), **English** (LTR), and **German** (LTR).

---

## 🚀 Installation & Setup

### Prerequisites
- **Operating System:** Windows 10/11 (also compatible with Linux and macOS)
- **Python:** 3.10 or higher
- **Google Chrome:** (Optional) Required only if using the offline Locro ScreenAI engine

### 1. Clone the Repository
```bash
git clone https://github.com/adam76064/The_Arabic_OCR.git
cd The_Arabic_OCR
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Launch the Application
```bash
python main.py
```

---

## 📖 Quick Start Guide

1. **Create a Project:**
   - From the Home screen, click **+ New Project** (**+ مشروع جديد**).
   - Select a scanned PDF file, set the title and author, and specify logical page numbering.

2. **Pre-Process Scans (Optional but Recommended):**
   - Open the **Preprocessing Studio** to split spreads, deskew pages, trim borders, and standardize margins.
   - Run the Batch Wizard to apply enhancements across the entire book.

3. **Extract Text with OCR:**
   - On the Project Dashboard, choose your preferred OCR engine and target page range.
   - Click **Start OCR** to extract text and layout geometry.

4. **Review & Refine:**
   - Open the **Review** screen to inspect recognized text, adjust bounding boxes, format tables and poetry, and verify Quranic verses.

5. **Export:**
   - Go to **Export**, choose your target format (DOCX, EPUB, HTML, TXT, or JSON), and save your finalized document.

---

## 📁 Project Data Structure

Application data and projects are stored in:
- **Windows:** `%APPDATA%\The_Arabic_OCR\projects\<project_id>\`
  ```
  <project_id>/
  ├── project.json       # Page metadata, geometry, and project settings
  ├── pages/             # Per-page modular OCR text storage (page_0.json, ...)
  ├── images/            # Working page images (page_0.jpg, ...)
  ├── thumbs/            # Pre-generated ~160px dashboard thumbnails
  ├── raw_images/        # Pristine original backup for lossless reversions
  └── raw_ocr/           # Original raw OCR engine output backups
  ```

---

## 🛠️ Automated Testing

Run the automated test suite using `pytest`:
```bash
pytest tests/ -v
```

---

## 📚 Developer Documentation

For technical architecture details, module structures, coordinate systems, and extension guidelines, see **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)**.

---

## 📄 License & Acknowledgments

- **Core Application & Architecture:** Developed by Adam Mustafa.
- **ScanTailor Advanced (`stalib`):** Image preprocessing, page splitting, deskewing, and binarization algorithms adapted from ScanTailor Advanced. Special thanks to [Roan George](https://github.com/roangeorge) for guiding the refactoring of ScanTailor Advanced to work natively with Python, and to [David Bowman](https://github.com/dbowm91) for guidance on GitHub Actions pre-compilation across platforms.
- **Locro Engine:** Python bridge for Chrome ScreenAI offline recognition (`backend/vendor/locro/`).
- **Quran Dataset:** Authentic Uthmani script text database (`data/Quran.json`).
- **Table Detection:** Visual column and row segmentation algorithms based on computer vision heuristics.

If this tool helped you digitize an Arabic book, please star ⭐ the repo!
