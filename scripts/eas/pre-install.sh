#!/usr/bin/env bash
# EAS build hook (runs before "pnpm install"). better-sqlite3 (a test-only dev dependency)
# compiles from source with pnpm 8's bundled node-gyp 9, which imports Python's
# `distutils` — removed in Python 3.12. setuptools puts a `distutils` shim back.
set -u
python3 -c "import distutils" 2>/dev/null && exit 0
python3 -m pip install --user --quiet --break-system-packages setuptools 2>/dev/null ||
  python3 -m pip install --user --quiet setuptools 2>/dev/null ||
  sudo apt-get install -y -qq python3-setuptools >/dev/null 2>&1 ||
  true
python3 -c "import distutils" && echo "distutils available" || echo "warning: distutils still missing"
