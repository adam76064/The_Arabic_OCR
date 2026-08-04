from .shared import SKIP_CATEGORIES, _parse_poetry_lines, _strip_markdown_and_tags, format_display_text

def export_txt(project, page_indices, output_path, logical_start=1, opts=None):
    opts = opts or {}
    text_mode = opts.get('text_mode', 'formatted')
    table_sep = opts.get('table_separator', '\t')

    lines = []
    for i in page_indices:
        page = project['pages'][i]
        for el in (page.get('ocr_data') or []):
            cat = el.get('category', 'Text')
            if cat in SKIP_CATEGORIES:
                continue

            raw = el.get('text', '')

            # Poetry: شعر عمودي & شعر متدرج in TXT
            if cat in ('شعر عمودي', 'شعر متدرج'):
                poetry_lines = _parse_poetry_lines(el)
                if poetry_lines:
                    txt_rows = []
                    if cat == 'شعر عمودي':
                        for right_h, left_h in poetry_lines:
                            txt_rows.append(f"{right_h}  |  {left_h}")
                    else:  # شعر متدرج
                        for right_h, left_h in poetry_lines:
                            txt_rows.append(f"{right_h}  |")
                            txt_rows.append(f"          |  {left_h}")
                    lines.append('\n'.join(txt_rows))
                continue

            # Custom Table Handling for TXT
            if cat == 'Table' and 'table_structure' in el:
                ts = el['table_structure']
                num_rows = ts.get('rows', 1)
                num_cols = ts.get('cols', 1)
                cells = ts.get('cells', [])
                
                grid = [["" for _ in range(num_cols)] for _ in range(num_rows)]
                covered = [[False for _ in range(num_cols)] for _ in range(num_rows)]

                for c_info in cells:
                    r, c = c_info.get('row', 0), c_info.get('col', 0)
                    r_span, c_span = c_info.get('row_span', 1), c_info.get('col_span', 1)
                    
                    if r < num_rows and c < num_cols and not covered[r][c]:
                        c_text = c_info.get('text', '').replace('<br>', ' ').replace('<br/>', ' ')
                        c_text = _strip_markdown_and_tags(c_text).strip()
                        grid[r][c] = c_text
                        
                        for rr in range(r, min(r + r_span, num_rows)):
                            for cc in range(c, min(c + c_span, num_cols)):
                                covered[rr][cc] = True

                table_text = '\n'.join(table_sep.join(col for col in row) for row in grid if any(col for col in row))
                if table_text:
                    lines.append(table_text)
                continue

            text = format_display_text(raw) if text_mode == 'formatted' else raw.strip()
            if text:
                lines.append(text)
        lines.append(f"\n— صفحة {i + logical_start} —\n")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return output_path


