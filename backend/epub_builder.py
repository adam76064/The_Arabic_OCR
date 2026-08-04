import os
import zipfile
import re
from backend.exporter import SKIP_CATEGORIES, _strip_markdown_and_tags


def _parse_poetry_lines_html(el):
    """Parse verse lines from a poetry element for HTML/EPUB output.
    Returns list of (right_hemistich_html, left_hemistich_html) tuples.
    Prefers table_structure, falls back to splitting el['text'] on <br>/newline and '|'."""
    lines = []

    # Method 1: table_structure cells
    ts = el.get('table_structure')
    if ts:
        num_rows = ts.get('rows', 0)
        num_cols = ts.get('cols', 2)
        cells = ts.get('cells', [])
        if num_rows > 0 and cells:
            grid = [[None] * max(num_cols, 2) for _ in range(num_rows)]
            for c_info in cells:
                r, c = c_info.get('row', 0), c_info.get('col', 0)
                if r < num_rows and c < max(num_cols, 2):
                    grid[r][c] = _prepare_html_text(c_info.get('text', ''))
            for row in grid:
                if num_cols >= 3:
                    # 3-column: col0=صدر (right), col1=separator, col2=عجز (left)
                    right = (row[0] or '').strip()
                    left  = (row[2] or '').strip() if len(row) > 2 else ''
                else:
                    # 2-column: col0=صدر (right), col1=عجز (left)
                    right = (row[0] or '').strip()
                    left  = (row[1] or '').strip() if len(row) > 1 else ''
                if right or left:
                    lines.append((right, left))
            if lines:
                return lines

    # Method 2: text field split on <br> and '|'
    raw = el.get('text', '')
    verse_lines = re.split(r'<br\s*/?>', raw, flags=re.IGNORECASE)
    if len(verse_lines) <= 1:
        verse_lines = raw.split('\n')
    for verse in verse_lines:
        verse_clean = _strip_markdown_and_tags(verse).strip()
        if not verse_clean:
            continue
        if '|' in verse_clean:
            parts = verse_clean.split('|', 1)
            lines.append((_prepare_html_text(parts[0].strip()), _prepare_html_text(parts[1].strip())))
        else:
            lines.append((_prepare_html_text(verse_clean), ''))
    return lines


def _generate_poetry_html(el, cat):
    """Generate table-based HTML for Arabic poetry.

    شعر عمودي: both hemistichs per row with a separator bar.
        صدر البيت  |  عجز البيت

    شعر متدرج: alternating rows (staggered indent).
        صدر البيت   |
                    | عجز البيت
    """
    lines = _parse_poetry_lines_html(el)
    if not lines:
        return ''

    parts = []
    if cat == 'شعر عمودي':
        parts.append("<table class='poetry-table poetry-amudi' dir='rtl'>")
        parts.append("<tbody>")
        for right_h, left_h in lines:
            parts.append("<tr>")
            parts.append(f"<td class='hemistich-right'>{right_h}</td>")
            parts.append("<td class='poetry-sep'></td>")
            parts.append(f"<td class='hemistich-left'>{left_h}</td>")
            parts.append("</tr>")
        parts.append("</tbody>")
        parts.append("</table>")

    elif cat == 'شعر متدرج':
        parts.append("<table class='poetry-table poetry-mutadarij' dir='rtl'>")
        parts.append("<tbody>")
        for right_h, left_h in lines:
            # Row 1: right hemistich visible, left placeholder
            parts.append("<tr>")
            parts.append(f"<td class='hemistich-right'>{right_h}</td>")
            parts.append("<td class='poetry-sep'></td>")
            parts.append("<td class='hemistich-placeholder'></td>")
            parts.append("</tr>")
            # Row 2: right placeholder, left hemistich visible
            parts.append("<tr>")
            parts.append("<td class='hemistich-placeholder'></td>")
            parts.append("<td class='poetry-sep'></td>")
            parts.append(f"<td class='hemistich-left'>{left_h}</td>")
            parts.append("</tr>")
        parts.append("</tbody>")
        parts.append("</table>")

    return '\n'.join(parts)


def _prepare_html_text(text):
    """Preserves HTML formatting for EPUB/HTML, converts markdown to HTML tags."""
    if not text: return ""
    s = text.replace('\n', ' ').replace('\r', '')
    s = re.sub(r'\*\*(.+?)\*\*|__(.+?)__', lambda m: f"<b>{m.group(1) or m.group(2)}</b>", s)
    s = re.sub(r'(?<!\*)\*(?!\*)(.+?)\*(?!\*)|(?<!_)_(?!_)(.+?)_(?!_)', lambda m: f"<i>{m.group(1) or m.group(2)}</i>", s)
    s = re.sub(r'(?i)<br\s*>', '<br/>', s)
    return s.strip()


