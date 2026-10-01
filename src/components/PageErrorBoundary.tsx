import React from 'react';
import { Language } from '../types';

interface Props {
  lang: Language;
  onHome: () => void;
  children: React.ReactNode;
}

/** Isolate a view failure so navigation remains usable without a full refresh. */
export class PageErrorBoundary extends React.Component<Props, { failed: boolean }> {
  // Explicit instance types also support this project's untyped React dependency.
  declare props: Readonly<Props>;
  declare setState: (state: Partial<{ failed: boolean }>, callback?: () => void) => void;
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Page render failed:', error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const th = this.props.lang === 'th';
    return (
      <div role="alert" className="rounded-xl border border-rose-500/40 bg-slate-900 p-6 text-slate-100 space-y-4">
        <h2>{th ? 'ไม่สามารถแสดงหน้านี้ได้' : 'This page could not be displayed'}</h2>
        <p>{th ? 'ข้อมูลบางรายการทำให้เกิดข้อผิดพลาด คุณยังสามารถเลือกเมนูอื่นได้ โดยไม่ต้องรีเฟรชหรือล้างข้อมูล' : 'Some data caused a display error. You can select another menu without refreshing or clearing data.'}</p>
        <div className="flex gap-3">
          <button type="button" className="rounded bg-sky-700 px-4 py-2" onClick={() => this.setState({ failed: false })}>{th ? 'ลองแสดงหน้านี้อีกครั้ง' : 'Retry this page'}</button>
          <button type="button" className="rounded bg-slate-700 px-4 py-2" onClick={this.props.onHome}>{th ? 'กลับหน้าหลัก' : 'Back to dashboard'}</button>
        </div>
      </div>
    );
  }
}
