"""Entry point for GoDaddy/Passenger deployments."""

import os
from pathlib import Path

from asgiref.wsgi import AsgiToWsgi

BASE_DIR = Path(__file__).resolve().parent

os.environ.setdefault("PO_RECON_STORAGE_ROOT", str((BASE_DIR / "storage").resolve()))
# When serving files through an alternative path adjust this value in cPanel.
os.environ.setdefault("PO_RECON_PUBLIC_URL_PREFIX", "/storage")

from app.main import app  # noqa: E402  pylint: disable=wrong-import-position

application = AsgiToWsgi(app)
