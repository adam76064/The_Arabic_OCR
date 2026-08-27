# 🎨 Arabic OCR — Complete Frontend & GUI Refactoring Specification

> **Architectural Blueprint, Design Manifesto, Phased Roadmap & Exhaustive To-Do Checklist**
> 
> *Goal:* Transform the Arabic OCR Review Tool into a calm, world-class, lightning-fast desktop creative studio (`محراب رقمنة الكتب`) with zero emojis, a truly effective dark mode, elegant Arabic typography, and a single-window workflow—preserving 100% of underlying backend functionalities.

---

## 📑 Table of Contents
1. [Design Manifesto & Core Principles](#1-design-manifesto--core-principles)
2. [Visual Identity & Color System](#2-visual-identity--color-system)
3. [Workspace Architecture: The 3-Zone Desktop Shell](#3-workspace-architecture-the-3-zone-desktop-shell)
4. [Screen-by-Screen Redesign Specifications](#4-screen-by-screen-redesign-specifications)
5. [Performance & Technical Guardrails](#5-performance--technical-guardrails)
6. [Phased Refactoring Roadmap](#6-phased-refactoring-roadmap)
7. [Comprehensive To-Do Checklist](#7-comprehensive-to-do-checklist)
8. [File Structure & Component Mapping](#8-file-structure--component-mapping)

---

## 1. Design Manifesto & Core Principles

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE DESIGN MANIFESTO                                   │
│                                                                                        │
│  1. ZERO EMOJIS          │  100% Engineered 16px/18px stroke-based SVG vector icons.  │
│  2. CALM & UN-CRAMMED    │  Generous gutters, 44px slim toolbars, breathing room.      │
│  3. LIGHTNING FAST       │  Vanilla JS, CSS GPU transitions, 0ms view switching.       │
│  4. EFFECTIVE NIGHT MODE │  Deep neutral charcoal studio (#0e1117) — zero eye strain. │
│  5. EDITORIAL CRAFT      │  Authentic Arabic typography (Amiri / IBM Plex Sans Arabic).│
│  6. 100% COMPATIBILITY   │  Preserves all Python backend APIs, IPC events & schemas.   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Zero Emojis Policy (100% Vector Precision):**
   - Eliminate all Unicode emojis (`📑`, `⚙️`, `📄`, `💡`, `🔍`, `⚠️`, `✓`, `📡`, `🔔`, `🗑️`) from the interface.
   - Replace every icon with an engineered, stroke-based SVG vector (`16×16` or `18×18`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke="currentColor"`).
   - Icons inherit text and button colors automatically and cleanly scale to any DPI.

2. **Calm, Un-Crammed Workspace & Visual White Space:**
   - Eliminate redundant vertically-stacked toolbars. Replace them with a single slim 44px top header, an optional 48px left rail, and a right contextual inspector.
   - Use generous spacing (16px/24px gutters), subtle 1px border dividers (`rgba(0,0,0,0.06)` light / `rgba(255,255,255,0.08)` dark), and soft modern radii (`6px` to `10px`).
   - Treat scanned pages and editable documents with a **physical paper metaphor** resting on a calm, clean desk.

3. **Restrained Categorization (No Color Overload):**
   - Eliminate thick, neon-colored solid borders around text blocks.
   - Indicate categories (Quran, Title, Footnote, Poem, Table) with a **subtle 3px vertical edge accent bar** and an unobtrusive typographic pill badge.

4. **Lightning-Fast & Lightweight Single-Window Shell (SPA):**
   - Replace multi-page HTML navigation and full-page reloads with a **Single Desktop Shell (`frontend/index.html`)**.
   - Switching between **Projects**, **Preprocessing Studio**, **OCR Dashboard**, **Review & Typography**, and **Export** happens instantly in **0 milliseconds** with zero white flashes and preserved session state.

---

## 2. Visual Identity & Color System

### ☀️ Light Mode: "Calm Ivory & Slate"
- **App Background (`--color-bg`):** `#f8fafb` (Ultra-soft, cool porcelain gray that prevents monitor glare).
- **Workspace Canvas (`--color-canvas`):** `#eef2f6` (Calm, neutral studio desk background).
- **Surface / Card Background (`--color-surface`):** `#ffffff` (Crisp white with ambient shadow `0 1px 3px rgba(0,0,0,0.04)`).
- **Elevated Surface (`--color-surface-elevated`):** `#ffffff` (Drop shadow `0 8px 24px rgba(0,0,0,0.08)` for menus/modals).
- **Borders & Dividers (`--color-border`):** `#e2e8f0` (Subtle, razor-sharp hairline borders).
- **Borders Strong (`--color-border-strong`):** `#cbd5e1`.
- **Text Primary (`--color-text`):** `#0f172a` (Deep Slate - maximum legibility without harsh absolute black).
- **Text Secondary (`--color-text-secondary`):** `#334155` / `#475569`.
- **Text Muted / Hints (`--color-text-muted`):** `#64748b` / `#94a3b8`.
- **Brand Accent (`--color-primary`):** `#0f766e` (Deep Emerald Teal - scholarly, refined Arabic heritage signature).
- **Brand Accent Light (`--color-primary-light`):** `#f0fdfa`.

### 🌙 Night Mode: "Deep Charcoal Studio" (True Low-Light Comfort)
- **App Background (`--color-bg`):** `#0e1117` (Deep neutral charcoal; zero haloing, zero muddy saturated blues).
- **Workspace Canvas (`--color-canvas`):** `#090d14` (Deep matte desk canvas for scan inspection).
- **Surface / Panels (`--color-surface`):** `#161b22` (Slightly elevated charcoal).
- **Elevated Surface (`--color-surface-elevated`):** `#1c2129` (Clean contrast for dropdowns, tooltips, dialogs).
- **Cards / Active Blocks (`--color-card`):** `#1e242d`.
- **Borders (`--color-border`):** `rgba(255, 255, 255, 0.08)`.
- **Borders Strong (`--color-border-strong`):** `rgba(255, 255, 255, 0.15)`.
- **Text Primary (`--color-text`):** `#f1f5f9` (Soft pearl white).
- **Text Secondary (`--color-text-secondary`):** `#cbd5e1`.
- **Text Muted (`--color-text-muted`):** `#8b949e`.
- **Scan Invert / Darken Canvas:** Dedicated toggle to softly dim or invert glaring white scanned PDFs during late-night review sessions.

### 🏷️ Categorical Accent Tokens (Subtle 3px Indicator Bars)
- **Quranic Verse (`--cat-quran`):** `#059669` (Emerald)
- **Title / Major Heading (`--cat-title`):** `#7c3aed` (Violet)
- **Section Heading (`--cat-header`):** `#6366f1` (Indigo)
- **Classical / Modern Poetry (`--cat-poem`):** `#d97706` (Amber)
- **Table / Data Grid (`--cat-table`):** `#2563eb` (Sapphire)
- **Footnote / Annotation (`--cat-footnote`):** `#64748b` (Slate)
- **Page Number (`--cat-page-num`):** `#0d9488` (Teal)
- **Image / Figure (`--cat-image`):** `#db2777` (Rose)

---

## 3. Workspace Architecture: The 3-Zone Desktop Shell

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Arabic OCR │ [📁 Projects] [📐 Preprocessing] [🤖 OCR Dashboard] [✍️ Review] [📦 Export] │ [🌙 Theme] [⚙️]  │
├──────────────┬───────────────────────────────────────────────────────────────────┬────────────────────────────────┤
│ LEFT RAIL    │                         CENTER CANVAS                             │          RIGHT PANEL           │
│ (48px / Coll)│                    (The Active Studio Stage)                      │     (Contextual Inspector)     │
│              │                                                                   │                                │
│ • Filmstrip  │  Split View (Seamless 50/50, 70/30, Full Screen):                 │ • Selected Block Type & Label  │
│ • Page List  │  ┌──────────────────────────────┬──────────────────────────────┐  │ • Text Typography & Spacing    │
│ • Page Jump  │  │ High-Resolution Scan         │ Interactive Arabic Document  │  │ • Arabic Text Cleaning Rules   │
│ • Filter Tag │  │ (GPU Pan/Zoom Canvas)        │ (Amiri / Scheherazade Naskh) │  │ • Table Grid & Cell Merging    │
│ • Bookmarks  │  │ [ Bounding Box Overlays ]    │ [ Drag & Reorder Handles ]   │  │ • Quran Ayah Search & Verify   │
│              │  └──────────────────────────────┴──────────────────────────────┘  │ • Reading Order & Direction    │
│              │                                                                   │                                │
├──────────────┴───────────────────────────────────────────────────────────────────┴────────────────────────────────┤
│ STATUS BAR: Page 14 of 180 (PDF p. 18) • 12 Blocks • 98.4% Confidence • Reading Order: RTL • Saved               │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Screen-by-Screen Redesign Specifications

### A. Projects Hub View
- **Drag-and-Drop Zone:** Minimalist dashed outline with a subtle vector upload icon, instant file metadata pill (title, pages, file size), and 1-click project creation.
- **Projects Grid & Table Switcher:** Clean cards with circular progress indicators, last modified dates, page count badges, and a "Resume Last Page" button.
- **Instant Search & Filter:** Filter by *Completed*, *In Progress*, or *New* with instant debounced filtering.

### B. Pre-Processing Studio View (ScanTailor)
- **Stage Ribbon:** Slim, modern 6-stage indicator (`Orientation` → `Split` → `Deskew` → `Content` → `Layout` → `Output`) with applied stage checkmarks (`✓`).
- **Instant Before/After Peeker:** Hold `Spacebar` or `Tab` to momentarily view the raw scan and release to inspect the preprocessed output.
- **Focal-Point Mouse Zoom:** Hardware-accelerated zoom centering directly onto the mouse pointer coordinates.
- **Collapsible Stage Parameters Sidebar:** Clean sliders with live numerical readout pills and quick reset buttons.

### C. Review & Typography Studio View
- **Side-by-Side Ergonomic Split:** Seamless splitter with double-click snap presets (50/50, 70/30, Full Text, Full Scan) and session memory.
- **Typographic Precision:** Arabic text rendered in rich Naskh (`Amiri`, `Traditional Arabic`) with generous `1.8`–`2.0` line-heights preventing diacritic collision.
- **Contextual Inspector Panel:** Clicking any block automatically populates the right panel with its corresponding tools (e.g. Table tools for tables, Quran search for scripture, Poetry tools for hemistichs).
- **Floating Quick-Action Toolstrip:** Compact bubble appearing over selected text (*Bold*, *Italic*, *Verify in Quran*, *Normalize Hamza*, *Convert Digits*).
- **In-Editor Search & Replace (`Ctrl+F` / `Ctrl+H`):** Fast bottom drawer for project-wide and page-level text replacements.

### D. OCR Dashboard View
- **Batch Processing Center:** Clean page grid with lazy-loaded thumbnails, multi-page selection (`Shift+Click`), and pipeline stage badges (📐, ✂️, 🔲, 🤖, ✅).
- **Floating Batch Bar:** Smooth slide-up pill displaying selected page count with quick actions (*Run OCR*, *Batch Preprocess*, *Mark Reviewed*).
- **Unobtrusive Background Progress:** Minimal floating progress widget in the lower corner with time estimates and cancel support.

### E. Export Studio View
- **Live Output Preview:** Side-by-side rendering showing how the finalized first 2 pages will look in DOCX/EPUB format before exporting.
- **1-Click Presets:** Quick cards for *"Word Publication (.docx)"*, *"E-Book (.epub3)"*, *"AI Dataset (.json)"*, and *"Plaintext (.txt)"*.

### F. Global & Project Settings
- **Categorized Clean Tabs:** *General*, *Data Storage*, *OCR & AI Engines*, *Typography*, *Shortcuts*, and *Collaboration*.
- **Live Rule Sandbox:** Color-coded token preview highlighting exactly which regex rule cleans which Arabic word in real time.

---

## 5. Performance & Technical Guardrails

1. **Lightweight & Fast:**
   - Pure Vanilla JS (ES6+ Modules) — No heavy frameworks (React/Vue/Angular), keeping bundle footprint $< 200 \text{ KB}$.
   - Hardware-accelerated CSS transforms (`translate3d`, `opacity`, `will-change`) for 60 FPS pan/zoom and transitions.
2. **Zero Backend Changes Needed:**
   - All Python services in `backend/` (`api.py`, `projects.py`, `pdf.py`, `ocr/`, `preprocessing/`, `table/`, `export/`, `quran.py`) remain 100% untouched.
   - Preserves identical IPC API contracts (`window.pywebview.api.<method>()`) and event listeners (`window.onEvent`).
3. **Storage & Data Model Safety:**
   - Fully compatible with existing `project.json`, `pages/page_{idx}.json`, and 72 DPI PostScript coordinate spaces.

---

## 6. Phased Refactoring Roadmap

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Design Tokens, SVG Icons & Dark/Light Theming      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Single-Window Desktop Shell & Navigation           │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Review Studio & Right Contextual Inspector         │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Pre-Processing Studio UI Overhaul                  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Dashboard, Batch Bar & Projects Hub Polish         │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 6: Export Studio, Settings Sandbox & Power Suite      │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Comprehensive To-Do Checklist

### Phase 1: Design Tokens, SVG Icons & Dark/Light Theming
- [x] **1.1 Design Token Overhaul (`frontend/css/tokens.css`)**
  - Define complete calm Light Mode palette (`--color-bg: #f8fafb`, `--color-canvas: #eef2f6`, `--color-surface: #ffffff`).
  - Define complete Deep Charcoal Dark Mode palette (`--color-bg: #0e1117`, `--color-canvas: #090d14`, `--color-surface: #161b22`, `--color-card: #1e242d`).
  - Set up typography variables (`--font-ui: 'IBM Plex Sans Arabic', 'Cairo', sans-serif`, `--font-doc: 'Amiri', 'Traditional Arabic', serif`).
  - Define category accent border tokens (`--cat-*-accent`).
- [x] **1.2 Complete Zero-Emoji SVG Icon Registry (`frontend/js/icons.js`)**
  - Implement 100% stroke-based SVG icons (`16×16` / `18×18`, `stroke-width="1.75"`) for all actions.
  - Audit and strip all emojis from HTML templates, JS strings, notifications, tooltips, and dialogs.
- [x] **1.3 Base Typography & Focus Ring System (`frontend/css/base.css`)**
  - Configure crisp Arabic line heights, anti-aliasing (`text-rendering: optimizeLegibility`), and accessible `:focus-visible` styling.

### Phase 2: Single-Window Desktop Shell & Navigation
- [x] **2.1 Unified Master Desktop Shell (`frontend/index.html` & `app.css`)**
  - Create the slim 44px top header containing App Brand, View Switcher Tabs (*Projects*, *Preprocessing*, *OCR Dashboard*, *Review*, *Export*), Page Navigation Stepper, and Theme Toggle.
  - Build the collapsible 48px left activity rail for navigation and filmstrip access.
- [x] **2.2 Zero-Latency View Router & Navigation**
  - Instant navigation and clean transitions between views without white flashes.
  - Maintain active project and page state seamlessly across view switches.
- [x] **2.3 Universal Non-Blocking Dialogs & Toast Notifications**
  - Clean `AestheticDialog` modals and zero-emoji tokenized `Notifications.show()`.

### Phase 3: Review Studio & Right Contextual Inspector
- [x] **3.1 Ergonomic Dual-Pane Split Layout (`frontend/css/review.css`)**
  - Build responsive side-by-side workspace with smooth drag handle, snap presets, and session memory.
  - Apply physical floating paper styling to the Arabic text canvas and scan image.
- [x] **3.2 Restrained Categorization Indicators**
  - Replace thick solid colored block borders with 3px vertical accent bars and subtle pill tags.
- [x] **3.3 Right Contextual Inspector & Formatting Tools**
  - Dynamic toolbar and inspector for text formatting, table grids, and Quran verification.
- [x] **3.4 Quick-Action Formatting & Brushes**
  - Zero-emoji SVG formatting brushes, diacritic removal, and format painters.
- [x] **3.5 In-Editor Search & Replace System**
  - Drawer and shortcuts for page and book-level text replacements.

### Phase 4: Pre-Processing Studio UI Overhaul
- [x] **4.1 Studio Ribbon & Stage Badges (`frontend/css/preprocessing.css`)**
  - Streamline 6-stage navigation tab bar with checkmarks (`✓`) on applied stages.
- [x] **4.2 Instant Before/After Raw Scan Peeker**
  - Zero-emoji overlays and guide grid lines for deskew, split, and orientation.
- [x] **4.3 Focal-Point Mouse Canvas Zooming**
  - Hardware-accelerated zoom and pan across all stages.
- [x] **4.4 Simplified Parameters Sidebar**
  - Modernized sliders, angle readouts, and stage action buttons with clean tokens.

### Phase 5: Dashboard, Batch Bar & Projects Hub Polish
- [x] **5.1 Projects Hub Redesign**
  - Clean project cards with progress rings and "Resume Last Page" quick action.
- [x] **5.2 Multi-Page Range Selection (`Shift+Click`)**
  - Support selecting page ranges on the dashboard grid and table view.
- [x] **5.3 Floating Batch Action Bar & Stage Badges**
  - Render mini status tags on thumbnails and floating batch action bar for batch OCR.
- [x] **5.4 Skeleton Shimmer Placeholders**
  - Smooth skeleton loading states for thumbnails and project lists.

### Phase 6: Export Studio, Settings Sandbox & Power Suite
- [x] **6.1 Live Document Export Studio (`frontend/export.html`)**
  - Multi-format selectable cards for DOCX, EPUB, JSON, and TXT.
- [x] **6.2 1-Click Export Preset Cards**
  - Tokenized format selection with zero emojis.
- [x] **6.3 Regex Rule Sandbox Token Highlighting**
  - Live preview highlighting Arabic text cleaning rules in real time.
- [x] **6.4 Global Command Palette (`Ctrl+K` / `Ctrl+P`)**
  - Spotlight modal (`command-palette.js`) to jump to pages, search projects, or toggle dark mode.

---

## 8. File Structure & Component Mapping

```
frontend/
├── index.html                   # Unified Single Desktop Studio Shell
│
├── css/
│   ├── tokens.css               # Design system tokens (Light & Deep Charcoal Dark mode)
│   ├── base.css                 # Typography, reset, focus rings, scrollbars
│   ├── components.css           # Buttons, cards, modals, inspector, command palette
│   ├── layout.css               # 3-Zone desktop grid (Top ribbon, left rail, right inspector)
│   ├── preprocessing.css        # Preprocessing studio canvas & overlay styling
│   └── review.css               # Side-by-side review workspace & paper sheet styling
│
└── js/
    ├── core/
    │   ├── api.js               # IPC bridge wrapping window.pywebview.api
    │   ├── events.js            # Python-to-JS event listener
    │   ├── router.js            # Zero-latency in-memory view switcher
    │   ├── store.js             # Reactive application state
    │   └── utils.js             # Formatting, DOM & bidi helpers
    ├── icons.js                 # Centralized 100% SVG icon registry (Zero Emojis)
    ├── i18n/                    # Multilingual catalogs (ar, en, de)
    ├── components/
    │   ├── modal.js             # AestheticDialog & confirmation dialogs
    │   ├── notifications.js     # Toast notification tray
    │   ├── inspector.js         # Right contextual inspector panel
    │   ├── command-palette.js   # Spotlight command palette (Ctrl+K)
    │   ├── quran/               # Quran search, verify & citation injector
    │   └── tables/              # Table grid builder & cell merger
    └── pages/
        ├── projects.js          # Projects Hub controller
        ├── preprocessing/       # Pre-processing studio controller & canvas overlays
        ├── dashboard.js         # OCR dashboard & batch selection controller
        ├── review/              # Review studio, text sync & typography controller
        └── export.js            # Export studio controller & live preview
```

---

*This specification is saved and maintained in `FRONTEND_ENHANCEMENT_PLAN.md`.*
