"""Configuration shared by CloudSentinel backend modules."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DATABASE_PATH = BACKEND_DIR / "cloudsentinel.db"

load_dotenv(BACKEND_DIR / ".env")
