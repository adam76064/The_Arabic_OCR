import json
from .shared import SKIP_CATEGORIES

def export_json(project, page_indices, output_path):
    pages = [project['pages'][i] for i in page_indices]
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({'project_id': project['id'],
                   'metadata': project['metadata'],
                   'pages': pages}, f, ensure_ascii=False, indent=2)
    return output_path


