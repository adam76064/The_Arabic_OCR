"""Shim - backward compat, now lives in backend.core.quran"""
from .core.quran import QuranHandler, get_resource_path
__all__ = ["QuranHandler", "get_resource_path"]
