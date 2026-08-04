"""Shim - backward compat, now lives in backend.core.projects"""
from .core.projects import ProjectManager
__all__ = ["ProjectManager"]
