"""
test_enhancements_e2e.py — Comprehensive End-to-End Tests for Architectural & Functional Enhancements.

Covers:
1. Multi-Column Recursive XY-Cut (L-1)
2. Nastaliq & Decorative Font Auto-Reroute & CMap Corruption Detection (L-2, L-10)
3. Arabic Poetry Auto-Detection (L-6)
4. Cross-Page Paragraph Continuation (L-3)
5. Global Search & Replace Across Project (F-1)
6. PDF Reconstruction Export: Flowing & Exact Modes (F-2)
7. Project Version History Snapshots & Restoration (F-5)
8. CSS Syntax Integrity & Flex Cascade Verification (BUG-01 .. BUG-05)
"""

import os
import re
import json
import shutil
import tempfile
import pytest

from backend.core.digital_extractor import DigitalPDFExtractor
from backend.core.projects import ProjectManager
from backend.export.pdf_export import export_pdf, _shape_arabic
from backend.export.docx_export import export_docx
from backend.export import export_project


# ── 1. Multi-Column Recursive XY-Cut (L-1) ────────────────────────────────────

def test_xy_cut_two_column_rtl_ordering():
    """Verify that a 2-column page orders Column 0 (Right) before Column 1 (Left) in RTL."""
    page_w = 600.0
    page_h = 800.0

    # Synthetic 2-column page:
    # Right column (x in [320, 560]):
    #   Block R1 at y=100..150
    #   Block R2 at y=170..220
    # Left column (x in [40, 280]):
    #   Block L1 at y=110..160
    #   Block L2 at y=180..230
    blocks = [
        {"category": "Text", "bbox": [40, 110, 280, 160], "text": "عمود أيسر - فقرة 1"},
        {"category": "Text", "bbox": [320, 100, 560, 150], "text": "عمود أيمن - فقرة 1"},
        {"category": "Text", "bbox": [40, 180, 280, 230], "text": "عمود أيسر - فقرة 2"},
        {"category": "Text", "bbox": [320, 170, 560, 220], "text": "عمود أيمن - فقرة 2"},
    ]

    sorted_blocks, total_cols = DigitalPDFExtractor._sort_blocks_xy_cut(blocks, page_w, page_h)

    assert total_cols == 2, f"Expected 2 columns, detected {total_cols}"
    assert len(sorted_blocks) == 4

    # RTL order check: Right column must come first!
    texts = [b["text"] for b in sorted_blocks]
    assert texts[0] == "عمود أيمن - فقرة 1", f"First block should be Right-1, got {texts[0]}"
    assert texts[1] == "عمود أيمن - فقرة 2", f"Second block should be Right-2, got {texts[1]}"
    assert texts[2] == "عمود أيسر - فقرة 1", f"Third block should be Left-1, got {texts[2]}"
    assert texts[3] == "عمود أيسر - فقرة 2", f"Fourth block should be Left-2, got {texts[3]}"
    print("[PASS] XY-Cut correctly prioritized right-column over left-column in RTL mode.")


def test_xy_cut_multi_column_with_spanning_headers():
    """Verify that wide horizontal elements (e.g. section headers) slice the page into slices without breaking RTL column order."""
    blocks = [
        {"category": "Title", "bbox": [50, 50, 550, 90], "text": "عنوان رئيسي عريض"},
        {"category": "Text", "bbox": [320, 100, 560, 150], "text": "عمود أيمن 1"},
        {"category": "Text", "bbox": [40, 100, 280, 150], "text": "عمود أيسر 1"},
        {"category": "Section-header", "bbox": [50, 200, 550, 240], "text": "عنوان فرعي يقطع الصفحة عرضياً"},
        {"category": "Text", "bbox": [320, 260, 560, 310], "text": "عمود أيمن 2"},
        {"category": "Text", "bbox": [40, 260, 280, 310], "text": "عمود أيسر 2"},
    ]
    sorted_blocks, total_cols = DigitalPDFExtractor._sort_blocks_xy_cut(blocks, 600.0, 800.0)
    assert total_cols == 2
    texts = [b["text"] for b in sorted_blocks]
    assert texts == [
        "عنوان رئيسي عريض",
        "عمود أيمن 1",
        "عمود أيسر 1",
        "عنوان فرعي يقطع الصفحة عرضياً",
        "عمود أيمن 2",
        "عمود أيسر 2",
    ]
    print("[PASS] Multi-column XY-Cut with spanning headers verified RTL order.")


