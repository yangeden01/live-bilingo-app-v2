export interface SubtitleItem {
  id: string;
  timestamp: string;
  createdAt?: number;
  english: string;
  traditionalChinese: string;
  isFinal: boolean;
  confidence?: number;
  bookmarked?: boolean;
  audioTime?: number; // HTML5 audio element currentTime when released
  isInterim?: boolean; // Real-time streaming typing state
  durationMs?: number; // Estimated spoken duration in ms
  startTimeOffsetMs?: number; // Relative start offset
}

export interface RadioStation {
  id: string;
  name: string;
  freq?: string;
  location: string;
  category: string;
  streamUrl: string;
  isCustom?: boolean;
}

export type PlaybackStatus = 'IDLE' | 'BUFFERING' | 'PLAYING' | 'PAUSED' | 'ERROR';

export type ReadingMode = 'system' | 'paper' | 'light' | 'dark';

export interface AndroidFile {
  path: string;
  name: string;
  language: string;
  content: string;
  category: 'manifest' | 'gradle' | 'ui' | 'viewmodel' | 'stt' | 'player' | 'model';
}

export interface StreamStats {
  sttConnected: boolean;
  deepgramModel: string;
  geminiModel: string;
  bufferedDuration: number;
  totalSubtitlesCount: number;
}