def _generate_body_html(project, page_indices):
    """Converts the project's OCR blocks into HTML structure with styled tables."""
    html_parts = []
    for i in page_indices:
        page = project['pages'][i]
        
        html_parts.append(f"<div class='page-break' id='page_{i+1}'>")
        
        for el in (page.get('ocr_data') or []):
            cat = el.get('category', 'Text')
            if cat in SKIP_CATEGORIES:
                continue
            
            raw_text = el.get('text', '').strip()
            if not raw_text:
                continue


            # ── Poetry: شعر عمودي & شعر متدرج ───────────────────────────
            if cat in ('شعر عمودي', 'شعر متدرج'):
                poetry_html = _generate_poetry_html(el, cat)
                if poetry_html:
                    html_parts.append(poetry_html)
                continue

            # ── Generic Table with table_structure ───────────────────────────
            if cat == 'Table' and 'table_structure' in el:
                ts = el['table_structure']
                num_rows = ts.get('rows', 1)
                num_cols = ts.get('cols', 1)
                cells = ts.get('cells', [])

                if num_rows > 0:
                    covered = [[False for _ in range(num_cols)] for _ in range(num_rows)]
                    grid = [[None for _ in range(num_cols)] for _ in range(num_rows)]
                    for c in cells:
                        r, col = c.get('row', 0), c.get('col', 0)
                        r_span, c_span = c.get('row_span', 1), c.get('col_span', 1)
                        if r < num_rows and col < num_cols:
                            grid[r][col] = c
                            for rr in range(r, min(r + r_span, num_rows)):
                                for cc in range(col, min(col + c_span, num_cols)):
                                    if rr != r or cc != col:
                                        covered[rr][cc] = True

                    html_parts.append("<table class='arab-table'>")
                    for r in range(num_rows):
                        html_parts.append("<tr>")
                        for col in range(num_cols):
                            if covered[r][col]:
                                continue
                            c_info = grid[r][col]
                            if c_info:
                                r_span = c_info.get('row_span', 1)
                                c_span = c_info.get('col_span', 1)
                                attrs = []
                                if r_span > 1: attrs.append(f"rowspan='{r_span}'")
                                if c_span > 1: attrs.append(f"colspan='{c_span}'")
                                styles = []
                                if c_info.get('border'): styles.append(f"border: {c_info['border']};")
                                if c_info.get('bg_color'): styles.append(f"background-color: {c_info['bg_color']};")
                                if c_info.get('valign'): styles.append(f"vertical-align: {c_info['valign']};")
                                if c_info.get('align'): styles.append(f"text-align: {c_info['align']};")
                                if styles: attrs.append(f"style='{' '.join(styles)}'")
                                if c_info.get('dir'): attrs.append(f"dir='{c_info['dir']}'")
                                attr_str = " " + " ".join(attrs) if attrs else ""
                                clean_cell = _prepare_html_text(c_info.get('text', ''))
                                html_parts.append(f"<td{attr_str}>{clean_cell}</td>")
                            else:
                                html_parts.append("<td></td>")
                        html_parts.append("</tr>")
                    html_parts.append("</table>")
                continue

            cat_fmt_map = (project.get('metadata', {}).get('category_formatting', {}) or {})
            cat_fmt = cat_fmt_map.get(cat, {})

            clean_text = _prepare_html_text(raw_text)
            align = el.get('align') or cat_fmt.get('align', 'justify')
            
            if align == 'right': css_align = 'right'
            elif align == 'center': css_align = 'center'
            elif align == 'left': css_align = 'left'
            else: css_align = 'justify'
            
            styles = [f"text-align: {css_align};"]
            if cat_fmt.get('fontFamily'): styles.append(f"font-family: {cat_fmt['fontFamily']};")
            if cat_fmt.get('fontSize'): styles.append(f"font-size: {cat_fmt['fontSize']};")
            if cat_fmt.get('color'): styles.append(f"color: {cat_fmt['color']};")
            if cat_fmt.get('bgColor'): styles.append(f"background-color: {cat_fmt['bgColor']};")
            if cat_fmt.get('bold'): styles.append("font-weight: bold;")
            if cat_fmt.get('italic'): styles.append("font-style: italic;")
            if cat_fmt.get('underline'): styles.append("text-decoration: underline;")
            
            dir_attr = f" dir='{cat_fmt['dir']}'" if cat_fmt.get('dir') else (f" dir='{el.get('dir')}'" if el.get('dir') else "")
            style_attr = f" style='{' '.join(styles)}'"
            
            html_parts.append(f"<p{dir_attr}{style_attr}>{clean_text}</p>")
            
        html_parts.append("</div>") 
            
    return "\n".join(html_parts)

