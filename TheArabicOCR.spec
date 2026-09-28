# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import collect_data_files, copy_metadata, collect_submodules

block_cipher = None

added_datas = [
    ('frontend', 'frontend'),
    ('data', 'data'),
    ('backend/vendor/locro', 'backend/vendor/locro'),
]

# Collect data files and metadata for packages requiring assets
packages_to_collect = ['litellm', 'certifi', 'tiktoken', 'chrome_lens_py']
if sys.platform == 'win32':
    packages_to_collect += ['pythonnet', 'clr_loader']

for pkg in packages_to_collect:
    try:
        added_datas += collect_data_files(pkg)
        added_datas += copy_metadata(pkg)
    except Exception:
        pass

hidden_imports = [
    'webview',
    'webview.platforms',
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
    'certifi',
    'httpx',
    'httpcore',
    'h2',
    'h11',
    'anyio',
    'sniffio',
    'google.protobuf',
    'curl_cffi',
]

if sys.platform == 'win32':
    hidden_imports += [
        'webview.platforms.edgechromium',
        'webview.platforms.winforms',
        'webview.platforms.mshtml',
        'webview.platforms.qt',
        'clr',
        'clr_loader',
        'pythonnet',
    ]
elif sys.platform.startswith('linux'):
    hidden_imports += [
        'webview.platforms.gtk',
        'webview.platforms.qt',
        'gi',
    ]
elif sys.platform == 'darwin':
    hidden_imports += [
        'webview.platforms.cocoa',
        'webview.platforms.qt',
    ]

# Automatically collect all submodules from backend and plugins
try:
    hidden_imports += collect_submodules('backend')
except Exception:
    pass

try:
    hidden_imports += collect_submodules('backend.vendor.locro')
except Exception:
    pass

try:
    hidden_imports += collect_submodules('chrome_lens_py')
except Exception:
    pass

if sys.platform == 'win32':
    try:
        hidden_imports += collect_submodules('clr_loader')
        hidden_imports += collect_submodules('pythonnet')
    except Exception:
        pass

try:
    hidden_imports += collect_submodules('webview.platforms')
except Exception:
    pass

try:
    hidden_imports += collect_submodules('httpx')
    hidden_imports += collect_submodules('httpcore')
    hidden_imports += collect_submodules('h2')
except Exception:
    pass

# Deduplicate
hidden_imports = sorted(list(set(hidden_imports)))

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