def test_xy_cut_single_column_preservation():
    """Single-column pages should preserve natural top-down vertical reading order."""
    page_w = 600.0
    page_h = 800.0
    blocks = [
        {"category": "Text", "bbox": [50, 200, 550, 250], "text": "فقرة ثانية"},
        {"category": "Title", "bbox": [100, 80, 500, 120], "text": "عنوان رئيسي"},
        {"category": "Text", "bbox": [50, 140, 550, 190], "text": "فقرة أولى"},
    ]

    sorted_blocks, total_cols = DigitalPDFExtractor._sort_blocks_xy_cut(blocks, page_w, page_h)
    assert total_cols == 1
    texts = [b["text"] for b in sorted_blocks]
    assert texts == ["عنوان رئيسي", "فقرة أولى", "فقرة ثانية"]
    print("[PASS] Single column XY-Cut preserved top-to-bottom order.")


# ── 2. Font Category & CMap Corruption Detection (L-2, L-10) ──────────────────

def test_font_category_detection():
    assert DigitalPDFExtractor.detect_font_category("Nafees Nastaleeq") == "nastaliq"
    assert DigitalPDFExtractor.detect_font_category("Urdu Nastaliq Unicode") == "nastaliq"
    assert DigitalPDFExtractor.detect_font_category("DecoType Thuluth") == "decorative"
    assert DigitalPDFExtractor.detect_font_category("Kufi Standard") == "decorative"
    assert DigitalPDFExtractor.detect_font_category("Traditional Arabic") == "naskh"
    assert DigitalPDFExtractor.detect_font_category("Amiri Regular") == "naskh"
    assert DigitalPDFExtractor.detect_font_category("Helvetica") == "standard"
    print("[PASS] Font family categories correctly classified.")


def test_corruption_rate_calculation():
    clean_text = "بسم الله الرحمن الرحيم - نص سليم تماماً"
    assert DigitalPDFExtractor.compute_corruption_rate(clean_text) == 0.0

    corrupt_text = "نص\ufffd يحتوي \ue001\ue002 على رموز تالفة"
    rate = DigitalPDFExtractor.compute_corruption_rate(corrupt_text)
    assert rate > 0.08, f"Expected > 8% corruption rate, got {rate}"
    print("[PASS] CMap corruption rate calculation verified.")


# ── 3. Arabic Poetry Detection (L-6) ──────────────────────────────────────────

def test_poetry_auto_detection():
    poetry_text = (
        "ولد الهدى فالكائنات ضياء ... وفم الزمان تبسم وثناءُ\n"
        "الروح والملأ الملائك حوله ... للدين والدنيا به بشراءُ\n"
        "والعرش يزهو والحظيرة تزدهي ... والمنتهى والسدرة العصماءُ"
    )
    assert DigitalPDFExtractor.is_poetry(poetry_text) is True

    prose_text = (
        "يعتبر استخراج النصوص من ملفات البي دي إف عملية معقدة للغاية.\n"
        "تتطلب معالجة الكلمات وتحديد الخطوط والتنسيقات الهندسية بدقة."
    )
    assert DigitalPDFExtractor.is_poetry(prose_text) is False
    print("[PASS] Arabic poetry detector correctly distinguished verse from prose.")


# ── 4. Cross-Page Paragraph Continuation (L-3) ────────────────────────────────

def test_cross_page_paragraph_continuation(tmp_path):
    out_docx = str(tmp_path / "test_cross_page.docx")
    project = {
        "metadata": {"title": "Test Book", "logical_start": 1},
        "pages": [
            {
                "width": 600, "height": 800,
                "ocr_data": [
                    {"category": "Text", "text": "هذه بداية جملة طويلة لم تنته في هذه الصفحة بل استمرت"},
                ]
            },
            {
                "width": 600, "height": 800,
                "ocr_data": [
                    {"category": "Text", "text": "في الصفحة التالية مكملة المعنى المطلوب تماماً."},
                ]
            }
        ]
    }

    res_path = export_docx(project, [0, 1], out_docx, opts={"merge_cross_page_paragraphs": True})
    assert os.path.exists(res_path)
    assert os.path.getsize(res_path) > 1000

    # Deep verification: ensure the paragraphs across pages were merged into ONE paragraph in DOCX
    import docx
    doc = docx.Document(res_path)
    paras = [p.text for p in doc.paragraphs if p.text.strip()]
    assert len(paras) == 1, f"Expected 1 merged paragraph, got {len(paras)}"
    assert "استمرت في الصفحة" in paras[0]
    print("[PASS] Cross-page paragraph continuation exported to DOCX successfully as a single merged paragraph.")


