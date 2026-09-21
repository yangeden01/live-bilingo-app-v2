import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Tv,
  Radio,
  Sparkles,
  Search,
  Star,
  ArrowDown,
  ArrowUp,
  Trash2,
  BookmarkCheck,
  Bookmark,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Play,
  Pause,
  Layers,
  Globe,
  Compass,
  AlertCircle,
  Volume2,
  VolumeX,
  Headphones,
} from 'lucide-react';
import { SubtitleItem, ReadingMode, ChineseVariant, SubtitleFontSize } from '../types';
import { YouTubeBilingualPlayer, YouTubePlayerRef } from './YouTubeBilingualPlayer';
import { BilingualSubtitleCard } from './BilingualSubtitleCard';
import { ReadingModeAndFontToolbar } from './ReadingModeAndFontToolbar';
import {
  YouTubeLiveNewsChannel,
  YOUTUBE_LIVE_NEWS_CHANNELS,
} from '../utils/youtubeLiveChannels';
import { useYouTubeLiveGroqSubtitles } from '../hooks/useYouTubeLiveGroqSubtitles';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import { vibrateDetentTick } from '../utils/haptics';

interface LiveVideoBilingualViewProps {
  onOpenDictionary?: (word?: string) => void;
  readingMode?: ReadingMode;
  onReadingModeChange?: (mode: ReadingMode) => void;
  effectiveTheme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  onChineseVariantChange?: (variant: ChineseVariant) => void;
  fontSize?: SubtitleFontSize;
  onFontSizeChange?: (size: SubtitleFontSize) => void;
  highlightDifficulty?: boolean;
  onHighlightDifficultyChange?: (enabled: boolean) => void;
  onPlaybackStateChange?: (state: 'playing' | 'paused' | 'buffering' | 'idle') => void;
}

const LIVE_LAST_CHANNEL_KEY = 'bilingo_live_video_last_channel_id';

