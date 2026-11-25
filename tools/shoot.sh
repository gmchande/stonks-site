#!/usr/bin/env bash
# Shoots PAGE, a path under ROOT, with headless Chromium into OUT, at WIDTH
# x HEIGHT CSS pixels and SCALE device pixels to each. ROOT is served for
# this shot only, by tools/serve.py at a port the system picks: the shot
# waits until that server answers with this run's token, and the server
# stops when this script exits, however it exits. Fails, writing nothing,
# unless the page marks its fonts loaded (tools/fonts.js).
#
#   tools/shoot.sh ROOT PAGE WIDTH HEIGHT SCALE OUT
set -euo pipefail
[ $# -eq 6 ] || { echo "usage: tools/shoot.sh ROOT PAGE WIDTH HEIGHT SCALE OUT" >&2; exit 2; }
root=$1 page=$2 width=$3 height=$4 scale=$5 out=$6
token=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
printf %s "$token" > "$root/token"
coproc server { exec python3 "$(dirname "$0")/serve.py" "$root"; }
pid=$server_PID to=${server[1]}
trap 'kill "$pid" 2> /dev/null || true; rm -f "$root/token" "$root/shot.png"' EXIT
read -r -t 10 port <&"${server[0]}" || { echo "shoot: the page's server did not start" >&2; exit 1; }
url=http://127.0.0.1:$port
[ "$(curl -fsS --max-time 5 "$url/token")" = "$token" ] || { echo "shoot: $url is not this run's server" >&2; exit 1; }
# The server's stdin stays with this script alone, so a Chromium left behind
# can't keep the server up.
dom=$(chromium --headless=new --disable-gpu --hide-scrollbars --window-size="$width,$height" --force-device-scale-factor="$scale" \
  --virtual-time-budget=4000 --dump-dom --screenshot="$root/shot.png" "$url/$page" 2> /dev/null {to}>&-)
mark=$(grep -o 'data-fonts="[^"]*"' <<< "$dom" || echo "no mark from tools/fonts.js")
[ "$mark" = 'data-fonts="loaded"' ] || { echo "shoot: the font didn't load, so $page would draw without JetBrains Mono ($mark)" >&2; exit 1; }
mv "$root/shot.png" "$out"
