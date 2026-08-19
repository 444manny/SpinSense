"""
recorder.py - background recording controlled by the web UI.

This wraps the exact same UDP-receive and CSV-writing logic as record.py,
but runs it in a background thread so a Flask "Start"/"Stop" button pair
can control it, instead of the terminal prompts record.py uses.

Only one recording can be active at a time (a single sensor can only be
worn by one person at once, so this isn't a real limitation).
"""
import csv
import socket
import threading
import time
from datetime import datetime
from pathlib import Path

ACCEL_SCALE = 2048.0
GYRO_SCALE = 16.4
PORT = 9999

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "unknown"
    finally:
        s.close()


def parse_packet(data):
    try:
        lines = data.decode("ascii", errors="replace").strip().split("\n")
        if not lines or not lines[0].startswith("#"):
            return None
        pid = int(lines[0][1:])
        samples = []
        for line in lines[1:]:
            parts = line.split(",")
            if len(parts) == 7:
                samples.append((int(parts[0]), [int(p) for p in parts[1:]]))
        return pid, samples
    except (ValueError, IndexError):
        return None


class Recorder:
    """Thread-safe start/stop wrapper around the UDP receive loop."""

    def __init__(self):
        self._lock = threading.Lock()
        self._thread = None
        self._stop_event = None
        self._sock = None
        self._label = None
        self._session = None
        self._n_samples = 0
        self._t_first = None
        self._t_start_wall = None
        self._outpath = None
        self._last_error = None

    def is_recording(self):
        with self._lock:
            return self._thread is not None and self._thread.is_alive()

    def status(self):
        with self._lock:
            recording = self._thread is not None and self._thread.is_alive()
            elapsed = 0.0
            if self._t_start_wall is not None:
                elapsed = time.time() - self._t_start_wall
            return {
                "recording": recording,
                "label": self._label,
                "session": self._session,
                "samples": self._n_samples,
                "elapsedS": round(elapsed, 1),
                "hasData": self._n_samples > 0,
                "localIp": get_local_ip(),
                "error": self._last_error,
            }

    def start(self, label, session):
        if not label or not str(label).strip():
            raise ValueError("Motion label cannot be empty")
        if self.is_recording():
            raise RuntimeError("A recording is already in progress - stop it first")

        with self._lock:
            self._label = str(label).strip()
            self._session = str(session).strip() or "1"
            self._n_samples = 0
            self._t_first = None
            self._t_start_wall = time.time()
            self._last_error = None
            self._stop_event = threading.Event()

        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return {"label": self._label, "session": self._session,
                "localIp": get_local_ip(), "port": PORT}

    def _run(self):
        DATA_DIR.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        outpath = DATA_DIR / f"{self._label}_s{self._session}_{stamp}.csv"
        self._outpath = outpath

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.bind(("0.0.0.0", PORT))
            sock.settimeout(0.5)
            self._sock = sock
        except OSError as e:
            self._last_error = f"Could not open UDP port {PORT}: {e}"
            return

        f = open(outpath, "w", newline="")
        writer = csv.writer(f)
        writer.writerow(["host_time_s", "t_us", "ax_g", "ay_g", "az_g",
                         "gx_dps", "gy_dps", "gz_dps", "packet_id"])
        try:
            while not self._stop_event.is_set():
                try:
                    data, _ = sock.recvfrom(2048)
                except socket.timeout:
                    continue
                parsed = parse_packet(data)
                if parsed is None:
                    continue
                pid, samples = parsed
                now = time.time()
                with self._lock:
                    if self._t_first is None:
                        self._t_first = now
                    for t_us, v in samples:
                        writer.writerow([
                            round(now - self._t_first, 4), t_us,
                            round(v[0] / ACCEL_SCALE, 4),
                            round(v[1] / ACCEL_SCALE, 4),
                            round(v[2] / ACCEL_SCALE, 4),
                            round(v[3] / GYRO_SCALE, 2),
                            round(v[4] / GYRO_SCALE, 2),
                            round(v[5] / GYRO_SCALE, 2), pid])
                        self._n_samples += 1
        finally:
            f.close()
            sock.close()

    def stop(self):
        with self._lock:
            if self._stop_event is None:
                raise RuntimeError("No recording has been started")
            stop_event = self._stop_event
            outpath = self._outpath
            n_samples = self._n_samples
            t_first = self._t_first
            label = self._label
            session = self._session

        stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=3.0)

        if n_samples == 0:
            if outpath is not None and outpath.exists():
                outpath.unlink()
            return {"saved": False, "samples": 0, "label": label,
                    "session": session, "message": "No data received - "
                    "nothing saved. Check the sensor is powered, WiFi-connected, "
                    "and on the same network as this computer."}

        duration = time.time() - t_first if t_first else 0
        rate = n_samples / duration if duration > 0 else 0
        return {
            "saved": True,
            "file": outpath.name if outpath else None,
            "samples": n_samples,
            "durationS": round(duration, 1),
            "rateHz": round(rate, 1),
            "label": label,
            "session": session,
        }


# module-level singleton - one recording at a time, shared across requests
recorder = Recorder()
