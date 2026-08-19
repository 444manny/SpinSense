#!/usr/bin/env python3
"""
record.py - simple interactive session recorder.

Just run:  python record.py
It asks you what motion you're recording and which session number,
then listens for the ESP32 and saves a CSV into data/ automatically.
No flags to remember, no files to drag anywhere.
"""
import socket
import time
from datetime import datetime
from pathlib import Path

ACCEL_SCALE = 2048.0
GYRO_SCALE = 16.4
PORT = 9999
DATA_DIR = Path("data")


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


def record_one(label, session):
    import csv
    DATA_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    outpath = DATA_DIR / f"{label}_s{session}_{stamp}.csv"

    print(f"\nRecording '{label}' (session {session})")
    print(f"Your IP (set this as PC_IP in the firmware): {get_local_ip()}")
    print("Waiting for the sensor... swing when ready. Press Ctrl+C to stop.")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", PORT))
    sock.settimeout(1.0)

    n_samples, t_first = 0, None
    f = open(outpath, "w", newline="")
    writer = csv.writer(f)
    writer.writerow(["host_time_s", "t_us", "ax_g", "ay_g", "az_g",
                     "gx_dps", "gy_dps", "gz_dps", "packet_id"])
    try:
        while True:
            try:
                data, _ = sock.recvfrom(2048)
            except socket.timeout:
                continue
            parsed = parse_packet(data)
            if parsed is None:
                continue
            pid, samples = parsed
            now = time.time()
            if t_first is None:
                t_first = now
                print("  Recording! (Ctrl+C to stop)")
            for t_us, v in samples:
                writer.writerow([round(now - t_first, 4), t_us,
                                 round(v[0] / ACCEL_SCALE, 4),
                                 round(v[1] / ACCEL_SCALE, 4),
                                 round(v[2] / ACCEL_SCALE, 4),
                                 round(v[3] / GYRO_SCALE, 2),
                                 round(v[4] / GYRO_SCALE, 2),
                                 round(v[5] / GYRO_SCALE, 2), pid])
                n_samples += 1
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        f.close()
        sock.close()

    if n_samples == 0:
        print("No data received - nothing saved. Check WiFi/IP/firewall.")
        outpath.unlink(missing_ok=True)
        return
    dur = time.time() - t_first
    print(f"Saved: {outpath.name}  ({n_samples} samples, {dur:.1f}s, "
          f"{n_samples/dur:.0f} Hz)")


def main():
    print("=" * 50)
    print("  Sports sensor - recording session")
    print("=" * 50)
    while True:
        label = input("\nMotion label (e.g. forehand, backhand, serve, idle) "
                      "[blank to quit]: ").strip()
        if not label:
            break
        session = input("Session number (use 1, 2, 3... - use a NEW number "
                        "each time you remount the sensor): ").strip() or "1"
        record_one(label, session)
        again = input("\nRecord another? (y/n): ").strip().lower()
        if again != "y":
            break
    print("\nDone. Run 'python analyze.py' to see your results.")


if __name__ == "__main__":
    main()
