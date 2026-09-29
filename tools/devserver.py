import http.server, socketserver, sys, os, base64, re
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SNAPS = os.environ.get('SNAP_DIR') or os.path.join(os.getcwd(), '.snaps')
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, *a): pass
    def do_POST(self):
        # dev only: save a canvas snapshot (data URL body) as .snaps/<name>.jpg
        m = re.match(r'^/__snap\?name=([\w-]+)$', self.path)
        if not m:
            self.send_response(404); self.end_headers(); return
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n).decode('ascii', 'ignore')
        data = base64.b64decode(body.split(',', 1)[-1])
        os.makedirs(SNAPS, exist_ok=True)
        with open(os.path.join(SNAPS, m.group(1) + '.jpg'), 'wb') as f:
            f.write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8917
socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', port), H) as s:
    s.serve_forever()
