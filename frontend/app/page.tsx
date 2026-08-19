'use client';

import { useState } from 'react';
import Overview from '@/components/Overview';
import Recorder from '@/components/Recorder';
import Analysis from '@/components/Analysis';
import Sessions from '@/components/Sessions';

type View = 'overview' | 'record' | 'results' | 'sessions';

const NAV: { id: View; num: string; label: string }[] = [
  { id: 'overview', num: '00', label: 'Overview' },
  { id: 'record',   num: '01', label: 'Record' },
  { id: 'results',  num: '02', label: 'Analysis' },
  { id: 'sessions', num: '03', label: 'Sessions' },
];

export default function Page() {
  const [view, setView] = useState<View>('overview');
  const [ip, setIp] = useState('—');

  function go(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="shell">
      <nav className="rail">
        <div className="mark">
          <span className="markLine" />
          <span className="markName">SWING<br />LAB</span>
        </div>
        {NAV.map(n => (
          <button key={n.id} className="navItem" data-active={view === n.id}
                  onClick={() => go(n.id)}>
            <span className="navNum">{n.num}</span>
            <span>{n.label}</span>
          </button>
        ))}
        <div className="railFoot">
          <div className="ipBadge">
            <span className="ipLabel">This PC</span>
            <span className="ipValue">{ip}</span>
          </div>
        </div>
      </nav>

      <main className={view === 'overview' ? 'stage stageWide' : 'stage'}>
        {view === 'overview' && <Overview onNavigate={go} />}
        {view === 'record'   && <Recorder onIp={setIp} />}
        {view === 'results'  && <Analysis />}
        {view === 'sessions' && <Sessions />}
      </main>
    </div>
  );
}
