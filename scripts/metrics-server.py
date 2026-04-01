#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import os

class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/metrics':
            try:
                with open('/tmp/openclaw-metrics.prom', 'r') as f:
                    metrics = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(metrics.encode())
            except FileNotFoundError:
                self.send_response(503)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass  # Suppress logging

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 9091), MetricsHandler)
    print('OpenClaw Metrics Server running on port 9091')
    server.serve_forever()
