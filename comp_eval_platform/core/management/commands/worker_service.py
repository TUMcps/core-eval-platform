"""Run the remote Docker worker service."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from django.core.management.base import BaseCommand

from comp_eval_platform.compute import remote_docker_service as service


class _Handler(BaseHTTPRequestHandler):
    """
    Lightweight HTTP request handler that routes API calls to the underlying
    remote_docker_service functions. Acts as the bridge between the network
    and the local Docker daemon.
    """

    def _send(self, status: int, payload: dict):
        """Helper method to format and send a JSON HTTP response."""
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        """Helper method to read and parse the incoming JSON request body."""
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8") or "{}")

    def log_message(self, *_args):
        """Suppress default standard output logging for every HTTP request to keep console logs clean."""
        return

    def do_GET(self):
        """Handle incoming GET requests (read-only operations)."""
        parsed = urlparse(self.path)
        
        # Simple health check endpoint to verify the service is running
        if parsed.path == "/health":
            self._send(200, {"ok": True})
            return
            
        # Fetch the list of running nodes associated with a specific service ID
        if parsed.path == "/nodes":
            query = parse_qs(parsed.query)
            self._send(200, {"nodes": service.list_nodes(service_id=query.get("service_id", [""])[0])})
            return
            
        # Fallback for undefined endpoints
        self._send(404, {"detail": "not found"})

    def do_POST(self):
        """Handle incoming POST requests (state-changing operations)."""
        parsed = urlparse(self.path)
        data = self._read_json()
        
        # Start a new worker container
        if parsed.path == "/provision":
            self._send(200, service.provision(
                service_id=data.get("service_id", ""), 
                node_type=data.get("node_type", "local"), 
                image=data.get("image", ""), 
                authorized_key=data.get("authorized_key", ""), 
                eni=data.get("eni")
            ))
            return
            
        # Stop and remove a specific worker container
        if parsed.path == "/terminate":
            service.terminate(data.get("container_id", ""))
            self._send(200, {"ok": True})
            return
            
        # Garbage collect untracked containers for a given service ID
        if parsed.path == "/reap":
            service.reap_untracked(
                service_id=data.get("service_id", ""), 
                tracked_ids=data.get("tracked_ids") or []
            )
            self._send(200, {"ok": True})
            return
            
        # Fallback for undefined endpoints
        self._send(404, {"detail": "not found"})


class Command(BaseCommand):
    """
    Django management command to start the standalone remote Docker worker service.
    Usage: python manage.py <command_name> [--host 0.0.0.0] [--port 9001]
    """
    help = "Run the remote Docker worker service."

    def add_arguments(self, parser):
        """Define command-line arguments for host and port configuration."""
        parser.add_argument("--host", default="0.0.0.0")
        parser.add_argument("--port", default=9001, type=int)

    def handle(self, *args, **options):
        """Initialize and start the multithreaded HTTP server."""
        # Use ThreadingHTTPServer so the service can handle multiple requests concurrently
        server = ThreadingHTTPServer((options["host"], options["port"]), _Handler)
        self.stdout.write(self.style.SUCCESS(f"Worker service listening on {options['host']}:{options['port']}"))
        server.serve_forever()