#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Build renderer"
npm run build

echo "==> Package macOS arm64 (.dmg)"
npx electron-builder --mac dmg --arm64

echo "==> Package macOS x64 (.dmg)"
npx electron-builder --mac dmg --x64

if command -v wine64 >/dev/null 2>&1 || command -v wine >/dev/null 2>&1; then
  echo "==> Package Windows x64 (.exe/.nsis)"
  npx electron-builder --win nsis --x64
else
  echo "==> Skip Windows build: wine/wine64 not found in current environment"
  echo "   Install Wine and rerun to produce Windows installer."
fi

echo "==> Done. Output directory: $ROOT_DIR/release"
