#!/usr/bin/env python
"""Shim: delegates to backend/manage.py (project reorganized to backend/ + frontend/)."""
import os, sys, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parent
backend_manage = root / "backend" / "manage.py"
if backend_manage.exists():
    # run backend manage.py with same args, using backend as cwd so BASE_DIR resolves correctly
    sys.argv[0] = str(backend_manage)
    os.chdir(str(root / "backend"))
    # ensure backend is on path
    sys.path.insert(0, str(root / "backend"))
    import importlib.util
    spec = importlib.util.spec_from_file_location("backend_manage", str(backend_manage))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.main()
else:
    print("backend/manage.py not found", file=sys.stderr)
    sys.exit(1)
