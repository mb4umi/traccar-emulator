# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 mb4umi
"""Local UI and same-origin forwarding to Raceradar (Python 3 + curl)."""
import argparse
import json
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent


def tracking_url(value):
    url = urlsplit(value.strip())
    if url.scheme == 'org.traccar.client':
        if url.netloc != 'config' or url.path not in ('', '/') or url.fragment:
            raise ValueError('Invalid Traccar configuration link.')
        params = dict(parse_qsl(url.query, keep_blank_values=True))
        target = params.pop('url', None)
        if not target:
            raise ValueError('Traccar configuration link requires a server URL.')
        url = urlsplit(target)
        query = dict(parse_qsl(url.query, keep_blank_values=True))
        query.update(params)
        url = url._replace(query=urlencode(query))
    if (url.scheme != 'https' or url.hostname != 'raceradar.de'
            or url.port not in (None, 443) or url.username or url.password
            or url.path != '/ingest/osmand' or url.fragment):
        raise ValueError('Expected https://raceradar.de/ingest/osmand with your tracker ID.')
    # These are Traccar Client settings, not position measurements.
    settings = {'accuracy', 'distance', 'interval', 'buffer', 'stop_detection'}
    query = [(key, val) for key, val in parse_qsl(url.query) if key not in settings]
    return urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), ''))


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin'
                         if content_type.startswith('text/html') else 'no-referrer')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path not in ('/', '/index.html'):
            self.reply(404, b'{"detail":"Not found"}')
            return
        self.reply(200, (ROOT / 'index.html').read_bytes(), 'text/html; charset=utf-8')

    def do_POST(self):
        host = self.headers.get('Host', '')
        allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if (host not in allowed or self.headers.get('Origin') != f'http://{host}'
                or self.headers.get('Content-Type') != 'application/json'):
            self.reply(403, b'{"detail":"Local application requests only"}')
            return
        if self.path != '/api/send':
            self.reply(404, b'{"detail":"Not found"}')
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 16384:
                raise ValueError('Invalid request size.')
            payload = json.loads(self.rfile.read(size))
            url = tracking_url(payload['url'])
            form = urlencode(payload['data']).encode()
        except (ValueError, KeyError, TypeError):
            self.reply(400, b'{"detail":"Invalid tracking URL or payload"}')
            return
        try:
            result = subprocess.run(
                ['curl', '--silent', '--show-error', '--proto', '=https',
                 '--max-time', '20', '--request', 'POST', '--url', url,
                 '--header', 'Content-Type: application/x-www-form-urlencoded',
                 '--data-binary', '@-', '--write-out', '\n%{http_code}'],
                input=form, capture_output=True, timeout=25,
            )
            if result.returncode:
                self.reply(502, b'{"detail":"Cannot reach Raceradar; check network and TLS"}')
                return
            body, status = result.stdout.rsplit(b'\n', 1)
            self.reply(int(status), body)
        except (OSError, subprocess.TimeoutExpired, ValueError):
            self.reply(502, b'{"detail":"Raceradar forwarding failed"}')

    def log_message(self, format, *args):
        # Never log tracker URLs or tokens.
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Traccar Emulator: http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
