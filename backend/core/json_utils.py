"""
json_utils.py — Ultra-fast JSON serialization & deserialization utility.
Uses orjson (Rust-backed, 5-10x faster) if installed, with standard library json fallback.
"""
from typing import Any, Union
import os

try:
    import orjson
    HAS_ORJSON = True
except ImportError:
    import json
    HAS_ORJSON = False


def dump_json(obj: Any, file_path_or_handle: Union[str, Any], indent: int = 2) -> None:
    """
    Dump a Python object to JSON file using orjson if available, else json.
    Handles both file path strings and open file objects.
    """
    if HAS_ORJSON:
        opt = orjson.OPT_INDENT_2 if indent == 2 else 0
        raw_bytes = orjson.dumps(obj, option=opt)
        if isinstance(file_path_or_handle, str):
            with open(file_path_or_handle, "wb") as f:
                f.write(raw_bytes)
        else:
            if hasattr(file_path_or_handle, "write"):
                try:
                    file_path_or_handle.write(raw_bytes)
                except TypeError:
                    file_path_or_handle.write(raw_bytes.decode("utf-8"))
    else:
        import json
        if isinstance(file_path_or_handle, str):
            with open(file_path_or_handle, "w", encoding="utf-8") as f:
                json.dump(obj, f, ensure_ascii=False, indent=indent)
        else:
            json.dump(obj, file_path_or_handle, ensure_ascii=False, indent=indent)


def load_json(file_path_or_handle: Union[str, bytes, Any]) -> Any:
    """
    Load a JSON file or string into a Python object using orjson if available, else json.
    """
    if HAS_ORJSON:
        if isinstance(file_path_or_handle, str):
            if os.path.exists(file_path_or_handle):
                with open(file_path_or_handle, "rb") as f:
                    return orjson.loads(f.read())
            return orjson.loads(file_path_or_handle)
        elif isinstance(file_path_or_handle, (bytes, bytearray)):
            return orjson.loads(file_path_or_handle)
        elif hasattr(file_path_or_handle, "read"):
            content = file_path_or_handle.read()
            return orjson.loads(content)
        return None
    else:
        import json
        if isinstance(file_path_or_handle, str):
            if os.path.exists(file_path_or_handle):
                with open(file_path_or_handle, "r", encoding="utf-8") as f:
                    return json.load(f)
            return json.loads(file_path_or_handle)
        elif isinstance(file_path_or_handle, (bytes, bytearray)):
            return json.loads(file_path_or_handle.decode("utf-8"))
        elif hasattr(file_path_or_handle, "read"):
            return json.load(file_path_or_handle)
        return None
