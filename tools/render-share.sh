#!/usr/bin/env bash
# Renders tools/share-card.html to share.png (1200 x 630), the image a
# shared link shows. Needs Chromium, Python, curl and ImageMagick;
# tools/shoot.sh takes the shot. The icons (img/bull.svg, favicon-*.png,
# icon-192.png, apple-touch-icon.png) come from the logo set in Stonks'
# out/design/logo, drawn there in whole cells at each size.
set -euo pipefail
cd "$(dirname "$0")/.."
# The page is served as /site/tools/share-card.html, so the site isn't
# written to until the shot is taken.
root=$(mktemp -d)
ln -s "$PWD" "$root/site"
trap 'rm -r "$root"' EXIT
tools/shoot.sh "$root" site/tools/share-card.html 1200 630 1 share.png
magick share.png -strip -define png:compression-level=9 share.png
identify share.png
