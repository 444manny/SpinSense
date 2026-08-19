#!/usr/bin/env python3
"""
analyze.py - runs the ENTIRE analysis pipeline in one go.

Just run:  python analyze.py
It reads every CSV in data/, segments reps, extracts features,
trains and evaluates the classifier (both ways), scores consistency,
and prints a clear results summary to the terminal - plus saves every
plot as a PNG in results/ so you can drop them straight into the report.

No Jupyter, no clicking through cells, no dragging files.
"""
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # save PNGs, don't need a display
import matplotlib.pyplot as plt

DATA_DIR = Path("data")
RESULTS_DIR = Path("results")
FS = 200

FNAME_RE = re.compile(r"(?P<label>[A-Za-z0-9\-]+)_s(?P<session>\d+)_.*\.csv$")


def magnitudes(df):
    acc = np.sqrt(df["ax_g"]**2 + df["ay_g"]**2 + df["az_g"]**2).to_numpy()
    gyr = np.sqrt(df["gx_dps"]**2 + df["gy_dps"]**2 + df["gz_dps"]**2).to_numpy()
    return acc, gyr


def segment_reps(df, fs=FS, thresh_dps=100.0, min_dur_s=0.20,
                 min_gap_s=0.40, pad_s=0.25):
    _, gyr = magnitudes(df)
    win = max(1, int(0.05 * fs))
    smooth = np.convolve(gyr, np.ones(win) / win, mode="same")
    active = (smooth > thresh_dps).astype(int)
    edges = np.flatnonzero(np.diff(np.r_[0, active, 0]))
    regions = list(zip(edges[0::2], edges[1::2]))
    merged = []
    for s, e in regions:
        if merged and s - merged[-1][1] < min_gap_s * fs:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    pad = int(pad_s * fs)
    return [(max(0, s - pad), min(len(df), e + pad))
            for s, e in merged if (e - s) >= min_dur_s * fs]


def window_features(dfw, fs=FS):
    feats = {}
    acc, gyr = magnitudes(dfw)
    channels = {
        "ax": dfw["ax_g"].to_numpy(), "ay": dfw["ay_g"].to_numpy(),
        "az": dfw["az_g"].to_numpy(), "gx": dfw["gx_dps"].to_numpy(),
        "gy": dfw["gy_dps"].to_numpy(), "gz": dfw["gz_dps"].to_numpy(),
        "amag": acc, "gmag": gyr,
    }
    for name, x in channels.items():
        x = x.astype(float)
        feats[f"{name}_mean"] = x.mean()
        feats[f"{name}_std"] = x.std()
        feats[f"{name}_min"] = x.min()
        feats[f"{name}_max"] = x.max()
        feats[f"{name}_rms"] = np.sqrt(np.mean(x ** 2))
    feats["duration_s"] = len(dfw) / fs
    g = gyr - gyr.mean()
    if len(g) > 8:
        spec = np.abs(np.fft.rfft(g))
        freqs = np.fft.rfftfreq(len(g), 1 / fs)
        feats["gmag_domfreq"] = float(freqs[spec.argmax()])
    else:
        feats["gmag_domfreq"] = 0.0
    return feats


def resample_norm(x, n=128):
    x = np.asarray(x, float)
    x = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(x)), x)
    s = x.std()
    return (x - x.mean()) / s if s > 0 else x - x.mean()


def dtw_distance(a, b):
    n, m = len(a), len(b)
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = abs(a[i - 1] - b[j - 1])
            D[i, j] = cost + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return D[n, m] / (n + m)


