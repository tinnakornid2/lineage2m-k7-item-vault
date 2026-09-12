import React, { useState, useRef } from 'react';
import { ArrowLeft, ExternalLink, RefreshCw, Sparkles, Flame, Minimize2, Maximize2 } from 'lucide-react';
import { Language, User } from '../types';

interface BossTimeViewProps {
  currentUser: User | null;
  lang: Language;
  isOwner?: boolean;
  isAdmin?: boolean;
  onBackToDashboard?: () => void;
}

export const BossTimeView: React.FC<BossTimeViewProps> = ({
  currentUser,
  lang,
  isOwner = false,
  isAdmin = false,
  onBackToDashboard
}) => {
  // Default to windowed mode if currentUser is logged in, or full-screen if standalone/unauthenticated
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (!currentUser) return true; // Standalone link
    try {
      const saved = localStorage.getItem('k7_boss_fullscreen');
      return saved !== null ? saved === 'true' : false; // Inside Clan Hub, default to windowed so Sidebar is visible!
    } catch {
      return false;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('k7_boss_fullscreen', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] bg-black p-0 m-0 w-screen h-screen overflow-hidden'
          : 'relative w-full rounded-2xl overflow-hidden border border-[#1e293b] shadow-2xl bg-[#030509] min-h-[820px] h-[calc(100vh-140px)]'
      }`}
    >
      {/* 100% Exact Original Client Application via Iframe (Edge-to-Edge) */}
      <iframe
        ref={iframeRef}
        src="/boss-tracker.html"
        className="w-full h-full border-none select-auto block"
        title="Lineage 2 Exact Boss Tracker Standalone"
        allow="autoplay; fullscreen"
      />

      {/* Prominent Floating Corner Navigation Widget (Always 100% visible, easy to return to Clan Hub) */}
      <div className="fixed bottom-4 right-4 z-[100000] flex items-center gap-2 p-1.5 px-2.5 rounded-full bg-[#0a0f1d]/95 hover:bg-[#0a0f1d] border border-amber-500/50 shadow-2xl backdrop-blur-md opacity-100 transition-all duration-200 select-none">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/60 text-amber-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            title={lang === 'th' ? 'กลับไปยังหน้าหลัก Clan Hub' : 'Back to Main Clan Hub'}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'th' ? 'กลับสู่ Clan Hub' : 'Back to Clan Hub'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleRefresh}
          className={`p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs transition-all cursor-pointer ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          title={lang === 'th' ? 'รีเฟรชหน้าจอ' : 'Reload'}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 px-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
          title={isFullscreen ? (lang === 'th' ? 'ย่อหน้าต่าง (แสดงเมนู Clan Hub)' : 'Exit Fullscreen') : (lang === 'th' ? 'ขยายเต็มจอ' : 'Fullscreen')}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-amber-300">{lang === 'th' ? 'ย่อหน้าต่าง' : 'Windowed'}</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] text-slate-300">{lang === 'th' ? 'เต็มจอ' : 'Fullscreen'}</span>
            </>
          )}
        </button>

        <a
          href="/boss-tracker.html"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-full bg-slate-800/80 hover:bg-amber-500/20 text-amber-300 border border-slate-700/60 text-xs transition-all cursor-pointer"
          title={lang === 'th' ? 'เปิดแยกแท็บใหม่ในเบราว์เซอร์' : 'Open in New Tab'}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

    </div>
  );
};