# ── 5. PDF Reconstruction Export (F-2) ────────────────────────────────────────

def test_pdf_export_flowing_mode(tmp_path):
    out_pdf = str(tmp_path / "test_flowing.pdf")
    project = {
        "metadata": {"title": "Flowing Test", "logical_start": 1},
        "pages": [
            {
                "width": 595.32, "height": 841.92,
                "ocr_data": [
                    {"category": "Title", "text": "كتاب العلوم والآداب"},
                    {"category": "Section-header", "text": "الفصل الأول: في طبيعة المعرفة"},
                    {"category": "Text", "text": "هذا النص العربي تجريبي لإثبات دقة التشكيل وتناسق الفقرات الانسيابية."},
                    {"category": "Vertical-poetry", "text": "ألا ليت الشباب يعود يوماً ... فأخبره بما فعل المشيبُ"},
                ]
            }
        ]
    }

    res = export_pdf(project, [0], out_pdf, opts={"mode": "flowing"})
    assert os.path.exists(res)
    assert os.path.getsize(res) > 500

    # Deep verification: verify PyMuPDF can open and read genuine Arabic text WITHOUT question marks (?)
    import fitz
    doc = fitz.open(res)
    assert len(doc) == 1
    page_text = doc[0].get_text()
    assert "?" not in page_text, f"PDF text contained '?' encoding artifacts: {page_text}"
    assert len(page_text.strip()) > 20
    doc.close()
    print("[PASS] PDF flowing reconstruction generated valid readable Arabic PDF without encoding corruptions.")


def test_pdf_export_exact_mode(tmp_path):
    out_pdf = str(tmp_path / "test_exact.pdf")
    project = {
        "metadata": {"title": "Exact Test", "logical_start": 1},
        "pages": [
            {
                "width": 595.32, "height": 841.92,
                "ocr_data": [
                    {"category": "Title", "bbox": [50, 60, 545, 95], "text": "عنوان بموقع محدد"},
                    {"category": "Text", "bbox": [50, 110, 545, 180], "text": "فقرة في صندوق إحداثيات تام"},
                ]
            }
        ]
    }

    res = export_pdf(project, [0], out_pdf, opts={"mode": "exact"})
    assert os.path.exists(res)
    assert os.path.getsize(res) > 500

    import fitz
    doc = fitz.open(res)
    assert len(doc) == 1
    page_text = doc[0].get_text()
    assert "?" not in page_text, f"PDF exact text contained '?' encoding artifacts: {page_text}"
    assert len(page_text.strip()) > 10
    doc.close()
    print("[PASS] PDF exact reconstruction generated valid coordinate-placed Arabic PDF without question marks.")


# ── 6. Global Search & Replace Across Project (F-1) ───────────────────────────

def test_global_search_and_replace_e2e(tmp_path):
    pm = ProjectManager(projects_dir=str(tmp_path))
    proj_meta = {"title": "Test Search Project", "author": "Tester"}
    proj_res = pm.create_project(proj_meta)
    proj_id = proj_res["id"]

    # Initialize 2 pages in project structure
    proj = pm.load_project(proj_id)
    proj["pages"] = [
        {"image": "p0.jpg", "width": 600, "height": 800},
        {"image": "p1.jpg", "width": 600, "height": 800},
    ]
    pm.update_project(proj_id, proj)

    # Populate 2 pages of OCR data
    pm.save_page_ocr(proj_id, 0, [
        {"order": 1, "category": "Text", "text": "القاهرة مدينة عريقة ولها تاريخ مجيد."},
    ])
    pm.save_page_ocr(proj_id, 1, [
        {"order": 1, "category": "Text", "text": "زار السائح مدينة القاهرة والتقط صوراً تذكارية."},
    ])

    from backend.app.api import Api
    api = Api.__new__(Api)
    api.project_manager = pm

    # 1. Search test
    matches = api.search_project(proj_id, "القاهرة")
    assert len(matches) == 2, f"Expected 2 matches for 'القاهرة', found {len(matches)}"
    assert matches[0]["page_index"] == 0
    assert matches[1]["page_index"] == 1

    # 2. Replace test
    rep_res = api.replace_in_project(proj_id, "القاهرة", "بغداد")
    assert rep_res["ok"] is True
    assert rep_res["replacement_count"] == 2
    assert rep_res["modified_pages"] == [0, 1]

    # 3. Verify changes persisted to disk
    p0_data = pm.load_page_ocr(proj_id, 0)
    assert "بغداد" in p0_data[0]["text"]
    assert "القاهرة" not in p0_data[0]["text"]

    p1_data = pm.load_page_ocr(proj_id, 1)
    assert "بغداد" in p1_data[0]["text"]
    print("[PASS] Global Search & Replace (F-1) successfully located and replaced text across pages.")


