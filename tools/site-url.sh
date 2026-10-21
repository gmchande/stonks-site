#!/usr/bin/env bash
# Moves the site to a new address: tools/site-url.sh https://example.com/
# Crawlers and link cards read the address from static files, so it is
# written out in each; this changes every copy at once. The current address
# is the canonical link in index.html. A custom domain also gets the CNAME
# file GitHub Pages serves it by; a github.io address has none.
set -euo pipefail
cd "$(dirname "$0")/.."
new=${1:?usage: tools/site-url.sh https://new.address/}
[[ $new == https://*/ ]] || { echo "the address starts with https:// and ends with /" >&2; exit 1; }
old=$(grep -o '<link rel="canonical" href="[^"]*"' index.html | sed 's/.*href="//; s/"$//')
[[ -n $old ]] || { echo "no canonical link in index.html" >&2; exit 1; }
for f in index.html robots.txt sitemap.xml llms.txt; do
  OLD=$old NEW=$new perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$f"
done
host=${new#https://}
host=${host%%/*}
if [[ $host == *.github.io ]]; then rm -f CNAME; else echo "$host" > CNAME; fi
echo "moved $old to $new"
node tools/check.js
