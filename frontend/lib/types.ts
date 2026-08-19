// Shapes returned by the Flask API. Keeping these in one place means a change
// to the backend surfaces as a compile error rather than a runtime bug.

export interface RecordStatus {
  recording: boolean;
  label: string | null;
  session: string | null;
  samples: number;
  elapsedS: number;
  hasData: boolean;
  localIp: string;
  error: string | null;
  trace: number[];
  liveReps: number;
  lastPeakDps: number;
}

export interface StartResponse {
  success: boolean;
  label?: string;
  session?: string;
  localIp?: string;
  port?: number;
  error?: string;
}

export interface StopResponse {
  success: boolean;
  saved?: boolean;
  file?: string;
  samples?: number;
  durationS?: number;
  rateHz?: number;
  liveReps?: number;
  label?: string;
  session?: string;
  message?: string;
  error?: string;
}

export interface AnalysisRun {
  id: number;
  timestamp: string;
  total_reps: number;
  total_recordings: number;
  acc_kfold: number | null;
  acc_loso: number | null;
}

export interface ConsistencyRow {
  label: string;
  session: number;
  reps: number;
  consistency_dtw: number;
}

export interface LinkQualityRow {
  file: string;
  label: string;
  session: number;
  rate_hz: number;
  loss_pct: number;
}

export interface LatestResponse {
  empty: boolean;
  run?: AnalysisRun;
  consistency?: ConsistencyRow[];
  linkQuality?: LinkQualityRow[];
}

export interface SessionFile {
  file: string;
  label: string;
  session: number;
  samples: number;
  durationS: number;
  modified: string;
}

export interface RunAnalysisResponse {
  success: boolean;
  output: string;
  error: string;
}
