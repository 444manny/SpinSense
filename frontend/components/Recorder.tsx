'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { RecordStatus } from '@/lib/types';

const POLL_MS = 700;

export default function Recorder({ onIp }: { onIp: (ip: string) => void }) {
  const [label, setLabel] = useState('');
  const [session, setSession] = useState('1');
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<RecordStatus | null>(null);
  const [notice, setNotice] = useState<{ text: string; kind: 'ok' | 'bad' } | null>(null);
  const [stopping, setStopping] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const traceRef = useRef<number[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(44,85,74,0.65)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const data = traceRef.current;
    if (!data.length) return;

    const peak = Math.max(...data, 300);
    const trigY = h - (250 / peak) * h * 0.92;
    ctx.strokeStyle = 'rgba(222,112,64,0.55)';
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(0, trigY); ctx.lineTo(w, trigY); ctx.stroke();
    ctx.setLineDash([]);

    const step = w / Math.max(data.length - 1, 1);
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - (v / peak) * h * 0.92;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#D6E64B';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(214,230,75,0.20)');
    grad.addColorStop(1, 'rgba(214,230,75,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }, []);

  // poll the backend while a recording is running
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const s = await api.recordStatus();
        setStatus(s);
        if (s.localIp) onIp(s.localIp);
        if (s.recording) {
          traceRef.current = s.trace ?? [];
          draw();
        }
        setRecording(s.recording);
      } catch { /* ignore transient poll errors */ }
    };

    tick();
    if (recording) timer = setInterval(tick, POLL_MS);
    return () => { if (timer) clearInterval(timer); };
  }, [recording, draw, onIp]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    draw();
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  async function start() {
    if (!label.trim()) {
      setNotice({ text: 'Enter a motion name first, or pick one below.', kind: 'bad' });
      return;
    }
    setNotice(null);
    try {
      const res = await api.startRecording(label.trim(), session || '1');
      if (!res.success) { setNotice({ text: res.error ?? 'Could not start.', kind: 'bad' }); return; }
      traceRef.current = [];
      draw();
      setRecording(true);
    } catch {
      setNotice({ text: 'Could not reach the server. Is app.py running?', kind: 'bad' });
    }
  }

  async function stop() {
    setStopping(true);
    try {
      const res = await api.stopRecording();
      setRecording(false);
      if (!res.success) setNotice({ text: res.error ?? 'Could not stop.', kind: 'bad' });
      else if (!res.saved) setNotice({ text: res.message ?? 'Nothing saved.', kind: 'bad' });
      else setNotice({
        text: `Saved ${res.file} — ${res.samples?.toLocaleString()} samples over ${res.durationS}s at ${res.rateHz} Hz, ${res.liveReps} reps detected.`,
        kind: 'ok',
      });
    } finally { setStopping(false); }
  }

  const live = recording && status ? status : null;

  return (
    <>
      <div className="viewHead">
        <h1>Record a session</h1>
        <p className="lede">Name the motion, start the capture, and swing. The trace
          below draws live from the sensor, so you can confirm every swing lands
          before committing to a full set.</p>
      </div>

      <div className="traceFrame">
        <canvas ref={canvasRef} />
        <div className="traceOverlay" style={{ opacity: live && live.samples > 0 ? 0 : 1 }}>
          <span className="traceIdleText">Waiting for signal</span>
        </div>
        <div className="traceScale">
          <span>&deg;/s</span>
          <span className="traceMax">
            {traceRef.current.length ? Math.round(Math.max(...traceRef.current, 300)) : '—'}
          </span>
        </div>
      </div>

      <div className="liveStrip">
        <div className="liveCell"><span className="cellLabel">Reps detected</span>
          <span className="cellValue">{live?.liveReps ?? 0}</span></div>
        <div className="liveCell"><span className="cellLabel">Last peak</span>
          <span className="cellValue">{live?.lastPeakDps ?? 0}<em>&deg;/s</em></span></div>
        <div className="liveCell"><span className="cellLabel">Samples</span>
          <span className="cellValue">{(live?.samples ?? 0).toLocaleString()}</span></div>
        <div className="liveCell"><span className="cellLabel">Elapsed</span>
          <span className="cellValue">{live?.elapsedS ?? 0}<em>s</em></span></div>
      </div>

      <div className="controlBar">
        <div className="field">
          <label htmlFor="labelInput">Motion</label>
          <input id="labelInput" value={label} disabled={recording} autoComplete="off"
                 placeholder="forehand" onChange={e => setLabel(e.target.value)} />
        </div>
        <div className="field fieldNarrow">
          <label htmlFor="sessionInput">Session</label>
          <input id="sessionInput" type="number" min="1" value={session} disabled={recording}
                 onChange={e => setSession(e.target.value)} />
        </div>
        {recording
          ? <button className="btn btnStop" onClick={stop} disabled={stopping}>Stop</button>
          : <button className="btn btnGo" onClick={start}>Start recording</button>}
      </div>

      <p className="quickLabels">
        Common motions:
        {['forehand', 'backhand', 'serve', 'idle'].map(m => (
          <button key={m} className="chip" onClick={() => setLabel(m)} disabled={recording}>{m}</button>
        ))}
      </p>

      {notice && (
        <div className={`notice ${notice.kind === 'ok' ? 'noticeOk' : 'noticeBad'}`}>{notice.text}</div>
      )}
    </>
  );
}
