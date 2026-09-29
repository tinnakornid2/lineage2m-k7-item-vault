import React, { useState } from 'react';
import type { User, StatUpdateSettings, Language } from '../types';
import { isUserStatsPending } from '../types';
import { roundApproved } from '../utils/statRound';

export function StatRoundPanel({ users, settings, lang, onChange }: {
  users: User[]; settings: StatUpdateSettings; lang: Language;
  onChange: (enforceAt: number | null) => Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<'open' | 'close' | null>(null);
  const th = lang === 'th';
  const save = async (close: boolean, confirmed = false) => {
    const timestamp = new Date(date).getTime();
    if (!close && !Number.isFinite(timestamp)) { setError('date'); return; }
    if (!confirmed) { setError(''); setConfirmation(close ? 'close' : 'open'); return; }
    setConfirmation(null);
    setBusy(true); setError('');
    try { await onChange(close ? null : timestamp); } catch { setError('save'); } finally { setBusy(false); }
  };
  return <section className="my-4 rounded-xl border border-amber-500/30 bg-slate-900 p-4 text-slate-100">
    <h2 className="font-bold">{th ? 'รอบอัปเดตสเตตัสประจำเดือน' : 'Monthly stat update round'}</h2>
    <p className="my-2 text-sm">{settings.round?.active ? (th ? 'เริ่มบังคับอนุมัติก่อนเคลม: ' : 'Approval required for claims from: ') + new Date(settings.round.enforceAt).toLocaleString(th ? 'th-TH' : 'en-US') : (th ? 'ไม่มีรอบที่เปิดอยู่' : 'No active round')}</p>
    <label className="block text-sm">{th ? 'วันและเวลาเริ่มบังคับ (เวลาท้องถิ่น)' : 'Enforcement date and time (local time)'}<input type="datetime-local" disabled={busy || confirmation !== null} value={date} onChange={e => { setDate(e.target.value); setError(''); }} className="m-2 rounded bg-slate-800 p-2" /></label>
    <button disabled={busy} onClick={() => save(false)} className="rounded bg-amber-600 px-4 py-2 disabled:opacity-50">{th ? 'เปิดรอบใหม่' : 'Open new round'}</button>
    {settings.round?.active && <button disabled={busy} onClick={() => save(true)} className="ml-3 rounded bg-slate-700 px-4 py-2">{th ? 'ปิดรอบ' : 'Close round'}</button>}
    {confirmation && <div role="alert" className="mt-3 rounded border border-amber-400 p-3">
      <p>{confirmation === 'close' ? (th ? 'ปิดรอบและปลดล็อกการเคลมทั้งหมด?' : 'Close this round and unlock all claims?') : (th ? 'เปิดรอบใหม่? ทุกคนต้องส่งภาพใหม่และรออนุมัติอีกครั้ง' : 'Open a new round? Everyone must submit a new screenshot and be approved again.')}</p>
      <button onClick={() => save(confirmation === 'close', true)} className="mt-2 rounded bg-amber-600 px-3 py-2">{th ? 'ยืนยัน' : 'Confirm'}</button>
      <button onClick={() => setConfirmation(null)} className="ml-2 rounded bg-slate-700 px-3 py-2">{th ? 'ยกเลิก' : 'Cancel'}</button>
    </div>}
    {error && <p role="alert" className="text-red-300">{error === 'date' ? (th ? 'กรุณาเลือกวันและเวลา' : 'Please choose a date and time.') : (th ? 'บันทึกไม่สำเร็จ กรุณาลองใหม่' : 'Save failed. Please try again.')}</p>}
    {settings.round?.active && <ul className="mt-3 max-h-64 overflow-auto text-sm">{users.filter(u => u.status === 'active').map(u => <li key={u.id} className="flex justify-between gap-4 border-b border-slate-700 py-1"><span>{u.inGameName}</span><span>{roundApproved(u, settings) ? (th ? 'ผ่านแล้ว' : 'Approved') : isUserStatsPending(u) && Number(u.pendingPowerLevelRequestedAt || 0) >= settings.round!.openedAt ? (th ? 'รอตรวจ' : 'Awaiting review') : (th ? 'ยังไม่ส่ง / ต้องแก้ไข' : 'Not submitted / needs revision')}</span></li>)}</ul>}
  </section>;
}