# ── 7. Project Version History Snapshots (F-5) ────────────────────────────────

def test_version_history_snapshots_and_restore(tmp_path):
    pm = ProjectManager(projects_dir=str(tmp_path))
    proj = pm.create_project({"title": "History Proj"})
    pid = proj["id"]

    # Initial state
    state_v1 = [{"order": 1, "category": "Text", "text": "النسخة الأصلية الأولى"}]
    pm.save_page_ocr(pid, 0, state_v1)

    import time
    time.sleep(0.01)

    # Modified state
    state_v2 = [{"order": 1, "category": "Text", "text": "النسخة المعدلة الثانية"}]
    pm.save_page_ocr(pid, 0, state_v2)

    # Check snapshots listed
    snaps = pm.list_page_snapshots(pid, 0)
    assert len(snaps) >= 2, f"Expected >= 2 snapshots, found {len(snaps)}"

    # Oldest snapshot is last in sorted list
    oldest_snap_file = snaps[-1]["filename"]
    res = pm.restore_page_snapshot(pid, 0, oldest_snap_file)
    assert res["ok"] is True

    # Verify restored state
    restored = pm.load_page_ocr(pid, 0)
    assert restored[0]["text"] == "النسخة الأصلية الأولى"
    print("[PASS] Version History Snapshots & Restore (F-5) successfully verified.")


# ── 8. CSS Syntax & Flex Cascade Verification (BUG-01 .. BUG-05) ─────────────

