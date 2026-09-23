import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { clearAllLocalCaches } from '../services/firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  lang: 'th' | 'en';
}

interface ReactComponentInstance<P, S> {
  props: P;
  state: S;
  setState(updater: Partial<S> | ((prevState: S) => Partial<S>)): void;
  componentDidCatch?(error: Error, errorInfo: ErrorInfo): void;
  render(): ReactNode;
}

export class ErrorBoundary extends (React.Component as unknown as {
  new (props: Props): ReactComponentInstance<Props, State>;
}) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      lang: (typeof localStorage !== 'undefined' && localStorage.getItem('l2m_lang') === 'en') ? 'en' : 'th'
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetCacheAndReload = () => {
    try {
      clearAllLocalCaches();
    } catch (e) {
      console.error('Failed to clear local caches:', e);
    }
    window.location.reload();
  };

  private handleSimpleReload = () => {
    window.location.reload();
  };

  private toggleLang = () => {
    this.setState((prev) => {
      const nextLang = prev.lang === 'th' ? 'en' : 'th';
      try {
        localStorage.setItem('l2m_lang', nextLang);
      } catch {}
      return { lang: nextLang };
    });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const { lang, error, errorInfo, showDetails } = this.state;
      const th = lang === 'th';

      return (
        <div className="min-h-screen w-full bg-[#070b14] text-slate-100 flex flex-col items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-[#0f172a]/90 backdrop-blur-md border border-red-500/30 rounded-2xl p-6 shadow-2xl shadow-red-950/40 text-center relative overflow-hidden">
            {/* Subtle top glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Language Toggle */}
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={this.toggleLang}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                {th ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
              </button>
            </div>

            {/* Warning Icon */}
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-2 font-cinzel">
              {th ? 'พบข้อผิดพลาดในการแสดงผล' : 'Application Display Error'}
            </h2>

            {/* Description */}
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              {th
                ? 'ระบบตรวจพบข้อมูลแคชเดิมในเบราว์เซอร์ที่ไม่เข้ากันกับเวอร์ชันล่าสุด กรุณากดปุ่มด้านล่างเพื่อล้างแคชและโหลดข้อมูลใหม่'
                : 'The application encountered an issue caused by stale browser cache data. Please click below to reset local cache and reload.'}
            </p>

            {/* Primary Action Button */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-950/40 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" />
                <span>{th ? 'ล้างแคชและโหลดใหม่ (แนะนำ)' : 'Reset Cache & Reload (Recommended)'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleSimpleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{th ? 'โหลดหน้านี้ใหม่อีกครั้ง' : 'Reload Page'}</span>
              </button>
            </div>

            {/* Collapsible Error Details for Admins */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-left">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <span>{th ? 'รายละเอียดทางเทคนิค' : 'Technical Details'}</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDetails && (
                <div className="mt-2.5 p-3 rounded-lg bg-black/60 border border-slate-800 font-mono text-[10px] text-red-300/90 overflow-x-auto max-h-40 break-all select-text">
                  <p className="font-bold mb-1">{error?.toString()}</p>
                  {errorInfo?.componentStack && (
                    <pre className="text-[9px] text-slate-400 whitespace-pre-wrap leading-tight">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
