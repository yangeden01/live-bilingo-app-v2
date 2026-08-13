export interface SubtitleItem {
  id: string;
  timestamp: string;
  createdAt?: number;
  english: string;
  traditionalChinese: string;
  isFinal: boolean;
  confidence?: number;
  bookmarked?: boolean;
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
