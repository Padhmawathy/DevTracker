# -*- mode: python ; coding: utf-8 -*-
import sys

from PyInstaller.utils.hooks import collect_submodules

hiddenimports = []
hiddenimports += collect_submodules('uvicorn')

if sys.platform == 'darwin':
    hiddenimports += ['Quartz']
else:
    hiddenimports += collect_submodules('winotify')


a = Analysis(
    ['src/devtrack/desktop_backend.py'],
    pathex=['src'],
    binaries=[],
    datas=[('frontend/dist', 'frontend/dist')],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='DevTrackBackend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
# The folder copy is only made on Windows: on macOS the one-file executable
# is dist/DevTrackBackend, which a dist/DevTrackBackend folder would clash with.
if sys.platform != 'darwin':
  coll = COLLECT(
      exe,
      a.binaries,
      a.datas,
      strip=False,
      upx=True,
      upx_exclude=[],
      name='DevTrackBackend',
  )
