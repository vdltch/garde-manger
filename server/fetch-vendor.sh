#!/usr/bin/env bash
# Télécharge les bibliothèques de l'app (versions figées) depuis le registre npm dans le dossier donné.
# Usage : bash fetch-vendor.sh DOSSIER     (utilisé par deploy-app.sh et par les tests automatiques)
set -euo pipefail
VENDOR="${1:?dossier de destination}"; mkdir -p "$VENDOR"
fetch_pkg(){ # paquet npm, version, fichier dans le paquet, nom local
  local name="$1" ver="$2" path="$3" dest="$4" base="${1##*/}" tmp
  [ -s "$VENDOR/$dest" ] && grep -qx "$name@$ver $dest" "$VENDOR/VERSIONS" 2>/dev/null && return 0
  tmp=$(mktemp -d)
  if curl -fsSL "https://registry.npmjs.org/$name/-/$base-$ver.tgz" | tar xz -C "$tmp" "package/$path" 2>/dev/null && [ -s "$tmp/package/$path" ]; then
    cp "$tmp/package/$path" "$VENDOR/$dest"
    sed -i "\#^$name@.* $dest\$#d" "$VENDOR/VERSIONS" 2>/dev/null || true
    echo "$name@$ver $dest" >> "$VENDOR/VERSIONS"
    echo "  ✓ $dest"
  else
    echo "  ! $dest non téléchargé : l'app utilisera le CDN pour ce fichier"
  fi
  rm -rf "$tmp"
}
touch "$VENDOR/VERSIONS"
fetch_pkg react 18.3.1 umd/react.production.min.js react.production.min.js
fetch_pkg react-dom 18.3.1 umd/react-dom.production.min.js react-dom.production.min.js
fetch_pkg htm 3.1.1 dist/htm.umd.js htm.umd.js
fetch_pkg @zxing/library 0.21.3 umd/index.min.js zxing.min.js
fetch_pkg barcode-detector 3.1.3 dist/iife/ponyfill.min.js barcode-detector.iife.js
# le moteur WebAssembly doit être exactement la version attendue par barcode-detector
ZXW=$(grep -o 'zxing-wasm@[0-9][0-9.]*[0-9]' "$VENDOR/barcode-detector.iife.js" 2>/dev/null | head -n1 | cut -d@ -f2 || true)
if [ -n "$ZXW" ]; then fetch_pkg zxing-wasm "$ZXW" dist/reader/zxing_reader.wasm zxing_reader.wasm
else rm -f "$VENDOR/zxing_reader.wasm"; echo "  ! version de zxing-wasm introuvable : moteur chargé depuis le CDN"; fi

