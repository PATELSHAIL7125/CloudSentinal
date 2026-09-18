"""Small SQLite persistence layer for API test-run records.

PostgreSQL can replace this module by changing the repository implementation
without changing the REST API. SQLite keeps local development zero-config.
"""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime

from backend.config import DATABASE_PATH


def now() -> str:
    return datetime.now(UTC).isoformat()


def connection() -> sqlite3.Connection:
    database = sqlite3.connect(DATABASE_PATH, timeout=30.0)
    database.row_factory = sqlite3.Row
    return database


def initialize_database() -> None:
    with connection() as database:
        database.execute("PRAGMA journal_mode=WAL;")
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS test_runs (
                id TEXT PRIMARY KEY,
                test_name TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                exit_code INTEGER,
                summary TEXT,
                output TEXT NOT NULL DEFAULT ''
            )
            """
        )


def create_run(run_id: str, test_name: str) -> None:
    with connection() as database:
        database.execute(
            "INSERT INTO test_runs (id, test_name, status, created_at) VALUES (?, ?, ?, ?)",
            (run_id, test_name, "queued", now()),
        )


def update_run(run_id: str, **values: object) -> None:
    if not values:
        return
    assignments = ", ".join(f"{column} = ?" for column in values)
    with connection() as database:
        database.execute(
            f"UPDATE test_runs SET {assignments} WHERE id = ?",  # values are parameterized
            (*values.values(), run_id),
        )


def get_run(run_id: str) -> dict | None:
    with connection() as database:
        row = database.execute("SELECT * FROM test_runs WHERE id = ?", (run_id,)).fetchone()
    return dict(row) if row else None


def list_runs(limit: int = 50) -> list[dict]:
    with connection() as database:
        rows = database.execute(
            "SELECT * FROM test_runs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(row) for row in rows]