def main():
    if not DATA_DIR.exists() or not list(DATA_DIR.glob("*.csv")):
        print(f"No CSVs found in {DATA_DIR}/ - run 'python record.py' first.")
        sys.exit(1)
    RESULTS_DIR.mkdir(exist_ok=True)

    print("=" * 55)
    print("  Loading recordings...")
    print("=" * 55)
    recordings = []
    for path in sorted(DATA_DIR.glob("*.csv")):
        m = FNAME_RE.match(path.name)
        if not m:
            print(f"  skipping {path.name} (bad filename format)")
            continue
        recordings.append({"label": m["label"], "session": int(m["session"]),
                           "path": path, "df": pd.read_csv(path)})
    if not recordings:
        print("No valid recordings found."); sys.exit(1)
    print(f"  {len(recordings)} recordings loaded, "
          f"labels: {sorted(set(r['label'] for r in recordings))}, "
          f"sessions: {sorted(set(r['session'] for r in recordings))}")

    print("\nSegmenting repetitions...")
    rows, rep_signals = [], []
    for r in recordings:
        reps = segment_reps(r["df"])
        print(f"  {r['path'].name:45s} -> {len(reps)} reps")
        for (s, e) in reps:
            dfw = r["df"].iloc[s:e]
            rows.append({"label": r["label"], "session": r["session"],
                        **window_features(dfw)})
            _, g = magnitudes(dfw)
            rep_signals.append({"label": r["label"], "session": r["session"],
                               "gmag": g})
    feature_df = pd.DataFrame(rows)
    if len(feature_df) < 4:
        print(f"\nOnly {len(feature_df)} reps detected total - too few to "
              f"classify. Record more swings, or lower thresh_dps in "
              f"segment_reps() if reps aren't being detected.")
        sys.exit(0)
    print(f"  Total: {len(feature_df)} reps, "
          f"{feature_df.shape[1]-2} features each")

    # ---- classification ----
    print("\n" + "=" * 55)
    print("  Classification")
    print("=" * 55)
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import ConfusionMatrixDisplay, accuracy_score
    from sklearn.model_selection import (StratifiedKFold, LeaveOneGroupOut,
                                          cross_val_predict)

    X = feature_df.drop(columns=["label", "session"]).to_numpy()
    y = feature_df["label"].to_numpy()
    groups = feature_df["session"].to_numpy()
    n_classes = len(set(y))

    clf = RandomForestClassifier(n_estimators=300, random_state=0)
    if len(feature_df) >= 5 and feature_df.groupby("label").size().min() >= 2:
        cv = StratifiedKFold(n_splits=min(5, feature_df.groupby("label").size().min()),
                             shuffle=True, random_state=0)
        y_pred = cross_val_predict(clf, X, y, cv=cv)
        acc_kfold = accuracy_score(y, y_pred)
        print(f"  5-fold CV accuracy:            {acc_kfold:.1%}")
        ConfusionMatrixDisplay.from_predictions(y, y_pred, cmap="Blues")
        plt.title("Classification - stratified k-fold CV")
        plt.tight_layout(); plt.savefig(RESULTS_DIR / "confusion_kfold.png", dpi=150)
        plt.close()
    else:
        print("  Not enough reps per label yet for k-fold CV.")

    if len(np.unique(groups)) >= 2:
        logo = LeaveOneGroupOut()
        y_pred_logo = cross_val_predict(clf, X, y, cv=logo, groups=groups)
        acc_logo = accuracy_score(y, y_pred_logo)
        print(f"  Leave-one-session-out accuracy: {acc_logo:.1%}  "
              f"<- the HONEST number for your report")
        ConfusionMatrixDisplay.from_predictions(y_pred_logo, y, cmap="Oranges")
        plt.title("Classification - leave-one-session-out")
        plt.tight_layout(); plt.savefig(RESULTS_DIR / "confusion_loso.png", dpi=150)
        plt.close()
    else:
        print("  Only one session recorded - record a 2nd session of each "
              "motion (remount the sensor between sessions) for the "
              "cross-session evaluation.")

    clf.fit(X, y)
    imp = (pd.Series(clf.feature_importances_,
                     index=feature_df.drop(columns=["label", "session"]).columns)
           .sort_values().tail(15))
    imp.plot.barh(figsize=(7, 5))
    plt.title("Top 15 feature importances")
    plt.tight_layout(); plt.savefig(RESULTS_DIR / "feature_importance.png", dpi=150)
    plt.close()

    # ---- consistency ----
    print("\n" + "=" * 55)
    print("  Movement consistency (lower = more consistent)")
    print("=" * 55)
    sig_df = pd.DataFrame(rep_signals)
    cons_rows = []
    for (label, session), grp in sig_df.groupby(["label", "session"]):
        curves = [resample_norm(g) for g in grp["gmag"]]
        if len(curves) < 2:
            continue
        dists = [dtw_distance(curves[i], curves[j])
                 for i in range(len(curves)) for j in range(i + 1, len(curves))]
        cons_rows.append({"label": label, "session": session,
                          "reps": len(curves),
                          "consistency_dtw": float(np.mean(dists))})
    if cons_rows:
        cons = pd.DataFrame(cons_rows)
        for _, row in cons.iterrows():
            print(f"  {row['label']:12s} session {row['session']}: "
                  f"{row['consistency_dtw']:.3f}  ({row['reps']} reps)")
        cons.pivot(index="label", columns="session",
                  values="consistency_dtw").plot.bar(figsize=(7, 4))
        plt.ylabel("mean pairwise DTW distance")
        plt.title("Motion consistency"); plt.tight_layout()
        plt.savefig(RESULTS_DIR / "consistency.png", dpi=150)
        plt.close()
    else:
        print("  Need at least 2 reps of the same motion in the same "
              "session to score consistency.")

    # ---- link stats ----
    print("\n" + "=" * 55)
    print("  Link quality per recording")
    print("=" * 55)
    for r in recordings:
        df = r["df"]
        pids = df["packet_id"]
        expected = int(pids.max() - pids.min() + 1)
        received = int(pids.nunique())
        dur = float(df["host_time_s"].iloc[-1] - df["host_time_s"].iloc[0])
        rate = len(df) / dur if dur > 0 else 0
        loss = 100 * (1 - received / expected) if expected > 0 else 0
        print(f"  {r['path'].name:45s} {rate:6.1f} Hz  {loss:5.2f}% loss")

    # ---- build the dashboard ----
    dash_data = {
        "generated": pd.Timestamp.now().strftime("%d %b %Y, %H:%M"),
        "totalReps": int(len(feature_df)),
        "totalRecordings": int(len(recordings)),
        "labels": sorted(set(y.tolist())),
        "sessions": sorted(set(int(s) for s in groups.tolist())),
        "accKfold": round(acc_kfold * 100, 1) if 'acc_kfold' in dir() else None,
        "accLoso": round(acc_logo * 100, 1) if 'acc_logo' in dir() else None,
        "consistency": cons_rows if cons_rows else [],
        "linkStats": [],
    }
    for r in recordings:
        df = r["df"]
        pids = df["packet_id"]
        expected = int(pids.max() - pids.min() + 1)
        received = int(pids.nunique())
        dur = float(df["host_time_s"].iloc[-1] - df["host_time_s"].iloc[0])
        dash_data["linkStats"].append({
            "file": r["path"].name, "label": r["label"], "session": r["session"],
            "rateHz": round(len(df) / dur, 1) if dur > 0 else 0,
            "lossPct": round(100 * (1 - received / expected), 2) if expected > 0 else 0,
        })

    write_dashboard(dash_data, RESULTS_DIR / "dashboard.html")
    print("\n" + "=" * 55)
    print(f"  Done. Plots saved in {RESULTS_DIR}/ - ready to drop into "
          f"your report.")
    print(f"  Dashboard: open {RESULTS_DIR / 'dashboard.html'} in a browser")
    print("=" * 55)


