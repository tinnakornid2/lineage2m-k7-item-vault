import React, { useState } from 'react';
import { Megaphone, Edit3, X, Check, Bell, AlertTriangle, Calendar } from 'lucide-react';
import { AnnouncementSettings, Language, User } from '../types';
import { sounds } from '../utils/sound';

interface AnnouncementBarProps {
  announcement: AnnouncementSettings | null;
  currentUser: User | null;
  lang: Language;
  onSaveAnnouncement: (settings: AnnouncementSettings) => Promise<void>;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  announcement,
  currentUser,
  lang,
  onSaveAnnouncement
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editType, setEditType] = useState<'info' | 'urgent' | 'event'>('info');
  const [editSpeed, setEditSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isSaving, setIsSaving] = useState(false);

  const canEdit =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  const activeAnnouncement = announcement || {
    text: '⚔️ ยินดีต้อนรับสู่ระบบ Lineage 2M Clan Hub',
    enabled: true,
    type: 'info' as const,
    speed: 'normal' as const
  };

  const handleOpenEdit = () => {
    sounds.playClick();
    setEditText(activeAnnouncement.text);
    setEditEnabled(activeAnnouncement.enabled);
    setEditType(activeAnnouncement.type || 'info');
    setEditSpeed(activeAnnouncement.speed || 'normal');
    setIsEditModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim()) return;

    setIsSaving(true);
    sounds.playClick();
    try {
      await onSaveAnnouncement({
        text: editText.trim(),
        enabled: editEnabled,
        type: editType,
        speed: editSpeed,
        updatedBy: currentUser?.inGameName || 'Admin',
        updatedAt: Date.now()
      });
      sounds.playSuccess();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to save announcement:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Do not render bar if disabled and user cannot edit
  if (!activeAnnouncement.enabled && !canEdit) {
    return null;
  }

  // Visual styling variants
  const getThemeStyles = () => {
    switch (activeAnnouncement.type) {
      case 'urgent':
        return {
          barBg: 'bg-gradient-to-r from-[#280509] via-[#4d0c14] to-[#280509] border-y-2 border-red-500 shadow-[0_4px_35px_rgba(239,68,68,0.55)]',
          textColor: 'text-white font-extrabold text-sm sm:text-base tracking-wide [text-shadow:0_0_16px_rgba(239,68,68,0.9),0_0_30px_rgba(239,68,68,0.5)]',
          iconColor: 'text-white',
          badge: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black border border-red-300 shadow-[0_0_18px_rgba(239,68,68,0.9)]',
          beacon: 'bg-red-400',
          badgeText: lang === 'th' ? 'ด่วนพิเศษ' : 'URGENT',
          icon: AlertTriangle
        };
      case 'event':
        return {
          barBg: 'bg-gradient-to-r from-[#261502] via-[#4a2e06] to-[#261502] border-y-2 border-[#f59e0b] shadow-[0_4px_35px_rgba(245,158,11,0.55)]',
          textColor: 'text-[#fffde6] font-extrabold text-sm sm:text-base tracking-wide [text-shadow:0_0_16px_rgba(245,158,11,0.9),0_0_30px_rgba(212,175,55,0.6)]',
          iconColor: 'text-slate-950',
          badge: 'bg-gradient-to-r from-[#f59e0b] via-[#fcd34d] to-[#d97706] text-slate-950 font-black border border-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.9)]',
          beacon: 'bg-amber-400',
          badgeText: lang === 'th' ? 'กิจกรรมกิลด์' : 'GUILD EVENT',
          icon: Calendar
        };
      case 'info':
      default:
        return {
          barBg: 'bg-gradient-to-r from-[#071328] via-[#0d2757] to-[#071328] border-y-2 border-[#38bdf8] shadow-[0_4px_35px_rgba(56,189,248,0.5)]',
          textColor: 'text-white font-extrabold text-sm sm:text-base tracking-wide [text-shadow:0_0_16px_rgba(56,189,248,0.9),0_0_30px_rgba(56,189,248,0.5)]',
          iconColor: 'text-slate-950',
          badge: 'bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500 text-slate-950 font-black border border-cyan-100 shadow-[0_0_18px_rgba(56,189,248,0.9)]',
          beacon: 'bg-cyan-400',
          badgeText: lang === 'th' ? 'ประกาศสำคัญ' : 'GUILD NOTICE',
          icon: Bell
        };
    }
  };

  const theme = getThemeStyles();
  const IconComponent = theme.icon;

  // Animation duration based on speed and text length
  const durationMap = {
    slow: '45s',
    normal: '28s',
    fast: '16s'
  };
  const animDuration = durationMap[activeAnnouncement.speed || 'normal'] || '28s';

  return (
    <>
      {/* 1. RUNNING MARQUEE BAR (High Visibility & Glow) */}
      <div
        id="guild-marquee-announcement-bar"
        className={`w-full backdrop-blur-xl transition-all z-20 ${theme.barBg} ${
          !activeAnnouncement.enabled ? 'opacity-60 border-dashed border-slate-700' : ''
        }`}
      >
        <div className="w-full px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          
          {/* Left Badge with Pulsing Icon & Beacon */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${theme.badge} select-none`}
            >
              {/* Pulsing radar dot */}
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${theme.beacon} opacity-80`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.beacon}`} />
              </span>
              <IconComponent className={`w-4 h-4 ${theme.iconColor}`} />
              <span>{theme.badgeText}</span>
            </span>
            {!activeAnnouncement.enabled && (
              <span className="text-[11px] text-amber-300 font-medium italic">
                ({lang === 'th' ? 'ซ่อนอยู่' : 'Hidden'})
              </span>
            )}
          </div>

          {/* Running Ticker Track with Gradient Edge Fade */}
          <div
            className="flex-1 overflow-hidden relative select-none mx-3"
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 30px, black calc(100% - 30px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 30px, black calc(100% - 30px), transparent)'
            }}
          >
            <div
              className="inline-block whitespace-nowrap will-change-transform hover:[animation-play-state:paused]"
              style={{
                animation: `marquee ${animDuration} linear infinite`
              }}
            >
              <span className={theme.textColor}>
                {activeAnnouncement.text}
              </span>
              <span className="mx-10 text-[#d4af37] font-bold text-base">✦ ⚔️ ✦</span>
              <span className={theme.textColor}>
                {activeAnnouncement.text}
              </span>
              <span className="mx-10 text-[#d4af37] font-bold text-base">✦ ⚔️ ✦</span>
              <span className={theme.textColor}>
                {activeAnnouncement.text}
              </span>
              <span className="mx-10 text-[#d4af37] font-bold text-base">✦ ⚔️ ✦</span>
            </div>
          </div>

          {/* Right Action: Edit Button (Only visible for Admin/Owner) */}
          {canEdit && (
            <button
              id="btn-edit-announcement"
              type="button"
              onClick={handleOpenEdit}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f5d77f] to-[#aa841c] hover:from-[#fce082] hover:to-[#c99a22] text-slate-950 font-black text-xs shadow-lg shadow-amber-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-[#fff2b8]"
              title={lang === 'th' ? 'แก้ไขข้อความประกาศวิ่ง (Admin/Owner)' : 'Edit announcement text'}
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-950" />
              <span className="hidden sm:inline">
                {lang === 'th' ? 'แก้ไขประกาศ' : 'Edit'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 2. EDIT ANNOUNCEMENT MODAL */}
      {isEditModalOpen && (
        <div
          id="announcement-edit-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#0d1424] border border-slate-700 shadow-2xl p-6 space-y-5 text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100 font-cinzel">
                  {lang === 'th' ? 'จัดการประกาศข้อความวิ่ง' : 'Edit Guild Marquee Notice'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="space-y-4">
              
              {/* Text Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {lang === 'th' ? 'ข้อความประกาศวิ่ง:' : 'Announcement Message:'}
                </label>
                <textarea
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder={lang === 'th' ? 'พิมพ์ข้อความประกาศของกิลด์ที่ต้องการให้วิ่งด้านบน...' : 'Enter marquee text here...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#080d17] border border-slate-700 focus:border-amber-400 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
                  required
                />
              </div>

              {/* Type Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {lang === 'th' ? 'ประเภทของประกาศ:' : 'Notice Category:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditType('info')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      editType === 'info'
                        ? 'bg-sky-950/90 border-sky-500 text-sky-200 ring-2 ring-sky-500/30'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5 text-sky-400" />
                    <span>{lang === 'th' ? 'ทั่วไป (ฟ้า)' : 'Info (Blue)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('event')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      editType === 'event'
                        ? 'bg-amber-950/90 border-amber-500 text-amber-200 ring-2 ring-amber-500/30'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'th' ? 'กิจกรรม (ทอง)' : 'Event (Gold)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('urgent')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      editType === 'urgent'
                        ? 'bg-red-950/90 border-red-500 text-red-200 ring-2 ring-red-500/30'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span>{lang === 'th' ? 'ด่วนพิเศษ (แดง)' : 'Urgent (Red)'}</span>
                  </button>
                </div>
              </div>

              {/* Speed & Visibility Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Speed */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    {lang === 'th' ? 'ความเร็วการวิ่ง:' : 'Scroll Speed:'}
                  </label>
                  <select
                    value={editSpeed}
                    onChange={(e) => setEditSpeed(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#080d17] border border-slate-700 text-xs text-slate-200 focus:border-amber-400 outline-none"
                  >
                    <option value="slow">{lang === 'th' ? 'ช้า (อ่านสบาย)' : 'Slow'}</option>
                    <option value="normal">{lang === 'th' ? 'ปานกลาง (แนะนำ)' : 'Normal'}</option>
                    <option value="fast">{lang === 'th' ? 'เร็ว' : 'Fast'}</option>
                  </select>
                </div>

                {/* Visibility Toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    {lang === 'th' ? 'สถานะการแสดงผล:' : 'Visibility:'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditEnabled(!editEnabled)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                      editEnabled
                        ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span>{editEnabled ? (lang === 'th' ? 'เปิดแสดงผล' : 'Visible') : (lang === 'th' ? 'ปิดซ่อน' : 'Hidden')}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-current" />
                  </button>
                </div>
              </div>

              {/* Info text */}
              {activeAnnouncement.updatedBy && (
                <p className="text-[11px] text-slate-500 pt-1">
                  {lang === 'th'
                    ? `แก้ไขล่าสุดโดย: ${activeAnnouncement.updatedBy} (${
                        activeAnnouncement.updatedAt
                          ? new Date(activeAnnouncement.updatedAt).toLocaleString('th-TH')
                          : '-'
                      })`
                    : `Last updated by: ${activeAnnouncement.updatedBy}`}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !editText.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึกประกาศ' : 'Save Notice')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
