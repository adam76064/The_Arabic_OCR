"""
ONNX Table & Layout Engine — Lightweight inference via onnxruntime.
Employs quantized ONNX models (SLANet int8 / Surya Layout ONNX) with CPU acceleration.
"""

from .engine import ONNXTableEngine, get_onnx_table_engine

__all__ = ["ONNXTableEngine", "get_onnx_table_engine"]
