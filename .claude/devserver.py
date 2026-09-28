# dev-only static server that disables caching so module edits always reload
import http.server, sys
class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8317
http.server.ThreadingHTTPServer(('', port), NoStore).serve_forever()
