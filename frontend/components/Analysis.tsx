'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import type { LatestResponse, AnalysisRun } from '@/lib/types';

export default function Analysis() {
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const [history, setHistory] = useState<AnalysisRun[]>([]);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [runState, setRunState] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, h] = await Promise.all([api.latest(), api.history()]);
      setLatest(l);
      setHistory(h);
    } catch { /* backend not reachable yet */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run() {
    setRunning(true); setOutput(''); setRunState('working');
    try {
      const res = await api.runAnalysis();
      setOutput((res.output || '') + (res.error ? '\n' + res.error : ''));
      setRunState(res.success ? 'complete' : 'failed');
      if (res.success) await load();
    } catch (err) {
      setOutput('Could not reach the server: ' + err);
      setRunState('failed');
    } finally { setRunning(false); }
  }

  const fmt = (v: number | null | undefined) => v == null ? '—' : v.toFixed(1) + '%';
  const run0 = latest?.run;

  // roll consistency scores up per motion
  const byLabel: Record<string, number[]> = {};
  for (const row of latest?.consistency ?? []) {
    (byLabel[row.label] ||= []).push(row.consistency_dtw);
  }
  const rollup = Object.entries(byLabel)
    .map(([label, v]) => ({ label, avg: v.reduce((a, b) => a + b, 0) / v.length }))
    .sort((a, b) => a.avg - b.avg);
  const best = rollup[0]?.label;
  const worst = rollup.length > 1 ? rollup[rollup.length - 1].label : null;

  return (
    <>
      <div className="viewHead viewHeadRow">
        <div>
          <h1>Analysis</h1>
          <p className="lede">
            {run0 ? 'Latest run ' + run0.timestamp.replace('T', ' ') : 'Nothing analysed yet.'}
          </p>
        </div>
        <button className="btn btnGo" onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run analysis'}
        </button>
      </div>

      {output !== null && (
        <div className="panel">
          <div className="panelHead"><span>Console</span><span className="mono">{runState}</span></div>
          <pre className="console">{output}</pre>
        </div>
      )}

      {!run0 ? (
        <div className="empty">
          <p className="emptyTitle">No analysis yet</p>
          <p>Record at least one session, then run the analysis to see classification
            accuracy, movement consistency, and link quality here.</p>
        </div>
      ) : (
        <>
          <div className="statRow">
            <div className="stat"><span className="statLabel">Repetitions</span>
              <span className="statValue">{run0.total_reps}</span></div>
            <div className="stat"><span className="statLabel">Recordings</span>
              <span className="statValue">{run0.total_recordings}</span></div>
            <div className="stat"><span className="statLabel">Analysis runs</span>
              <span className="statValue">{history.length}</span></div>
            <div className="stat statHero"><span className="statLabel">Cross-session accuracy</span>
              <span className="statValue">{fmt(run0.acc_loso ?? run0.acc_kfold)}</span></div>
          </div>

          <h2 className="sec">Accuracy</h2>
          <div className="panel">
            <div className="accRow">
              <span className="accName">Same-session <em>(k-fold)</em></span>
              <div className="accBar"><div className="accFill accMuted" style={{ width: `${run0.acc_kfold ?? 0}%` }} /></div>
              <span className="accNum">{fmt(run0.acc_kfold)}</span>
            </div>
            <div className="accRow">
              <span className="accName">Cross-session <em>(held-out session)</em></span>
              <div className="accBar"><div className="accFill" style={{ width: `${run0.acc_loso ?? 0}%` }} /></div>
              <span className="accNum">{fmt(run0.acc_loso)}</span>
            </div>
            <p className="footNote">
              {run0.acc_loso == null
                ? 'Record a second session of each motion to unlock cross-session accuracy — the honest measure, since it tests on a session the model never saw.'
                : 'Cross-session accuracy holds out an entire session, so it reflects how the model performs on a fresh mounting rather than data it has already seen.'}
            </p>
          </div>

          <h2 className="sec">Progress across runs</h2>
          <div className="panel" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.map(h => ({
                name: h.timestamp.slice(5, 16).replace('T', ' '),
                same: h.acc_kfold, cross: h.acc_loso,
              }))}>
                <CartesianGrid stroke="#2C554A" />
                <XAxis dataKey="name" stroke="#8FA69D" fontSize={10} />
                <YAxis stroke="#8FA69D" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#12302A', border: '1px solid #2C554A', color: '#EFF3EC' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="same" name="Same-session" stroke="#8FA69D" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cross" name="Cross-session" stroke="#D6E64B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h2 className="sec">Movement consistency</h2>
          {rollup.length === 0 ? (
            <div className="panel">Two or more reps of the same motion in one session are
              needed before consistency can be scored.</div>
          ) : rollup.map(r => (
            <div key={r.label} className="consItem">
              <div className="consTop">
                <span className="consName">{r.label}</span>
                {r.label === best && <span className="tag tagBest">most repeatable</span>}
                {r.label === worst && <span className="tag tagWorst">least repeatable</span>}
              </div>
              <div className="consBottom">
                <div className="accBar">
                  <div className="accFill" style={{
                    width: `${Math.min(100, r.avg * 300)}%`,
                    background: r.label === worst ? 'var(--clay)' : 'var(--optic)',
                  }} />
                </div>
                <span className="accNum">{r.avg.toFixed(3)}</span>
              </div>
            </div>
          ))}

          {worst && (
            <div className="notice noticeAccent">
              Your <strong>{worst}</strong> varies most between repetitions. More reps of
              it would sharpen both your technique and the model.
            </div>
          )}

          <h2 className="sec">Link quality</h2>
          <div className="panel panelFlush">
            <table>
              <thead><tr><th>Recording</th><th>Rate</th><th>Packet loss</th></tr></thead>
              <tbody>
                {(latest?.linkQuality ?? []).map(s => (
                  <tr key={s.file}>
                    <td>{s.label} · session {s.session}</td>
                    <td>{s.rate_hz} Hz</td>
                    <td>{s.loss_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
