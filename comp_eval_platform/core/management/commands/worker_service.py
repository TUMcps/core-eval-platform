"""Run the remote Docker worker service."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from django.core.management.base import BaseCommand

from comp_eval_platform.compute import remote_docker_service as service


class _Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8") or "{}")

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send(200, {"ok": True})
            return
        if parsed.path == "/nodes":
            query = parse_qs(parsed.query)
            self._send(200, {"nodes": service.list_nodes(service_id=query.get("service_id", [""])[0])})
            return
        self._send(404, {"detail": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        data = self._read_json()
        if parsed.path == "/provision":
            self._send(200, service.provision(service_id=data.get("service_id", ""), node_type=data.get("node_type", "local"), image=data.get("image", ""), authorized_key=data.get("authorized_key", ""), eni=data.get("eni")))
            return
        if parsed.path == "/terminate":
            service.terminate(data.get("container_id", ""))
            self._send(200, {"ok": True})
            return
        if parsed.path == "/reap":
            service.reap_untracked(service_id=data.get("service_id", ""), tracked_ids=data.get("tracked_ids") or [])
            self._send(200, {"ok": True})
            return
        self._send(404, {"detail": "not found"})


class Command(BaseCommand):
    help = "Run the remote Docker worker service."

    def add_arguments(self, parser):
        parser.add_argument("--host", default="0.0.0.0")
        parser.add_argument("--port", default=9001, type=int)

    def handle(self, *args, **options):
        server = ThreadingHTTPServer((options["host"], options["port"]), _Handler)
        self.stdout.write(self.style.SUCCESS(f"Worker service listening on {options['host']}:{options['port']}"))
        server.serve_forever()