def write_dashboard(data, out_path):
    """Writes a single self-contained HTML file — no server needed, just
    double-click it and it opens in your browser with today's stats."""
    import json as _json

    # per-motion rollup: best (lowest) consistency score per label across sessions
    by_label = {}
    for row in data["consistency"]:
        by_label.setdefault(row["label"], []).append(row["consistency_dtw"])
    rollup = [{"label": k, "avg": sum(v) / len(v)} for k, v in by_label.items()]
    rollup.sort(key=lambda r: r["avg"])
    best = rollup[0]["label"] if rollup else None
    worst = rollup[-1]["label"] if len(rollup) > 1 else None

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Session Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {{
    --navy: #10192B;
    --navy-2: #17223B;
    --chalk: #F3F1EA;
    --line: #2B374F;
    --clay: #C1440E;
    --court: #4C8C6B;
    --mute: #8B93A3;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--navy); color: var(--chalk);
    font-family: 'Inter', sans-serif; line-height: 1.5;
    padding: 0 0 4rem;
  }}
  .eyebrow {{
    font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.12em;
    text-transform: uppercase; font-size: 0.72rem; color: var(--mute);
  }}
  header {{
    padding: 2.5rem 2rem 2rem; border-bottom: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: flex-end;
    flex-wrap: wrap; gap: 1rem;
  }}
  h1 {{
    font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 1.7rem;
    margin: 0.3rem 0 0; text-transform: uppercase; letter-spacing: 0.02em;
  }}
  .scoreboard {{
    max-width: 1000px; margin: 0 auto; padding: 2.5rem 2rem 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1px; background: var(--line); border: 1px solid var(--line);
  }}
  .cell {{ background: var(--navy-2); padding: 1.5rem 1.4rem; }}
  .cell .eyebrow {{ margin-bottom: 0.6rem; }}
  .digits {{
    font-family: 'IBM Plex Mono', monospace; font-weight: 600;
    font-size: 2.6rem; letter-spacing: 0.02em; color: var(--chalk);
  }}
  .digits.big {{ font-size: 3.4rem; color: var(--court); }}
  .unit {{ font-size: 1rem; color: var(--mute); margin-left: 0.3rem; }}
  section {{ max-width: 1000px; margin: 3rem auto 0; padding: 0 2rem; }}
  h2 {{
    font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 1.1rem;
    text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 1rem;
    color: var(--chalk); border-left: 4px solid var(--clay); padding-left: 0.7rem;
  }}
  .card {{
    background: var(--navy-2); border: 1px solid var(--line);
    border-radius: 3px; padding: 1.3rem 1.5rem; margin-bottom: 0.8rem;
  }}
  .row {{ display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }}
  .label {{ font-family: 'Oswald', sans-serif; font-size: 1.05rem; text-transform: capitalize; }}
  .bar-track {{ flex: 1; min-width: 120px; height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }}
  .bar-fill {{ height: 100%; border-radius: 4px; }}
  .tag {{
    font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem;
    padding: 0.2rem 0.55rem; border-radius: 3px; text-transform: uppercase;
    letter-spacing: 0.05em;
  }}
  .tag.good {{ background: rgba(76,140,107,0.18); color: var(--court); }}
  .tag.watch {{ background: rgba(193,68,14,0.18); color: var(--clay); }}
  .note {{
    font-size: 0.92rem; color: var(--mute); margin-top: 1rem; padding: 1rem 1.2rem;
    background: rgba(193,68,14,0.08); border-left: 3px solid var(--clay); border-radius: 2px;
  }}
  table {{ width: 100%; border-collapse: collapse; font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; }}
  th {{ text-align: left; color: var(--mute); font-weight: 500; padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--line); }}
  td {{ padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--line); }}
  footer {{ max-width: 1000px; margin: 3rem auto 0; padding: 1.5rem 2rem 0; color: var(--mute); font-size: 0.8rem; }}
  @media (prefers-reduced-motion: no-preference) {{
    .cell, .card {{ animation: rise 0.4s ease both; }}
  }}
  @keyframes rise {{ from {{ opacity: 0; transform: translateY(6px); }} to {{ opacity: 1; transform: translateY(0); }} }}
