#!/usr/bin/env python3
"""
app.py - the full-stack local web app.

Run:  python app.py
Then open http://localhost:5000 in your browser.

This is a real client-server app: a Flask backend serves a REST API that
reads from a local SQLite database (results.db), and the frontend
(static/index.html) fetches from that API with JavaScript rather than
having numbers baked into the page. Every analyze.py run adds a new
timestamped entry to the database, so the dashboard can show your
progress across every session, not just the latest one.

A "Run Analysis" button on the dashboard triggers analyze.py directly
from the browser (POST /api/run-analysis) - no need to switch to a
terminal after recording a new session.

Everything runs locally - no hosting, no accounts, no internet required
beyond loading the two Google Fonts.
"""
import subprocess
import sys
import webbrowser
import threading
from pathlib import Path

from flask import Flask, jsonify, render_template, request

import database as db
from recorder import recorder

app = Flask(__name__)

# analyze.py lives one folder up from this file (webapp/app.py -> ../analyze.py)
PROJECT_ROOT = Path(__file__).parent.parent
ANALYZE_SCRIPT = PROJECT_ROOT / "analyze.py"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/record/start", methods=["POST"])
def api_record_start():
    body = request.get_json(silent=True) or {}
    try:
        info = recorder.start(body.get("label", ""), body.get("session", "1"))
        return jsonify({"success": True, **info})
    except (ValueError, RuntimeError) as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/record/stop", methods=["POST"])
def api_record_stop():
    try:
        result = recorder.stop()
        return jsonify({"success": True, **result})
    except RuntimeError as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/record/status")
def api_record_status():
    return jsonify(recorder.status())


@app.route("/api/latest")
def api_latest():
    run = db.get_latest_run()
    if run is None:
        return jsonify({"empty": True})
    consistency = db.get_consistency_for_run(run["id"])
    link_quality = db.get_link_quality_for_run(run["id"])
    return jsonify({
        "empty": False,
        "run": run,
        "consistency": consistency,
        "linkQuality": link_quality,
    })


@app.route("/api/history")
def api_history():
    """Powers the 'progress over time' chart - one point per analyze.py run."""
    return jsonify(db.get_run_history())


@app.route("/api/run-analysis", methods=["POST"])
def api_run_analysis():
    """Runs analyze.py as a subprocess and returns its stdout/stderr, so the
    dashboard button gives the same result as running it from a terminal."""
    if not ANALYZE_SCRIPT.exists():
        return jsonify({
            "success": False,
            "output": "",
            "error": f"Could not find analyze.py at {ANALYZE_SCRIPT}",
        }), 404
    try:
        result = subprocess.run(
            [sys.executable, str(ANALYZE_SCRIPT)],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes - plenty for a proof-of-concept dataset
        )
        return jsonify({
            "success": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr if result.returncode != 0 else "",
        })
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "output": "",
            "error": "analyze.py took longer than 5 minutes and was stopped.",
        }), 504
    except Exception as e:
        return jsonify({"success": False, "output": "", "error": str(e)}), 500


def open_browser():
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    threading.Timer(1.0, open_browser).start()
    print("=" * 55)
    print("  Dashboard running at http://localhost:5000")
    print("  (Ctrl+C to stop)")
    print("=" * 55)
    app.run(debug=False, port=5000)

