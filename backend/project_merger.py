"""
Project Merger & Security Utilities
- Strong password validation
- Salted PBKDF2 password hashing
- Bidirectional diff & merge engine for local & remote projects
"""
import re
import hashlib
import os
import copy
from typing import Dict, List, Tuple, Any, Optional

SPECIAL_CHARS_RE = re.compile(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]')

def validate_password_strength(password: str) -> Dict[str, Any]:
    """Validates password strength according to strict security criteria:
    - Minimum 8 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special symbol (!@#$%^&* etc.)
    """
    errors = []
    if not password or len(password) < 8:
        errors.append("يجب أن لا تقل كلمة المرور عن 8 أحرف.")
    if not re.search(r'[A-Z]', password or ''):
        errors.append("يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل (A-Z).")
    if not re.search(r'[a-z]', password or ''):
        errors.append("يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل (a-z).")
    if not re.search(r'[0-9]', password or ''):
        errors.append("يجب أن تحتوي كلمة المرور على رقم واحد على الأقل (0-9).")
    if not SPECIAL_CHARS_RE.search(password or ''):
        errors.append("يجب أن تحتوي كلمة المرور على رمز خاص واحد على الأقل (!@#$%^&*...).")
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }

def hash_password(password: str, salt: Optional[str] = None) -> Dict[str, str]:
    """Hashes password using PBKDF2-HMAC-SHA256 with a unique 16-byte salt."""
    if not salt:
        salt_bytes = os.urandom(16)
        salt = salt_bytes.hex()
    else:
        salt_bytes = bytes.fromhex(salt)
    
    key = hashlib.pbkdf2_hmac('sha256', (password or '').encode('utf-8'), salt_bytes, 200000)
    return {
        'hash': key.hex(),
        'salt': salt
    }

def verify_password(password: str, stored_hash: str, stored_salt: str) -> bool:
    """Verifies a plain text password against a stored PBKDF2 hash and salt."""
    if not stored_hash or not stored_salt:
        return False
    computed = hash_password(password, stored_salt)
    return computed['hash'] == stored_hash


class ProjectMerger:
    @staticmethod
    def merge(local_project: Dict[str, Any], remote_project: Dict[str, Any], resolutions: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Bidirectional Merge Engine:
        Merges remote_project changes into local_project non-destructively.
        resolutions: dict mapping block_key -> 'local' or 'remote' for conflicting blocks.
        Returns {'merged_project': project_dict, 'conflicts': list_of_conflicts}
        """
        resolutions = resolutions or {}
        merged = copy.deepcopy(local_project)
        conflicts = []

        local_pages = merged.get('pages', [])
        remote_pages = remote_project.get('pages', [])

        # Ensure page arrays match in length
        max_len = max(len(local_pages), len(remote_pages))
        
        for i in range(max_len):
            if i >= len(local_pages):
                # New remote page not present in local
                local_pages.append(copy.deepcopy(remote_pages[i]))
                continue
            if i >= len(remote_pages):
                # Page only exists locally
                continue

            local_page = local_pages[i]
            remote_page = remote_pages[i]

            local_ocr = local_page.get('ocr_data') or []
            remote_ocr = remote_page.get('ocr_data') or []

            if not local_ocr and remote_ocr:
                local_page['ocr_data'] = copy.deepcopy(remote_ocr)
                if remote_page.get('layout_status'):
                    local_page['layout_status'] = remote_page['layout_status']
                if remote_page.get('review_status'):
                    local_page['review_status'] = remote_page['review_status']
                continue

            if not remote_ocr:
                continue

            # Compare blocks by ID or position index
            merged_ocr = []
            local_by_id = {el.get('id', str(idx)): el for idx, el in enumerate(local_ocr)}
            remote_by_id = {el.get('id', str(idx)): el for idx, el in enumerate(remote_ocr)}

            all_keys = list(dict.fromkeys(list(local_by_id.keys()) + list(remote_by_id.keys())))

            for key in all_keys:
                loc_el = local_by_id.get(key)
                rem_el = remote_by_id.get(key)

                if loc_el and not rem_el:
                    merged_ocr.append(copy.deepcopy(loc_el))
                elif rem_el and not loc_el:
                    merged_ocr.append(copy.deepcopy(rem_el))
                else:
                    # Both present: check if identical or conflicting
                    loc_text = loc_el.get('text', '')
                    rem_text = rem_el.get('text', '')
                    loc_cat = loc_el.get('category', '')
                    rem_cat = rem_el.get('category', '')

                    if loc_text == rem_text and loc_cat == rem_cat:
                        # Non-conflicting, take remote metadata updates (like review status)
                        merged_el = copy.deepcopy(loc_el)
                        if rem_el.get('reviewed'):
                            merged_el['reviewed'] = True
                        merged_ocr.append(merged_el)
                    else:
                        # Conflict detected!
                        if key in resolutions:
                            chosen = loc_el if resolutions[key] == 'local' else rem_el
                            merged_ocr.append(copy.deepcopy(chosen))
                        else:
                            # Flag conflict for user decision, fallback to local until user chooses
                            conflicts.append({
                                'block_key': key,
                                'page_index': i,
                                'local_block': loc_el,
                                'remote_block': rem_el
                            })
                            merged_ocr.append(copy.deepcopy(loc_el))

            local_page['ocr_data'] = merged_ocr
            
            # Merge review status flags
            if remote_page.get('review_status') == 'completed':
                local_page['review_status'] = 'completed'

        merged['pages'] = local_pages
        return {
            'merged_project': merged,
            'conflicts': conflicts
        }