</style>
</head>
<body>
<header>
  <div>
    <div class="eyebrow">Sports Motion Tracker</div>
    <h1>Session Dashboard</h1>
  </div>
  <div class="eyebrow">Generated {data['generated']}</div>
</header>

<div class="scoreboard">
  <div class="cell">
    <div class="eyebrow">Total Reps</div>
    <div class="digits big">{data['totalReps']:03d}</div>
  </div>
  <div class="cell">
    <div class="eyebrow">Recordings</div>
    <div class="digits">{data['totalRecordings']}</div>
  </div>
  <div class="cell">
    <div class="eyebrow">Motions Tracked</div>
    <div class="digits">{len(data['labels'])}</div>
  </div>
  <div class="cell">
    <div class="eyebrow">Sessions</div>
    <div class="digits">{len(data['sessions'])}</div>
  </div>
</div>

<section>
  <h2>Classification Accuracy</h2>
  <div class="card row">
    <span class="label">Same-session (k-fold)</span>
    <span class="digits" style="font-size:1.6rem">{data['accKfold'] if data['accKfold'] is not None else '—'}<span class="unit">%</span></span>
  </div>
  <div class="card row">
    <span class="label">Cross-session (honest)</span>
    <span class="digits" style="font-size:1.6rem; color:var(--court)">{data['accLoso'] if data['accLoso'] is not None else '—'}<span class="unit">%</span></span>
  </div>
  {"<div class='note'>Only one session recorded so far — record a second session (remount the sensor between sessions) to unlock cross-session evaluation.</div>" if data['accLoso'] is None else ""}
</section>

<section>
  <h2>Movement Consistency</h2>
  {"".join(f'''<div class="card">
    <div class="row">
      <span class="label">{r['label']}</span>
      <span class="tag {'good' if r['label']==best else ('watch' if r['label']==worst else '')}">{'most consistent' if r['label']==best else ('needs practice' if r['label']==worst else '')}</span>
    </div>
    <div class="row" style="margin-top:0.6rem">
      <div class="bar-track"><div class="bar-fill" style="width:{min(100, r['avg']*300):.0f}%; background:{'var(--clay)' if r['label']==worst else 'var(--court)'}"></div></div>
      <span class="digits" style="font-size:1rem">{r['avg']:.3f}</span>
    </div>
  </div>''' for r in rollup) if rollup else "<div class='card'>Record at least 2 reps of the same motion in one session to see consistency scores.</div>"}
  {f"<div class='note'>Recommended practice: <strong>{worst}</strong> shows the least repeatable technique of the motions tracked. More reps here would help the model — and your form.</div>" if worst else ""}
</section>

<section>
  <h2>Link Quality</h2>
  <div class="card" style="padding:0">
    <table>
      <tr><th>Recording</th><th>Rate</th><th>Packet Loss</th></tr>
      {"".join(f"<tr><td>{s['label']} · session {s['session']}</td><td>{s['rateHz']} Hz</td><td>{s['lossPct']}%</td></tr>" for s in data['linkStats'])}
    </table>
  </div>
</section>

<footer>
  Generated automatically by analyze.py. Re-run after every recording session to refresh.
</footer>
</body>
</html>"""
    out_path.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
