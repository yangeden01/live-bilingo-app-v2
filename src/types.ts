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
  start?: number; // Relative start time in seconds within 30s batch
  end?: number; // Relative end time in seconds within 30s batch
  scheduledReleaseTime?: number; // Wall-clock timestamp aligned with audio playback
  batchId?: string; // Identifier for the 30s batch
  hasAttachedAd?: boolean; // Permanently binds an in-feed native ad directly under this specific paragraph
  attachedAdIndex?: number; // The persistent index (0~4) for the ad creative
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

export type ChineseVariant = 'traditional' | 'simplified';

export type SubtitleFontSize = 'small' | 'medium' | 'large' | 'xlarge';

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
