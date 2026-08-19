"""
database.py - persistent storage for analysis results.

Every time analyze.py runs, it calls save_run() here, which stores a new
timestamped "run" in a local SQLite file (results.db). Nothing is ever
overwritten - each analyze.py run adds a new row, so the dashboard can show
progress across your whole project, not just the latest snapshot.

No server, no setup - SQLite is just a single file on disk (results.db),
created automatically the first time this is imported.
"""
import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "results.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    total_reps INTEGER,
    total_recordings INTEGER,
    acc_kfold REAL,
    acc_loso REAL
);
CREATE TABLE IF NOT EXISTS consistency (
    run_id INTEGER REFERENCES runs(id),
    label TEXT,
    session INTEGER,
    reps INTEGER,
    consistency_dtw REAL
);
CREATE TABLE IF NOT EXISTS link_quality (
    run_id INTEGER REFERENCES runs(id),
    file TEXT,
    label TEXT,
    session INTEGER,
    rate_hz REAL,
    loss_pct REAL
);
"""


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def save_run(total_reps, total_recordings, acc_kfold, acc_loso,
            consistency_rows, link_rows):
    """Persist one analyze.py run. Returns the new run's id."""
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO runs (timestamp, total_reps, total_recordings, "
        "acc_kfold, acc_loso) VALUES (?, ?, ?, ?, ?)",
        (datetime.now().isoformat(timespec="seconds"), total_reps,
         total_recordings, acc_kfold, acc_loso),
    )
    run_id = cur.lastrowid
    for row in consistency_rows:
        conn.execute(
            "INSERT INTO consistency (run_id, label, session, reps, "
            "consistency_dtw) VALUES (?, ?, ?, ?, ?)",
            (run_id, row["label"], row["session"], row["reps"],
             row["consistency_dtw"]),
        )
    for row in link_rows:
        conn.execute(
            "INSERT INTO link_quality (run_id, file, label, session, "
            "rate_hz, loss_pct) VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, row["file"], row["label"], row["session"],
             row["rateHz"], row["lossPct"]),
        )
    conn.commit()
    conn.close()
    return run_id


def get_latest_run():
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM runs ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_run_history():
    """Every run's headline numbers, oldest first - powers the progress chart."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, timestamp, total_reps, acc_kfold, acc_loso "
        "FROM runs ORDER BY id ASC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_consistency_for_run(run_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT label, session, reps, consistency_dtw FROM consistency "
        "WHERE run_id = ?", (run_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_link_quality_for_run(run_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT file, label, session, rate_hz, loss_pct FROM link_quality "
        "WHERE run_id = ?", (run_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