def get_arabic_css():
    """Returns CSS with strict Arabic publishing standards for EPUB3 and HTML."""
    return """
    body {
        direction: rtl;
        unicode-bidi: embed;
        font-family: 'Amiri', 'Traditional Arabic', serif;
        line-height: 2.0;
        margin: 5%;
    }
    p { margin-top: 0; margin-bottom: 1em; }

    /* ═══════════════════════════════════════════
       شعر عمودي & شعر متدرج Tables
       Full justification with kashida stretching across column width
    ══════════════════════════════════════════= */
    table.poetry-table {
        width: 100%;
        margin: 1.5em auto;
        direction: rtl;
        border-collapse: collapse;
        border: none;
    }
    table.poetry-table td {
        border: none;
        padding: 0.2em 4px;
        vertical-align: bottom;
    }
    
    /* شعر عمودي — Classical two-hemistich poetry [45% | 10% | 45%] */
    table.poetry-amudi .hemistich-right,
    table.poetry-amudi .hemistich-left {
        width: 45%;
        text-align: justify;
        text-align-last: justify;
        text-justify: kashida;
    }
    table.poetry-amudi .poetry-sep {
        width: 10%;
        text-align: center;
        color: #888;
        font-weight: 300;
    }

    /* شعر متدرج — Staggered / indented poetry [48% | 4% | 48%] */
    table.poetry-mutadarij .hemistich-right,
    table.poetry-mutadarij .hemistich-left {
        width: 48%;
        text-align: justify;
        text-align-last: justify;
        text-justify: kashida;
    }
    table.poetry-mutadarij .hemistich-placeholder {
        width: 48%;
    }
    table.poetry-mutadarij .poetry-sep {
        width: 4%;
    }
    
    /* Tables */
    .arab-table { 
        width: 100%; 
        border-collapse: collapse; 
        margin: 1.5em 0; 
        page-break-inside: avoid;
    }
    .arab-table td, .arab-table th { 
        border: 1px solid #666; 
        padding: 8px; 
        text-align: center; 
    }
    
    .page-break { page-break-after: always; }
    """


def export_html(project, page_indices, output_path, opts=None):
    """Generates a standalone HTML file."""
    title = project['metadata'].get('title', 'Export')
    body_content = _generate_body_html(project, page_indices)
    
    html_content = get_xhtml_template(title, body_content)
    
    # Inject CSS directly into HTML for a standalone file
    html_content = html_content.replace(
        '<link rel="stylesheet" type="text/css" href="css/styles.css" />', 
        f"<style>\n{get_arabic_css()}\n</style>"
    )
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    return output_path

def export_epub3(project, page_indices, output_path, opts=None):
    """Packages the HTML and CSS into a compliant EPUB3 zip file."""
    title = project['metadata'].get('title', 'Export')
    body_content = _generate_body_html(project, page_indices)
    
    css_content = get_arabic_css()
    html_content = get_xhtml_template(title, body_content)
    
    # Manifest and Spine mapping for a single-chapter book
    manifest = """<item id="style" href="css/styles.css" media-type="text/css"/>
                  <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>"""
    spine = """<itemref idref="chapter1"/>"""
    opf_content = get_opf_content(title, manifest, spine)

    container_xml = """<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>"""

    # Build the Zip/EPUB archive
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as epub:
        # mimetype must be uncompressed and the very first file
        epub.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        epub.writestr('META-INF/container.xml', container_xml)
        epub.writestr('OEBPS/content.opf', opf_content)
        epub.writestr('OEBPS/css/styles.css', css_content)
        epub.writestr('OEBPS/chapter1.xhtml', html_content)
        
    return output_path

def get_xhtml_template(title, body_content):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ar" dir="rtl">
<head>
    <title>{title}</title>
    <link rel="stylesheet" type="text/css" href="css/styles.css" />
</head>
<body>
    {body_content}
</body>
</html>
"""

def get_opf_content(title, manifest_items, spine_items):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>{title}</dc:title>
        <dc:language>ar</dc:language>
    </metadata>
    <manifest>{manifest_items}</manifest>
    <spine page-progression-direction="rtl">{spine_items}</spine>
</package>
"""