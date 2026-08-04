"""
Export facade - router to specific format exporters.
New organized location: backend/export/
"""
from .json_export import export_json
from .txt_export import export_txt
from .docx_export import export_docx
from .html_epub import export_html, export_epub3

__all__ = ["export_json", "export_txt", "export_docx", "export_html", "export_epub3"]


def export_project(project, fmt, page_indices, output_path, opts=None, logical_start=1):
    """
    Unified entry: fmt in {'json','txt','docx','html','epub3'}
    """
    fmt = fmt.lower()
    if fmt == "json":
        return export_json(project, page_indices, output_path)
    elif fmt == "txt":
        return export_txt(project, page_indices, output_path, logical_start=logical_start, opts=opts)
    elif fmt == "docx":
        return export_docx(project, page_indices, output_path, opts=opts)
    elif fmt == "html":
        return export_html(project, page_indices, output_path, opts=opts)
    elif fmt in ("epub3", "epub"):
        return export_epub3(project, page_indices, output_path, opts=opts)
    else:
        raise ValueError(f"Unsupported export format: {fmt}")
