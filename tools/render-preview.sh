#!/usr/bin/env bash
# Renders tools/preview-card.html to OUT (3200 x 1600), Stonks' preview.png:
# the README's first picture and the plugin marketplace's. GRABS holds
# Stonks' own pictures the card shows, from its test/qml/readme.sh
# --marketplace: strip.png (scale 6) and popup.png (scale 3). Needs Chromium and
# ImageMagick.
#
#   tools/render-preview.sh GRABS OUT
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: tools/render-preview.sh GRABS OUT" >&2; exit 2; }
grabs=$(cd "$1" && pwd)
out=$(realpath -m "$2")
for f in strip.png popup.png; do [ -s "$grabs/$f" ] || { echo "no $grabs/$f" >&2; exit 1; }; done
cd "$(dirname "$0")/.."
# The page is served as /site/tools/preview-card.html beside /grabs/, so
# neither folder is written to.
root=$(mktemp -d)
ln -s "$PWD" "$root/site"
ln -s "$grabs" "$root/grabs"
port=8798
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
server=$!
trap 'kill "$server"; rm -r "$root"' EXIT
sleep 1
chromium --headless=new --disable-gpu --hide-scrollbars --window-size=1600,800 --force-device-scale-factor=2 \
  --virtual-time-budget=4000 --screenshot="$out" "http://127.0.0.1:$port/site/tools/preview-card.html" 2>/dev/null
magick "$out" -strip -dither None -colors 256 "PNG8:$out"
identify "$out"
