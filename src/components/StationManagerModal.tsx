import React from 'react';
import { RadioStation } from '../types';
import { Radio, Check, Globe, X, ShieldCheck, Activity } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stations: RadioStation[];
  activeStation: RadioStation;
  onSelectStation: (station: RadioStation) => void;
  onUpdateStations?: (repairedStations: RadioStation[]) => void;
}

export const StationManagerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  stations,
  activeStation,
  onSelectStation,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Radio className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                英文新聞與談話廣播
              </h2>
              <p className="text-xs text-slate-400 truncate">
                嚴選美英高品質英文時事與公共新聞談話頻道
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar Header */}
        <div className="py-2.5 border-b border-slate-800/80 my-2 flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            廣播頻道選單（美式新聞優先 • 深度訪談頻道）
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          <div className="grid grid-cols-1 gap-2.5">
            {stations.map((s) => {
              const isActive = s.id === activeStation.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelectStation(s);
                    onClose();
                  }}
                  className={`group p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 sm:gap-3 relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border-blue-500/70 text-white ring-1 ring-blue-500/40 shadow-lg shadow-blue-950/40'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Left Active Glow Indicator Line */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  )}

                  {/* Left Station Logo & Details */}
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                        isActive
                          ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/40'
                          : 'bg-slate-800/90 text-slate-400 border border-slate-700/50 group-hover:text-slate-200'
                      }`}
                    >
                      {isActive ? (
                        <Activity className="w-5 h-5 text-white animate-pulse" />
                      ) : (
                        <Radio className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className={`font-bold text-xs sm:text-sm truncate text-white ${isActive ? 'text-blue-100 font-extrabold' : ''}`}>
                          {s.name}
                        </h3>
                        {s.freq && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                            isActive
                              ? 'bg-blue-500/25 text-blue-200 border border-blue-400/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {s.freq}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 truncate min-w-0">
                        <span className="flex items-center gap-1 truncate shrink">
                          <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{s.location}</span>
                        </span>
                        <span className="opacity-40">•</span>
                        <span className="truncate">{s.category}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Selection Status Badge (Minimalist non-blocking layout) */}
                  <div className="flex items-center shrink-0 ml-1">
                    {isActive ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-semibold shadow-sm">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="hidden xs:inline text-[11px]">播放中</span>
                        <Check className="w-3.5 h-3.5 text-blue-300 stroke-[2.5]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-slate-800 group-hover:border-slate-700 flex items-center justify-center text-slate-600 group-hover:text-slate-400 transition-colors">
                        <Check className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
