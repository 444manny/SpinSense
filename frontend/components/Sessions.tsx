'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SessionFile } from '@/lib/types';

export default function Sessions() {
  const [list, setList] = useState<SessionFile[] | null>(null);

  const load = useCallback(async () => {
    try { setList(await api.sessions()); }
    catch { setList([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function discard(file: string) {
    if (!confirm(`Discard ${file}? This cannot be undone.`)) return;
    await api.deleteSession(file);
    load();
  }

  return (
    <>
      <div className="viewHead">
        <h1>Sessions</h1>
        <p className="lede">Every recording captured so far. Discard a session if a
          swing set went wrong, so it does not skew the analysis.</p>
      </div>

      {list && list.length === 0 && (
        <div className="empty">
          <p className="emptyTitle">Nothing recorded yet</p>
          <p>Head to Record and capture your first set of swings.</p>
        </div>
      )}

      {(list ?? []).map(s => (
        <div key={s.file} className="sess">
          <span className="sessLabel">{s.label}</span>
          <span className="sessMeta">
            session {s.session} · {s.samples.toLocaleString()} samples · {s.durationS}s · {s.modified}
          </span>
          <button className="btnGhost" onClick={() => discard(s.file)}>Discard</button>
        </div>
      ))}
    </>
  );
}