def test_layout_css_syntax_and_flex_cascade():
    css_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "css", "layout.css")
    with open(css_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify no dangling closing braces or broken hovering tab selector
    assert "#sidebar-collapsed-tab:hover {\n  background: var(--color-primary-light);\n  color: var(--color-primary);\n}\n  box-shadow:" not in content

    # Verify flex rule exists for .home-main, .settings-container, #main-content
    assert ".home-main, .settings-container, #main-content" in content
    assert "flex: 1;" in content
    assert "width: 100%;" in content
    print("[PASS] layout.css syntax and flex cascade rules successfully verified.")


def test_dashboard_and_export_css_files_exist():
    dash_css = os.path.join(os.path.dirname(__file__), "..", "frontend", "css", "dashboard.css")
    exp_css = os.path.join(os.path.dirname(__file__), "..", "frontend", "css", "export.css")
    assert os.path.exists(dash_css), "dashboard.css must exist"
    assert os.path.exists(exp_css), "export.css must exist"

    with open(dash_css, "r", encoding="utf-8") as f:
        d_content = f.read()
    assert ".pipeline-stepper" in d_content
    assert ".page-status-strip" in d_content

    with open(exp_css, "r", encoding="utf-8") as f:
        e_content = f.read()
    assert ".format-cards-grid" in e_content
    assert ".export-progress-fill" in e_content
    print("[PASS] dashboard.css and export.css extracted files verified.")


# ── 9. Project Duplication & Metadata Operations (UI-P4) ──────────────────────

def test_project_duplicate_and_rename_metadata(tmp_path):
    pm = ProjectManager(projects_dir=str(tmp_path))
    p = pm.create_project({"title": "Original Arabic Book", "author": "Author 1"})
    pid = p["id"]

    from backend.app.api import Api
    api = Api.__new__(Api)
    api.project_manager = pm

    # Duplicate project
    dup_res = api.duplicate_project(pid)
    assert dup_res["ok"] is True
    dup_id = dup_res["id"]
    assert dup_id != pid

    dup_proj = pm.load_project(dup_id)
    assert dup_proj is not None
    assert dup_proj["id"] == dup_id
    assert "(نسخة)" in dup_proj["metadata"]["title"]

    # Rename metadata
    ren_res = api.update_project_metadata(dup_id, {"title": "Renamed Book Title"})
    assert ren_res["ok"] is True
    updated = pm.load_project(dup_id)
    assert updated["metadata"]["title"] == "Renamed Book Title"
    print("[PASS] Project duplication and metadata renaming verified.")


# ── 10. Comprehensive UI Audit Elements Verification ──────────────────────────

def test_ui_audit_report_elements_present():
    fe_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")

    # Screen 1: Home
    with open(os.path.join(fe_dir, "index.html"), "r", encoding="utf-8") as f:
        h_html = f.read()
    assert "app-topbar" in h_html
    assert "hero-dropzone" in h_html

    # Screen 2: Projects
    with open(os.path.join(fe_dir, "projects.html"), "r", encoding="utf-8") as f:
        p_html = f.read()
    assert "projects-sort-select" in p_html
    assert "project-card-context-menu" in p_html

    # Screen 3: Dashboard
    with open(os.path.join(fe_dir, "project-dashboard.html"), "r", encoding="utf-8") as f:
        d_html = f.read()
    assert "dashboard-coop-panel" in d_html
    assert "dash-lan-toggle-expand" in d_html
    assert "btn-batch-export" in d_html
    assert "btn-batch-delete" in d_html
    assert "stats-skeleton-row" in d_html

    # Screen 4: Review
    with open(os.path.join(fe_dir, "review.html"), "r", encoding="utf-8") as f:
        r_html = f.read()
    assert "crop-header-bar" in r_html
    assert "undo-depth-badge" in r_html
    assert "shortcuts-cheat-modal" in r_html

    # Screen 6: Layout Editor
    with open(os.path.join(fe_dir, "layout-editor.html"), "r", encoding="utf-8") as f:
        le_html = f.read()
    assert "layout-minimap-panel" in le_html
    assert "layout-selection-badge" in le_html
    assert "layout-color-legend" in le_html
    assert "layout-history-panel" in le_html

    # Screen 7: Export
    with open(os.path.join(fe_dir, "export.html"), "r", encoding="utf-8") as f:
        e_html = f.read()
    assert "format-size-estimate" in e_html
    assert "format-features" in e_html
    assert "btn-cancel-export" in e_html
    assert "recent-exports-card" in e_html

    # Screen 8: Settings
    with open(os.path.join(fe_dir, "settings.html"), "r", encoding="utf-8") as f:
        s_html = f.read()
    assert 'id="api-key-gemini"' in s_html
    assert 'btn-toggle-key-visibility' in s_html
    assert 'reset-section-link' in s_html

    # Cross-cutting: Notifications queue & Api wrappers
    with open(os.path.join(fe_dir, "js", "components", "notifications.js"), "r", encoding="utf-8") as f:
        n_js = f.read()
    assert "MAX_VISIBLE_TOASTS" in n_js
    assert "pruneQueue" in n_js

    with open(os.path.join(fe_dir, "js", "core", "api.js"), "r", encoding="utf-8") as f:
        api_js = f.read()
    assert "duplicateProject" in api_js
    assert "updateProjectMetadata" in api_js

    print("[PASS] All UI Audit Report enhancement elements verified across template and component files.")


def test_zero_transition_all_in_stylesheets():
    """Verify that expensive 'transition: all' is strictly eliminated across all frontend stylesheets (UI-X7)."""
    css_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "css")
    offenders = []
    for fname in os.listdir(css_dir):
        if fname.endswith(".css"):
            fpath = os.path.join(css_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                for line_idx, line in enumerate(f, 1):
                    if re.search(r"transition:\s*all\b", line):
                        offenders.append(f"{fname}:{line_idx}: {line.strip()}")
    assert not offenders, f"Found transition: all occurrences:\n" + "\n".join(offenders)
    print("[PASS] Verified 0 instances of 'transition: all' across all frontend stylesheets.")
