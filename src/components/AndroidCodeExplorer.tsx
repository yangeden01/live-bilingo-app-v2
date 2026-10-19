import React, { useState } from 'react';
import { androidProjectFiles } from '../data/androidProjectFiles';
import { AndroidFile } from '../types';
import { Code2, Copy, Check, FileCode, Layers, Terminal, ExternalLink, Download } from 'lucide-react';

export const AndroidCodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<AndroidFile>(androidProjectFiles[0]);
  const [copied, setCopied] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: '全部檔案' },
    { id: 'ui', label: 'Jetpack Compose UI' },
    { id: 'stt', label: 'Deepgram & 翻譯' },
    { id: 'player', label: 'Media3 ExoPlayer' },
    { id: 'gradle', label: 'Gradle & Manifest' },
  ];

  const filteredFiles = activeCategory === 'all'
    ? androidProjectFiles
    : androidProjectFiles.filter((f) => {
        if (activeCategory === 'ui') return f.category === 'ui';
        if (activeCategory === 'stt') return f.category === 'stt';
        if (activeCategory === 'player') return f.category === 'player';
        if (activeCategory === 'gradle') return f.category === 'gradle' || f.category === 'manifest';
        return true;
      });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAll = () => {
    const combinedContent = androidProjectFiles
      .map((f) => `// ====================================\n// FILE: ${f.path}\n// ====================================\n\n${f.content}`)
      .join('\n\n\n');

    const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Live_Bilingo_Radio_Android_Kotlin_SourceCode.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-lg text-white">Android Kotlin 原生專案原始碼</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Jetpack Compose + Material 3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            完整 Kotlin 原始碼，可直接複製導入 Android Studio 進行編譯
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下載全部 (.txt)</span>
          </button>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-md shadow-blue-600/20"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已複製！' : '複製此檔'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[500px]">
        {/* Left File Navigation */}
        <div className="p-3 bg-slate-950/60 border-r border-slate-800 lg:col-span-1 flex flex-col gap-2">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-slate-800/80">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* File List */}
          <div className="space-y-1 overflow-y-auto max-h-[420px] pr-1">
            {filteredFiles.map((f) => (
              <button
                key={f.path}
                onClick={() => setSelectedFile(f)}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2.5 ${
                  selectedFile.path === f.path
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <FileCode className={`w-4 h-4 shrink-0 ${selectedFile.path === f.path ? 'text-blue-400' : 'text-slate-500'}`} />
                <div className="truncate">
                  <div className="text-xs truncate font-mono">{f.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{f.path}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="lg:col-span-3 bg-slate-900 flex flex-col overflow-hidden">
          {/* File Info Bar */}
          <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="truncate text-slate-300">{selectedFile.path}</span>
            <span className="uppercase text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
              {selectedFile.language}
            </span>
          </div>

          {/* Code Area */}
          <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-slate-200 max-h-[520px] selection:bg-blue-500/30">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
