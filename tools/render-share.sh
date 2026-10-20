#!/usr/bin/env bash
# Renders tools/share-card.html to share.png (1200 x 630), the image a shared
# link shows, and icon PNGs from icon.svg. Needs Chromium and ImageMagick.
set -euo pipefail
cd "$(dirname "$0")/.."
port=8799
python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 &
server=$!
trap 'kill "$server"' EXIT
sleep 1
chromium --headless=new --disable-gpu --hide-scrollbars --window-size=1200,630 \
  --virtual-time-budget=4000 --screenshot=share.png "http://127.0.0.1:$port/tools/share-card.html" 2>/dev/null
magick share.png -strip -define png:compression-level=9 share.png
magick -background none -density 768 icon.svg -background '#1a1b26' -gravity center -extent 180x180 apple-touch-icon.png
magick -background none -density 192 icon.svg favicon-32.png
identify share.png apple-touch-icon.png favicon-32.png
