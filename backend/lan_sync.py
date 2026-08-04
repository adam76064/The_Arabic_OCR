"""Shim -> backend.collab.sync"""
from .collab.sync import LANSyncServer, LANSyncClient
__all__ = ["LANSyncServer", "LANSyncClient"]
