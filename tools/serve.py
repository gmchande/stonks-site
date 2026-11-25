# Serves ROOT on 127.0.0.1, at a port the system picks, for the render
# scripts: prints the port, then serves until its stdin closes, which
# happens when the script that started it exits, however it exits.
#
#   python3 tools/serve.py ROOT
import functools
import http.server
import sys
import threading


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(
    ("127.0.0.1", 0), functools.partial(Quiet, directory=sys.argv[1])
)
threading.Thread(target=server.serve_forever, daemon=True).start()
print(server.server_address[1], flush=True)
sys.stdin.read()
