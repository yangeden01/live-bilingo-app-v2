import React, { useState } from 'react';
import {
  Star,
  Trash2,
  Play,
  Plus,
  Radio,
  Video,
  X,
  ExternalLink,
  Check,
  Sparkles,
  ClipboardPaste,
} from 'lucide-react';
import { YouTubeSavedUrl } from '../types';
import { extractYouTubeVideoId } from '../utils/youtubeUrl';

interface YouTubeSavedUrlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedUrls: YouTubeSavedUrl[];
  activeVideoId: string | null;
  onSelectUrl: (url: string, videoId: string, title?: string) => void;
  onSaveUrl: (item: { videoId: string; url: string; title?: string; isLive?: boolean }) => void;
  onDeleteUrl: (id: string) => void;
  currentTheme?: 'dark' | 'paper' | 'light';
}

export const YouTubeSavedUrlsModal: React.FC<YouTubeSavedUrlsModalProps> = ({
  isOpen,
  onClose,
  savedUrls,
  activeVideoId,
  onSelectUrl,
  onSaveUrl,
  onDeleteUrl,
  currentTheme = 'dark',
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'vod'>('all');

  if (!isOpen) return null;

  const isLight = currentTheme === 'light';
  const isPaper = currentTheme === 'paper';

  const modalBg = isPaper
    ? 'bg-[#FAF4E8] text-[#3B2E1E] border-[#E2D2B0]'
    : isLight
    ? 'bg-white text-slate-900 border-slate-200'
    : 'bg-slate-900 text-white border-slate-800';

  const cardBg = isPaper
    ? 'bg-[#F4EBD7] border-[#E2D2B0] hover:border-amber-600/40'
    : isLight
    ? 'bg-slate-50 border-slate-200 hover:border-blue-400'
    : 'bg-slate-800/60 border-slate-700/60 hover:border-blue-500/50';

  const inputBg = isPaper
    ? 'bg-[#FDFCFA] border-[#D9C4A1] text-[#3B2E1E]'
    : isLight
    ? 'bg-white border-slate-300 text-slate-900'
    : 'bg-slate-950 border-slate-800 text-white';

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setNewUrl(text.trim());
          setAddError(null);
        }
      }
    } catch (_) {}
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setAddError('請輸入 YouTube 影片或直播網址');
      return;
    }

    const videoId = extractYouTubeVideoId(trimmedUrl);
    if (!videoId) {
      setAddError('無法識別的 YouTube 網址，請確認包含 video ID 或 /live/');
      return;
    }

    const isLive = trimmedUrl.includes('/live/') || newTitle.toLowerCase().includes('live');

    onSaveUrl({
      videoId,
      url: trimmedUrl,
      title: newTitle.trim() || (isLive ? `YouTube 直播 (${videoId})` : `YouTube 影片 (${videoId})`),
      isLive,
    });

    setNewUrl('');
    setNewTitle('');
    setShowAddForm(false);
  };

  const filteredUrls = savedUrls.filter((item) => {
    if (activeTab === 'live') return !!item.isLive;
    if (activeTab === 'vod') return !item.isLive;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${modalBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>我的喜愛網址</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                  {savedUrls.length}
                </span>
              </h3>
              <p className="text-xs opacity-70">
                儲存常看的 YouTube 影片或新聞直播，一鍵切換播放
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-all cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className="px-5 py-3 border-b border-inherit flex flex-wrap items-center justify-between gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-black/20 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              全部 ({savedUrls.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                activeTab === 'live'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>直播 ({savedUrls.filter((u) => u.isLive).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vod')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                activeTab === 'vod'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>影片 ({savedUrls.filter((u) => !u.isLive).length})</span>
            </button>
          </div>

          {/* Toggle Add Form Button */}
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              showAddForm
                ? 'bg-slate-700 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
            }`}
          >
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{showAddForm ? '取消新增' : '手動新增網址'}</span>
          </button>
        </div>

        {/* Add Form Accordion */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="p-4 border-b border-inherit bg-black/5 dark:bg-black/25 space-y-2.5 animate-in slide-in-from-top duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                新增喜愛的 YouTube 網址
              </span>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="text-[11px] text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ClipboardPaste className="w-3 h-3" />
                貼上剪貼簿
              </button>
            </div>

            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="貼上 YouTube 影片或直播網址 (https://www.youtube.com/...)"
              className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />

            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="自訂標題名稱 (選填，例如：ABC News 24/7 即時直播)"
              className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />

            {addError && <p className="text-xs text-rose-500 font-medium">{addError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium opacity-70 hover:opacity-100"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
              >
                確認儲存
              </button>
            </div>
          </form>
        )}

        {/* Saved URLs List */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1 overscroll-contain">
          {filteredUrls.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <Star className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">尚未儲存任何喜歡的網址</p>
                <p className="text-xs opacity-70 max-w-xs mx-auto">
                  點擊主畫面網址列右側的「⭐ 儲存網址」或上方「手動新增」，即可一鍵收藏常用影片！
                </p>
              </div>
            </div>
          ) : (
            filteredUrls.map((fav) => {
              const isCurrent = fav.videoId === activeVideoId;
              const formattedDate = fav.savedAt
                ? new Date(fav.savedAt).toLocaleDateString('zh-TW', {
                    month: 'short',
                    day: 'numeric',
                  })
                : '';

              return (
                <div
                  key={fav.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${cardBg} ${
                    isCurrent ? 'ring-2 ring-blue-500 shadow-md' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {fav.isLive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 animate-pulse">
                          <Radio className="w-2.5 h-2.5" />
                          LIVE 直播
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500">
                          <Video className="w-2.5 h-2.5" />
                          影片
                        </span>
                      )}

                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          <Check className="w-2.5 h-2.5" />
                          目前播放中
                        </span>
                      )}

                      {fav.channelName && (
                        <span className="text-[11px] opacity-60 truncate max-w-[140px]">
                          {fav.channelName}
                        </span>
                      )}

                      {formattedDate && (
                        <span className="text-[10px] opacity-40 ml-auto">{formattedDate}</span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2">
                      {fav.title}
                    </h4>

                    <p className="text-[11px] font-mono opacity-50 truncate">{fav.url}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectUrl(fav.url, fav.videoId, fav.title);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                      title="載入播放此網址"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isCurrent ? '重新載入' : '播放'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteUrl(fav.id)}
                      className="p-1.5 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="從喜愛清單刪除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-inherit flex items-center justify-between text-xs opacity-70">
          <span>支援 YouTube 一般影片、短網址與 /live/ 即時直播串流</span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-blue-500 hover:underline cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
