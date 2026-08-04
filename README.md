# 📖 Arabic OCR Review Tool

> **A simple desktop app to convert scanned Arabic PDFs into clean, editable Word, EPUB, and text files.**

You give it a scanned PDF, it reads the Arabic text with AI (multiple OCR engines), lets you review and fix the text boxes, tables, and Quran verses visually, and exports a beautiful final document.

**languages:** Python + HTML/CSS/JS, runs offline as a native window via `pywebview`.

---

## ✨ What Can It Do?

- **Read Arabic PDFs** with 4 OCR options:
  - **PaddleOCR** (free online, good for large books)
  - **Google Lens** (very accurate)
  - **Locro Offline** (works without internet, needs Chrome)
  - **AI Vision** (Gemini, Claude, GPT-4o, or any OpenAI-compatible model)

- **Review visually:** See the scanned page and text boxes side-by-side. Click a box to zoom, edit text, change type (Title, Text, Table, Picture, Poetry, etc.), drag to reorder, merge/split blocks.

- **Tables & Poetry:** 
  - Detects rows/columns automatically (even without lines)
  - Arabic poetry `شعر عمودي` (two hemistichs) and `شعر متدرج` (staggered) exported correctly with justification

- **Quran Check:** Select any text → right-click → Search Quran → verifies and inserts correct Uthmani text with citation `[الفاتحة :5]`

- **Arabic Text Cleaning:** One click to remove tatweel `ـ`, normalize hamza `أإآ→ا`, fix tanween `اً↔ًا`, remove tashkeel, fix punctuation and و spacing

- **Export:** 
  - **DOCX** – RTL, proper fonts, poetry tables, tables with merged cells
  - **EPUB3 / HTML** – RTL, kashida justification
  - **TXT / JSON** – with page separators

- **Team Work:** Share a project over local network (LAN) with password, see who is editing live

---

## 🚀 Installation

### 1. Requirements
- **Windows 10/11** (or Linux/macOS, but optimized for Windows)
- **Python 3.10+** – download from https://www.python.org
- **Google Chrome** – needed only for Locro offline OCR

### 2. Download
```bash
git clone https://github.com/adam76064/The_Arabic_OCR.git
cd The_Arabic_OCR
```

Or download ZIP from GitHub → Extract.

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

This installs:
- `pywebview` – native window
- `PyMuPDF` – PDF reading
- `python-docx` – Word export
- `Pillow`, `opencv-python`, `numpy` – image processing
- `requests`, `zeroconf`, `cryptography` – network & sync
- `chrome-lens-py`, `litellm` – OCR engines
- `typer` – for Locro

### 4. Run
```bash
python main.py
```

A window will open at 1280x800 showing the home screen.

---

## 📖 How To Use (4 Steps)

**Step 1 – New Project:**
- Home → **+ مشروع جديد**
- Choose PDF file
- Enter Title, Author, Logical start page (e.g., if PDF starts at page 5 of book)
- Optional: Enable LAN sharing + password

**Step 2 – Run OCR:**
- You will be redirected to **Dashboard**
- Select page range (e.g., `1-50` or `1-200`)
- Choose engine:
  - **PaddleOCR** – free, needs internet, 3 chunks/day limit tracked automatically
  - **Google Lens** – needs internet, very accurate, no limit
  - **Locro** – offline, needs Chrome installed
  - **LLM** – needs API key (Gemini/Claude/GPT), set system prompt if you want
- Click **Start** – progress bar shows `extracting → uploading → completed`

**Step 3 – Review:**
- Click **فتح** on project → **مراجعة**
- **Top toolbar:** Previous/Next page, Undo/Redo, Save, View Full Text, Dashboard, Text size A-/A+, Tracking settings
- **Middle:** Crop viewer (zoom in/out) shows selected block zoomed
- **Right:** List of text blocks:
  - Click to select (yellow border)
  - Click label to change type (نص عادي, عنوان, جدول, etc.)
  - **مراجَع** button toggles reviewed (green border)
  - **✕** deletes
  - Drag `⋮⋮` to reorder
  - Right-click → **بحث في القرآن** or **دمج / تقسيم**
  - Edit directly (bold, italic, alignment, direction)
- **Thumbnail:** Small in toolbar, hover to expand, click for full-page view with all boxes clickable
- **Quran Modal:** Search by text or manual surah/ayah, select verses, check "إضافة التخريج", Insert
- **Table:** If block is Table, click **Auto Layout** to detect rows/columns (3 methods: vectors, coordinates, smear)

**Step 4 – Export:**
- In Review → **Dashboard** → **Export** section
- Or from `export.html`
- Choose pages, format (DOCX/EPUB/HTML/TXT/JSON), destination folder
- Options: Page numbering `none/pdf/logical`, Text mode `formatted (clean)` vs `raw (keep tags)`
- Click Export – file saved as `YourTitle.docx` etc.

---

## 📦 Where Are My Files?

App data is stored in:
- **Windows:** `%APPDATA%\The_Arabic_OCR\projects\`
- Each project folder:
  ```
  <project_id>/
    project.json         # all text & layout
    raw_ocr/             # original OCR backup
    images/              # page_0.jpg, page_1.jpg at ~200 DPI
  ```
You can change location in **Settings → Data Folder**.

---

## 🔧 Requirements Explained Simply

- `pywebview` ≥4.0 – creates native window around HTML
- `PyMuPDF` – reads PDFs
- `python-docx` – creates Word files
- `Pillow` + `opencv-python` + `numpy` – image cropping & table detection
- `requests` – talks to Paddle/Google/LM APIs
- `zeroconf` + `cryptography` – finds teammates on same WiFi and encrypts sync
- `chrome-lens-py` – Google Lens
- `litellm` – one library to talk to Gemini/Claude/GPT
- `typer` + `locro` – offline AI using Chrome's model

See `requirements.txt` for exact versions.

---

## 📚 For Developers & AI Agents

If you want to understand the code, add a new OCR engine, new export format, or contribute:

👉 **Read `DEVELOPER_GUIDE.md`** – 60k words, explains every folder, file, function, coordinate system (72 DPI vs 200 DPI vs 1000 normalized), pipelines, data models, design tokens, and how to extend.

Also see:
- `ARCHITECTURE_PLAN.md` – initial rebuild plan
- `TODO.md` – phase checklist (all done)

Old import paths still work via shim files (`backend/config_manager.py` → `backend.core.config` etc.) for backward compatibility.

---

## 📄 License

Open source – same as original. Feel free to use, modify, and contribute.

---

## 🙏 Credits

- Original OCR Review Tool by Adam Mustafa
- Rebuilt & organized by Arena AI Agent (Claude, GPT, etc.)
- Quran dataset `data/Quran.json` – Uthmani text
- Table detection algorithms based on classic computer vision (blob, column finding, row grouping)

**God be with you – and happy OCR!**

If this tool helped you digitize an Arabic book, please star ⭐ the repo!
