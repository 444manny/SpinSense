import type {
  RecordStatus, StartResponse, StopResponse,
  LatestResponse, AnalysisRun, SessionFile, RunAnalysisResponse,
} from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok && res.status >= 500) {
    throw new Error(`Server returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  recordStatus: () => fetch('/api/record/status').then(json<RecordStatus>),

  startRecording: (label: string, session: string) =>
    fetch('/api/record/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, session }),
    }).then(json<StartResponse>),

  stopRecording: () =>
    fetch('/api/record/stop', { method: 'POST' }).then(json<StopResponse>),

  latest: () => fetch('/api/latest').then(json<LatestResponse>),

  history: () => fetch('/api/history').then(json<AnalysisRun[]>),

  sessions: () => fetch('/api/sessions').then(json<SessionFile[]>),

  deleteSession: (file: string) =>
    fetch(`/api/sessions/${encodeURIComponent(file)}`, { method: 'DELETE' })
      .then(json<{ success: boolean }>),

  runAnalysis: () =>
    fetch('/api/run-analysis', { method: 'POST' }).then(json<RunAnalysisResponse>),
};
