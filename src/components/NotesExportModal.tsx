import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, FileText, CheckCircle2, FolderDown } from 'lucide-react';
import { SubtitleItem } from '../types';

interface NotesExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  videoUrl: string;
  videoId: string;
  subtitles: SubtitleItem[];
}

export const NotesExportModal: React.FC<NotesExportModalProps> = ({
  isOpen,
  onClose,
  videoTitle,
  videoUrl,
  videoId,
  subtitles,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleNativeFileSaved = (event: MessageEvent) => {
      if (event.data?.type === 'ON_FILE_SAVED_SUCCESS') {
        setDownloadSuccessMessage('🎉 雙語筆記已成功儲存至您指定的目錄！');
        setTimeout(() => setDownloadSuccessMessage(null), 5000);
      }
    };
    window.addEventListener('message', handleNativeFileSaved);
    return () => window.removeEventListener('message', handleNativeFileSaved);
  }, []);

  if (!isOpen) return null;

  const defaultFilename = `Bilingo_Notes_${videoId || 'video'}.txt`;

  const generateFullText = () => {
    const lines = [
      `# ${videoTitle || 'Live Bilingo 雙語影音學習筆記'}`,
      `# 影片連結: ${videoUrl || 'https://www.youtube.com/watch?v=' + videoId}`,
      `# 匯出時間: ${new Date().toLocaleString()}`,
      `# 總雙語句子數: ${subtitles.length}`,
      '========================================',
      '',
    ];

    subtitles.forEach((sub, idx) => {
      const mins = Math.floor(sub.startMs / 60000);
      const secs = Math.floor((sub.startMs % 60000) / 1000);
      const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      lines.push(`${idx + 1}. [${timeStr}] ${sub.english}`);
      lines.push(`   ${sub.traditionalChinese}`);
      lines.push('');
    });

    return lines.join('\n');
  };

  const fullText = generateFullText();

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleShare = async () => {
    const title = videoTitle || 'Live Bilingo 雙語學習筆記';
    const androidBridge = (window as unknown as { AndroidBridge?: { shareText?: (t: string, txt: string) => void } }).AndroidBridge;

    if (androidBridge && typeof androidBridge.shareText === 'function') {
      androidBridge.shareText(title, fullText);
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: fullText,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  // 1. 讓使用者自選目錄另存新檔 (支援 Android 原生 SAF 目錄選擇器 & 瀏覽器 File System Access API)
  const handleSaveWithDirectoryPicker = async () => {
    // 優先檢查 Android Native Bridge (Android 系統 Storage Access Framework 目錄選擇器)
    const androidBridge = (window as unknown as {
      AndroidBridge?: {
        saveFileWithPicker?: (name: string, content: string) => void;
      };
    }).AndroidBridge;

    if (androidBridge && typeof androidBridge.saveFileWithPicker === 'function') {
      androidBridge.saveFileWithPicker(defaultFilename, fullText);
      setDownloadSuccessMessage('已開啟 Android 檔案目錄選擇器，請選擇儲存位置...');
      setTimeout(() => setDownloadSuccessMessage(null), 4000);
      return;
    }

    // 支援現代瀏覽器 (Chrome, Edge, Opera) 的 showSaveFilePicker API (彈出作業系統另存新檔視窗自選資料夾)
    if (typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function') {
      try {
        const picker = (window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (data: string) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }).showSaveFilePicker;

        const fileHandle = await picker({
          suggestedName: defaultFilename,
          types: [
            {
              description: '文字筆記文件 (*.txt)',
              accept: { 'text/plain': ['.txt'] },
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(fullText);
        await writable.close();

        setDownloadSuccessMessage('🎉 雙語筆記已成功儲存至您選擇的目錄！');
        setTimeout(() => setDownloadSuccessMessage(null), 5000);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // 使用者主動取消選擇目錄
          return;
        }
        console.warn('showSaveFilePicker failed, fallback to standard download:', err);
      }
    }

    // 若瀏覽器不支援 showSaveFilePicker，降級為標準下載
    handleQuickDownload();
  };

  // 2. 快速直接下載至預設 Downloads 目錄
  const handleQuickDownload = () => {
    try {
      const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccessMessage('🎉 筆記已存至手機/電腦「下載 (Downloads)」資料夾！');
      setTimeout(() => setDownloadSuccessMessage(null), 5000);
    } catch (e) {
      console.error('Download error:', e);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notes-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="notes-export-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                雙語學習筆記匯出
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium">
                  共 {subtitles.length} 句
                </span>
              </h3>
              <p className="text-xs text-stone-400 truncate max-w-[260px] sm:max-w-md">
                {videoTitle || '當前影片中英對照字幕整理'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explain Card */}
        <div className="px-5 py-2.5 bg-sky-950/30 border-b border-sky-900/30 text-xs text-sky-200/90 flex items-center justify-between flex-wrap gap-2">
          <span>💡 點擊「直接儲存TXT到」可自由選擇儲存路徑（手機各資料夾、SD卡、雲端硬碟或電腦資料夾），亦可一鍵複製全文！</span>
          {downloadSuccessMessage && (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/70 px-2.5 py-1 rounded-lg border border-emerald-800/80 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {downloadSuccessMessage}
            </span>
          )}
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-stone-950/40 space-y-3 font-mono text-xs select-text">
          <div className="p-3 bg-stone-900/80 rounded-xl border border-stone-800 text-stone-400 space-y-1">
            <div className="text-stone-300 font-semibold truncate">📌 {videoTitle}</div>
            <div>🔗 影片 ID: {videoId}</div>
            <div>⏱️ 雙語對照句數: {subtitles.length} 句</div>
            <div className="text-stone-400 text-[11px] pt-1">
              建議檔名：<span className="text-sky-300 font-mono">{defaultFilename}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {subtitles.map((sub, idx) => {
              const mins = Math.floor(sub.startMs / 60000);
              const secs = Math.floor((sub.startMs % 60000) / 1000);
              const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
              return (
                <div
                  key={sub.id || idx}
                  className="p-2.5 rounded-lg bg-stone-900/50 border border-stone-800/60 hover:border-stone-700 transition"
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[11px] font-bold text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/40">
                      [{timeStr}]
                    </span>
                    <span className="text-stone-200 text-xs sm:text-sm font-sans leading-relaxed">
                      {sub.english}
                    </span>
                  </div>
                  <div className="text-emerald-400/90 text-xs sm:text-sm font-sans pl-1 leading-relaxed">
                    {sub.traditionalChinese}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition cursor-pointer active:scale-95"
              title="複製整份雙語筆記到剪貼簿"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">已複製！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-stone-300" />
                  <span>複製全文</span>
                </>
              )}
            </button>

            {/* Native Share button */}
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition cursor-pointer active:scale-95 border border-indigo-500/40"
              title="分享至 LINE、備忘錄或 Google Drive"
            >
              <Share2 className="w-4 h-4" />
              <span>系統分享</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Save with Directory Picker button */}
            <button
              type="button"
              onClick={handleSaveWithDirectoryPicker}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold transition cursor-pointer active:scale-95 shadow-lg shadow-sky-900/30"
              title="選擇儲存目錄並下載 TXT 筆記檔"
            >
              <FolderDown className="w-4 h-4 text-white" />
              <span>直接儲存TXT到</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
