export interface SubtitleItem {
  id: string;
  timestamp: string;
  createdAt?: number;
  english: string;
  traditionalChinese: string;
  isFinal: boolean;
  stationUrl?: string; // Canonical stream URL of the radio station
  stationName?: string; // Human-readable radio station name
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

export type ContentSourceMode = 'radio' | 'youtube';

export interface YouTubeSubtitleItem {
  id: string;
  videoId: string;
  startMs: number;
  endMs: number;
  english: string;
  traditionalChinese: string;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptResult {
  videoId: string;
  title?: string;
  durationSeconds?: number;
  language?: string;
  segments: TranscriptSegment[];
}

export interface CachedYouTubeData {
  version: number;
  videoId: string;
  title: string;
  duration: number;
  captionSource: string;
  subtitles: YouTubeSubtitleItem[];
  lastPlaybackPositionMs: number;
  createdAt: number;
  updatedAt: number;
}

export type YouTubeErrorCode =
  | 'INVALID_YOUTUBE_URL'
  | 'VIDEO_UNAVAILABLE'
  | 'CAPTIONS_NOT_AVAILABLE'
  | 'TRANSCRIPT_FETCH_FAILED'
  | 'TRANSLATION_FAILED'
  | 'PLAYER_LOAD_FAILED';

export const APP_VERSION = 'v2.5.1';
