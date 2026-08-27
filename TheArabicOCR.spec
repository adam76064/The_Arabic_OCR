# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import collect_data_files, copy_metadata

block_cipher = None

added_datas = [
    ('frontend', 'frontend'),
    ('data', 'data'),
]

# Collect litellm data files (such as model_prices_and_context_window_backup.json) and metadata
try:
    added_datas += collect_data_files('litellm')
    added_datas += copy_metadata('litellm')
except Exception:
    pass

# Collect certifi and tiktoken data files
try:
    added_datas += collect_data_files('certifi')
except Exception:
    pass

try:
    added_datas += collect_data_files('tiktoken')
except Exception:
    pass

hidden_imports = [
    'webview',
    'webview.platforms',
    'webview.platforms.edgechromium',
    'webview.platforms.winforms',
    'clr',
    'pythonnet',
    'fitz',
    'docx',
    'PIL',
    'cv2',
    'requests',
    'zeroconf',
    'cryptography',
    'litellm',
    'typer',
    'orjson',
    'backend',
    'backend.app',
    'backend.app.api',
    'backend.app.events',
    'backend.core',
    'backend.core.config',
    'backend.core.json_utils',
    'backend.core.pdf',
    'backend.core.projects',
    'backend.core.quran',
    'backend.core.text',
    'backend.core.ocr',
    'backend.core.ocr.google_lens',
    'backend.core.ocr.llm',
    'backend.core.ocr.paddle',
    'backend.core.ocr.service',
    'backend.core.ocr.locro',
    'backend.core.ocr.locro._dll',
    'backend.core.ocr.locro._download',
    'backend.core.ocr.locro._models',
    'backend.core.ocr.locro._protobuf',
    'backend.collab',
    'backend.collab.discovery',
    'backend.collab.sync',
    'backend.export',
    'backend.export.docx_export',
    'backend.export.html_epub',
    'backend.export.json_export',
    'backend.export.shared',
    'backend.export.txt_export',
    'backend.post_processing',
    'backend.post_processing.detector',
    'backend.post_processing.manager',
    'backend.post_processing.sorter',
    'backend.preprocessing',
    'backend.preprocessing.batch',
    'backend.preprocessing.engine',
    'backend.preprocessing.storage',
    'backend.preprocessing.stages',
    'backend.preprocessing.stages.base',
    'backend.preprocessing.stages.content',
    'backend.preprocessing.stages.deskew',
    'backend.preprocessing.stages.layout',
    'backend.preprocessing.stages.orientation',
    'backend.preprocessing.stages.output',
    'backend.preprocessing.stages.split',
    'backend.table',
    'backend.table.handler',
    'backend.table.table_handler',
    'backend.utils',
    'backend.utils.retriever',
    'backend.utils.stitcher',
]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=added_datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='TheArabicOCR',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='TheArabicOCR',
)