export const LiveVideoBilingualView: React.FC<LiveVideoBilingualViewProps> = ({
  onOpenDictionary,
  readingMode = 'system',
  onReadingModeChange,
  effectiveTheme = 'dark',
  chineseVariant = 'traditional',
  onChineseVariantChange,
  fontSize = 'medium',
  onFontSizeChange,
  highlightDifficulty = true,
  onHighlightDifficultyChange,
  onPlaybackStateChange,
}) => {
  const currentTheme = effectiveTheme;
  const isLight = currentTheme === 'light';
  const isPaper = currentTheme === 'paper';

  // Active Live Channel state
  const [selectedChannel, setSelectedChannel] = useState<YouTubeLiveNewsChannel>(() => {
    const savedId = getPersistentItem(LIVE_LAST_CHANNEL_KEY);
    if (savedId) {
      const found = YOUTUBE_LIVE_NEWS_CHANNELS.find((c) => c.id === savedId);
      if (found) return found;
    }
    return YOUTUBE_LIVE_NEWS_CHANNELS[0];
  });

  const [customVideoId, setCustomVideoId] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  // Player mode: 'video' vs 'audio'
  const [streamMode, setStreamMode] = useState<'video' | 'audio'>(() =>
    selectedChannel.preferAudioMode ? 'audio' : 'video'
  );
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioIsPlaying, setAudioIsPlaying] = useState<boolean>(false);

  // Player state
  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const [playerState, setPlayerState] = useState<'playing' | 'paused' | 'buffering' | 'idle'>('idle');

  // Active videoId to play in player
  const activeVideoId = isCustomMode && customVideoId ? customVideoId : selectedChannel.defaultVideoId;

  // Groq AI real-time subtitles pipeline
  const {
    liveSubtitles,
    activeSubtitleId,
    activeChannel,
    setActiveChannel,
    isConnected,
    modelName,
    clearSubtitles,
    toggleBookmark,
  } = useYouTubeLiveGroqSubtitles({
    enabled: true,
    videoId: activeVideoId,
    title: selectedChannel.name,
    url: selectedChannel.streamUrl,
    isPlaying: playerState === 'playing',
  });

  // UI view tabs: 'all' vs 'bookmarks'
  const [subtitleTab, setSubtitleTab] = useState<'all' | 'bookmarks'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const subtitleContainerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize channel selection with hook and persistence
  const handleSelectChannel = (channel: YouTubeLiveNewsChannel) => {
    setVideoError(null);
    setSelectedChannel(channel);
    setIsCustomMode(false);
    setActiveChannel(channel);
    setPersistentItem(LIVE_LAST_CHANNEL_KEY, channel.id);
    vibrateDetentTick();

    if (channel.preferAudioMode) {
      setStreamMode('audio');
      if (playerRef.current) {
        playerRef.current.pause();
      }
    } else {
      setStreamMode('video');
      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
      }
    }
  };

  // Sync player state with top header
  const handlePlayerStateChange = useCallback(
    (state: 'playing' | 'paused' | 'buffering' | 'ended') => {
      const mapped = state === 'ended' ? 'idle' : state;
      setPlayerState(mapped);
      onPlaybackStateChange?.(mapped);
    },
    [onPlaybackStateChange]
  );

  // Audio broadcast player handlers
  const handleAudioPlay = () => {
    setAudioIsPlaying(true);
    setPlayerState('playing');
    onPlaybackStateChange?.('playing');
  };

  const handleAudioPause = () => {
    setAudioIsPlaying(false);
    setPlayerState('paused');
    onPlaybackStateChange?.('paused');
  };

  const toggleAudioPlayback = () => {
    if (!liveAudioRef.current) return;
    if (audioIsPlaying) {
      liveAudioRef.current.pause();
    } else {
      liveAudioRef.current.play().catch((e) => {
        console.warn('[LiveVideo] Audio stream play failed:', e);
      });
    }
  };

  // Global play/pause listener from top header
  useEffect(() => {
    const handleToggle = () => {
      if (streamMode === 'audio') {
        toggleAudioPlayback();
      } else {
        if (!playerRef.current) return;
        if (playerState === 'playing') {
          playerRef.current.pause();
        } else {
          playerRef.current.play();
        }
      }
    };
    const handlePause = () => {
      if (streamMode === 'audio') {
        liveAudioRef.current?.pause();
      } else {
        playerRef.current?.pause();
      }
    };

    window.addEventListener('live-video-toggle-play', handleToggle);
    window.addEventListener('live-video-pause', handlePause);
    return () => {
      window.removeEventListener('live-video-toggle-play', handleToggle);
      window.removeEventListener('live-video-pause', handlePause);
    };
  }, [playerState, streamMode, audioIsPlaying]);

  // Auto-scroll to top when new subtitle arrives (newest subtitle is on top)
  useEffect(() => {
    if (!autoScroll || !subtitleContainerRef.current) return;
    const container = subtitleContainerRef.current;
    container.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [liveSubtitles.length, activeSubtitleId, autoScroll]);

  // Filtered subtitles based on tab and search (strictly sorted newest first, older downwards)
  const filteredSubtitles = useMemo(() => {
    let list = [...liveSubtitles];
    if (subtitleTab === 'bookmarks') {
      list = list.filter((s) => s.bookmarked);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.english && s.english.toLowerCase().includes(q)) ||
          (s.traditionalChinese && s.traditionalChinese.includes(q))
      );
    }
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [liveSubtitles, subtitleTab, searchQuery]);

  // Color classes according to theme
  const cardBgClass = isPaper
    ? 'bg-[#FAF4E8] border-[#E2D2B0] text-[#3B2E1E]'
    : isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
    : 'bg-slate-900/90 border-slate-800 text-white';

  const secondaryBgClass = isPaper
    ? 'bg-[#F4EBD7] border-[#D9C4A1]'
    : isLight
    ? 'bg-slate-50 border-slate-200'
    : 'bg-slate-950/80 border-slate-800';

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/live\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    const vid = extractYouTubeId(customUrlInput.trim());
    if (vid) {
      setVideoError(null);
      setCustomVideoId(vid);
      setIsCustomMode(true);
      setShowCustomInput(false);
      setCustomUrlInput('');
      vibrateDetentTick();
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Channel Selector Bar */}
      <div className={`p-3 rounded-2xl border ${cardBgClass} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
              <Tv className="w-3.5 h-3.5" />
              24/7 影音即時雙語新聞直播
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {modelName.replace('Groq ', '')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                showCustomInput
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="輸入自訂 YouTube 直播網址"
            >
              <Globe className="w-3 h-3" />
              <span>自訂直播網址</span>
            </button>
          </div>
        </div>

        {/* Custom URL Input Bar */}
        {showCustomInput && (
          <form onSubmit={handleCustomUrlSubmit} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder="貼上 YouTube Live 直播網址 (如 https://www.youtube.com/live/xxx)..."
              className={`flex-1 px-3 py-1.5 rounded-xl text-xs border outline-none ${
                isPaper
                  ? 'bg-white border-[#D9C4A1] text-[#3B2E1E]'
                  : isLight
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-950 border-slate-700 text-white'
              }`}
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shrink-0"
            >
              載入直播
            </button>
          </form>
        )}

        {/* Channel Selection Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/40">
          <span className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-1">
            <Radio className="w-3 h-3 text-blue-400" />
            頻道選擇：
          </span>
          {YOUTUBE_LIVE_NEWS_CHANNELS.map((ch) => {
            const isSelected = !isCustomMode && ch.id === selectedChannel.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelectChannel(ch)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20 font-semibold'
                    : isPaper
                    ? 'bg-[#EBDDC3] text-[#5C4A32] border-[#D9C4A1] hover:bg-[#E2D2B0]'
                    : isLight
                    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span>{ch.badge}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
              </button>
            );
          })}
        </div>

        {/* Channel Info & AI Sync Strip (Moved above video) */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="font-semibold">{selectedChannel.name}</span>
            <span className="text-[11px] opacity-60">({selectedChannel.category})</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] opacity-70">
            <span>語音音訊與 Groq Whisper AI 雙語對齊中</span>
          </div>
        </div>
      </div>

      {/* 2. Reading Toolbar & Options (Moved above video) */}
      <div className={`p-3 rounded-2xl border ${cardBgClass}`}>
        <ReadingModeAndFontToolbar
          readingMode={readingMode}
          onReadingModeChange={onReadingModeChange}
          effectiveTheme={effectiveTheme}
          chineseVariant={chineseVariant}
          onChineseVariantChange={onChineseVariantChange}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          highlightDifficulty={highlightDifficulty}
          onHighlightDifficultyChange={onHighlightDifficultyChange}
          idPrefix="live-video"
        />
      </div>

      {/* 3. Subtitles Controls Bar (Search, Tabs, Auto-scroll, Clear - Moved above video) */}
      <div className={`p-3 rounded-2xl border ${cardBgClass} flex flex-wrap items-center justify-between gap-2`}>
        {/* Subtitle Tabs: All vs Bookmarks */}
        <div className="inline-flex p-0.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <button
            type="button"
            onClick={() => setSubtitleTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              subtitleTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>全部字幕</span>
            <span className="text-[10px] opacity-80 font-mono">({liveSubtitles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubtitleTab('bookmarks')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              subtitleTab === 'bookmarks'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3 fill-current" />
            <span>已收藏好句</span>
            <span className="text-[10px] opacity-80 font-mono">
              ({liveSubtitles.filter((s) => s.bookmarked).length})
            </span>
          </button>
        </div>

        {/* Search Subtitles */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋英語或中文字詞..."
              className={`w-full pl-8 pr-3 py-1 rounded-xl text-xs border outline-none ${
                isPaper
                  ? 'bg-white border-[#D9C4A1] text-[#3B2E1E]'
                  : isLight
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-950 border-slate-800 text-white'
              }`}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border flex items-center gap-1 ${
              autoScroll
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={autoScroll ? '最新字幕置頂（開）' : '最新字幕置頂（關）'}
          >
            <ArrowUp className={`w-3 h-3 ${autoScroll ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">最新置頂</span>
          </button>

          {liveSubtitles.length > 0 && (
            <button
              type="button"
              onClick={clearSubtitles}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="清空字幕"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Embedded Live Stream Player (In reading mode: pinned to top) */}
      <div
        id="live-video-player-section"
        className={`rounded-2xl overflow-hidden border ${cardBgClass} shadow-lg transition-all ${
          readingMode !== 'system' ? 'sticky top-14 sm:top-16 z-20 backdrop-blur-md' : ''
        }`}
      >
        {/* Stream Mode Switcher Header */}
        <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-950/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="font-semibold text-white tracking-wide">
              {streamMode === 'audio' ? '📻 原音廣播直播中' : '📺 影音視訊直播中'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {selectedChannel.badge}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (streamMode === 'video') {
                  playerRef.current?.pause();
                  setStreamMode('audio');
                  vibrateDetentTick();
                } else {
                  liveAudioRef.current?.pause();
                  setStreamMode('video');
                  vibrateDetentTick();
                }
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="切換影音或原音廣播模式"
            >
              {streamMode === 'video' ? (
                <>
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>切換為原音電台</span>
                </>
              ) : (
                <>
                  <Tv className="w-3 h-3 text-blue-400" />
                  <span>切換為影音直播</span>
                </>
              )}
            </button>

            {selectedChannel.youtubeLiveUrl && (
              <a
                href={selectedChannel.youtubeLiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="在 YouTube 開啟官方頻道直播"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Player Container */}
        {streamMode === 'audio' ? (
          /* Studio Audio Broadcast Visualizer Interface */
          <div className="w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 flex flex-col items-center justify-center relative min-h-[220px] text-center space-y-4">
            <audio
              ref={liveAudioRef}
              src={selectedChannel.streamUrl}
              preload="none"
              onPlay={handleAudioPlay}
              onPause={handleAudioPause}
              onError={(e) => console.warn('[LiveVideo] Audio stream error:', e)}
            />

            {/* Station Branding & Soundwave Equalizer */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span>ON AIR ・ 24/7 官方原音直播</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                {selectedChannel.name}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedChannel.category} ・ Groq AI 即時語音辨識與雙語翻譯同步運作中
              </p>
            </div>

            {/* Animated Equalizer Soundwave */}
            <div className="flex items-center justify-center gap-1.5 h-10 py-1">
              {[40, 75, 55, 90, 65, 80, 45, 85, 60].map((height, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full bg-gradient-to-t from-blue-600 to-emerald-400 transition-all duration-300 ${
                    audioIsPlaying ? 'animate-pulse' : 'opacity-30'
                  }`}
                  style={{
                    height: audioIsPlaying ? `${Math.max(12, height)}%` : '20%',
                    animationDelay: `${i * 120}ms`,
                    animationDuration: '600ms',
                  }}
                />
              ))}
            </div>

            {/* Audio Play/Pause Button */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleAudioPlayback}
                className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                {audioIsPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>暫停廣播原音</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>播放廣播原音</span>
                  </>
                )}
              </button>

              {selectedChannel.youtubeLiveUrl && (
                <a
                  href={selectedChannel.youtubeLiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>在 YouTube 開啟視訊</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          /* Embedded YouTube Video Player */
          <div className="aspect-video w-full bg-black relative">
            <YouTubeBilingualPlayer
              videoId={activeVideoId}
              onStateChange={handlePlayerStateChange}
              onError={(err) => {
                console.warn('[LiveVideo] Player error:', err);
                setVideoError(err);
              }}
              ref={playerRef}
              isLive={true}
            />

            {/* Fallback overlay if YouTube blocks embedding for a specific channel */}
            {videoError && (
              <div className="absolute inset-0 bg-slate-950/94 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10 space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <p className="text-xs font-semibold text-amber-300">{videoError}</p>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  此頻道的 YouTube 影片設有站外播放限制，但您可以一鍵切換至 24/7 原音電台模式，享受無中斷的音訊串流與即時雙語字幕：
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(null);
                      setStreamMode('audio');
                      setTimeout(() => toggleAudioPlayback(), 100);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>切換為原音電台播放 (含實時雙語字幕)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(null);
                      handleSelectChannel(YOUTUBE_LIVE_NEWS_CHANNELS[1]); // Sky News
                    }}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer transition-colors"
                  >
                    切換至 Sky News 24/7 直播
                  </button>

                  <a
                    href={selectedChannel.youtubeLiveUrl || `https://www.youtube.com/watch?v=${activeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>在 YouTube 開啟</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Subtitles Stream Section (Directly connects underneath the video player) */}
      <div className={`rounded-2xl border p-3 sm:p-4 space-y-3 ${cardBgClass}`}>
        {/* Subtitles Scroll List */}
        <div
          ref={subtitleContainerRef}
          className="space-y-3 max-h-[65vh] overflow-y-auto overscroll-contain pt-2 pb-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800"
        >
          {filteredSubtitles.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-500/10 text-blue-400 animate-pulse">
                <Tv className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold opacity-90">
                {subtitleTab === 'bookmarks'
                  ? '目前尚未收藏任何即時字幕好句'
                  : `正在接收 ${selectedChannel.name} 即時雙語語音辨識字幕...`}
              </p>
              <p className="text-[11px] opacity-60 max-w-sm mx-auto">
                {subtitleTab === 'bookmarks'
                  ? '點擊字幕卡片右側的星星圖示即可將重要句型加入收藏清單。'
                  : 'Groq Whisper Large V3 AI 正在切片串流音訊並進行英中對齊，字幕即將自動呈現。'}
              </p>
            </div>
          ) : (
            filteredSubtitles.map((sub, idx) => (
              <BilingualSubtitleCard
                key={sub.id}
                subtitle={sub}
                onBookmarkToggle={toggleBookmark}
                onOpenDictionary={onOpenDictionary}
                isLatest={idx === 0}
                searchQuery={searchQuery}
                fontSize={fontSize}
                chineseVariant={chineseVariant}
                segmentNumber={filteredSubtitles.length - idx}
                theme={currentTheme}
                highlightDifficulty={highlightDifficulty}
              />
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800/40 flex flex-wrap items-center justify-between text-[11px] opacity-60 px-1">
          <span>
            已接收 {liveSubtitles.length} 筆雙語字幕（
            {liveSubtitles.filter((s) => s.bookmarked).length} 筆已收藏）
          </span>
          <span>點擊英文字詞可即時查詢單字釋義與 CEFR 級別</span>
        </div>
      </div>
    </div>
  );
};
