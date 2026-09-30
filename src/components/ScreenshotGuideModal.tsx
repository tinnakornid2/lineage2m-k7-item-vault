import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { sounds } from '../utils/sound';

interface ScreenshotGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'th' | 'en';
  onViewImageZoom?: (url: string, title?: string) => void;
  initialCountdown?: number;
}

type GuideLang = 'th' | 'en' | 'id';

interface GuideContent {
  eyebrow: string;
  title: string;
  intro: string;
  exampleTitle: string;
  exampleBadge: string;
  imageSrc: string;
  zoomHint: string;
  notRequiredTitle: string;
  notRequiredBadge: string;
  notRequiredDesc: string;
  warningText: string;
  deviceNote: string;
  closeBtnLabel: string;
  countdownPrefix: string;
}

const GUIDE_CONTENT: Record<GuideLang, GuideContent> = {
  th: {
    eyebrow: 'คู่มือสกรีนช็อต',
    title: 'วิธีส่งสกรีนช็อตสถิติที่ถูกต้อง',
    intro: 'ใช้คู่มือนี้เพื่อดูตัวอย่างสกรีนช็อตที่ควรอัปโหลดสำหรับการยืนยันสถิติ — ครบถ้วน อ่านชัด และโฟกัสที่รายละเอียดที่จำเป็น',
    exampleTitle: 'ตัวอย่างสกรีนช็อตที่ถูกต้อง',
    exampleBadge: 'OK example',
    imageSrc: '/assets/example/3.jpg',
    zoomHint: 'คลิกเพื่อขยายดูภาพใหญ่',
    notRequiredTitle: 'ไม่จำเป็นต้องใช้',
    notRequiredBadge: 'ไม่จำเป็น',
    notRequiredDesc: 'ไม่ต้องใช้รูปสกรีนช็อตของ Aster หรือ Spirits (Soulshot, Valor, Guardian, Conquer) รวมถึง Class & Agathion',
    warningText: 'ถ้าไม่ทำตามฟอร์แมตนี้ การยืนยันจะถูกปฏิเสธ และคำขอไอเทม / กองทุนแคลนจะถูกเลื่อนลำดับ',
    deviceNote: 'เมื่อปิดแล้ว คู่มือนี้จะถูกจดจำในอุปกรณ์นี้',
    closeBtnLabel: 'รับทราบแล้ว',
    countdownPrefix: 'ปิดได้ใน'
  },
  en: {
    eyebrow: 'Screenshot guide',
    title: 'How to submit the correct stat screenshot',
    intro: 'Use this guide to ensure your screenshot is ready before uploading — complete, readable, and focused on the required details for stat verification.',
    exampleTitle: 'Correct screenshot example',
    exampleBadge: 'OK example',
    imageSrc: '/assets/example/1.jpg',
    zoomHint: 'Click to zoom',
    notRequiredTitle: 'Not required',
    notRequiredBadge: 'Not required',
    notRequiredDesc: 'Screenshots for Aster or Spirits (Soulshot, Valor, Guardian, Conquer) or Class & Agathion are not required.',
    warningText: 'Failing to follow this format will result in rejected verification, and your request for items / clan fund will be deprioritized.',
    deviceNote: 'Once dismissed, this guide will be remembered on this device.',
    closeBtnLabel: 'I understand',
    countdownPrefix: 'Close available in'
  },
  id: {
    eyebrow: 'Panduan Screenshot',
    title: 'Cara submit screenshot stat yang benar',
    intro: 'Gunakan panduan ini buat mastiin screenshot lo udah bener sebelum diupload — lengkap, keliatan jelas, dan sesuai buat verifikasi.',
    exampleTitle: 'Contoh screenshot yang benar',
    exampleBadge: 'OK example',
    imageSrc: '/assets/example/2.jpg',
    zoomHint: 'Klik untuk perbesar',
    notRequiredTitle: 'Tidak diperlukan',
    notRequiredBadge: 'Tidak diperlukan',
    notRequiredDesc: 'Screenshot untuk Aster atau Spirit (Soulshot, Valor, Guardian, Conquer) maupun Class & Agathion tidak diperlukan.',
    warningText: 'Jika tidak mengikuti format ini, verifikasi akan ditolak, dan pengajuan item / dana clan lo akan ditunda.',
    deviceNote: 'Setelah ditutup, panduan ini bakal diinget di perangkat ini.',
    closeBtnLabel: 'Saya ngerti',
    countdownPrefix: 'Tutup tersedia dalam'
  }
};

export const ScreenshotGuideModal: React.FC<ScreenshotGuideModalProps> = ({
  isOpen,
  onClose,
  lang = 'th',
  onViewImageZoom,
  initialCountdown = 0
}) => {
  const [activeLang, setActiveLang] = useState<GuideLang>(lang === 'th' ? 'th' : 'en');
  const [countdown, setCountdown] = useState<number>(initialCountdown);
  const [imageError, setImageError] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setActiveLang(lang === 'th' ? 'th' : 'en');
      setCountdown(initialCountdown);
      setIsZoomOpen(false);
      setZoomScale(1);
    }
  }, [isOpen, lang, initialCountdown]);

  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen]);

  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  const content = GUIDE_CONTENT[activeLang];
  const canClose = countdown <= 0;

  const handleClose = () => {
    if (!canClose) return;
    sounds.playClick();
    localStorage.setItem('k7_screenshot_guide_dismissed', 'true');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9980] p-3 sm:p-6 flex items-center justify-center animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => {
          if (canClose) handleClose();
        }}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-5xl h-[calc(100vh-2rem)] sm:h-auto sm:max-h-[92vh] bg-[#0d111a] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 bg-[#090d15] shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <p className="font-semibold text-[10px] text-amber-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <HelpCircle className="size-3.5 text-cyan-400" />
                <span>{content.eyebrow}</span>
              </p>
              <h2 className="mt-1 font-bold text-slate-100 text-base sm:text-lg leading-tight">
                {content.title}
              </h2>
            </div>

            {/* Language Switcher Tabs */}
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveLang('th');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLang === 'th'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <img
                  src="/assets/flags/thailand.png"
                  alt="TH"
                  className="w-4 h-3 object-cover rounded-sm border border-slate-700"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span>TH</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveLang('en');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLang === 'en'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <img
                  src="/assets/flags/united-kingdom.png"
                  alt="EN"
                  className="w-4 h-3 object-cover rounded-sm border border-slate-700"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span>EN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveLang('id');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeLang === 'id'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <img
                  src="/assets/flags/indonesia.png"
                  alt="ID"
                  className="w-4 h-3 object-cover rounded-sm border border-slate-700"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span>ID</span>
              </button>

              {/* Close (X) icon */}
              {canClose && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition ml-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto space-y-5">
          <p className="max-w-3xl text-slate-400 text-xs sm:text-sm leading-relaxed">
            {content.intro}
          </p>

          <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)] gap-4">
            
            {/* Left Column: Correct Screenshot Example */}
            <div className="bg-[#111624] p-4 sm:p-5 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex sm:flex-row flex-col sm:justify-between sm:items-start gap-2 mb-3">
                  <p className="font-semibold text-[11px] text-slate-400 uppercase tracking-[0.18em]">
                    {content.exampleTitle}
                  </p>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px] whitespace-nowrap">
                    <CheckCircle2 className="size-3" />
                    {content.exampleBadge}
                  </span>
                </div>

                {/* Screenshot Image with Zoom click */}
                <div
                  onClick={() => {
                    sounds.playClick();
                    setIsZoomOpen(true);
                    setZoomScale(1);
                    onViewImageZoom?.(content.imageSrc, content.exampleTitle);
                  }}
                  className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 cursor-zoom-in transition hover:border-cyan-400/80 shadow-lg"
                >
                  <img
                    src={content.imageSrc}
                    alt={content.exampleTitle}
                    className="w-full h-auto block object-cover group-hover:scale-102 transition duration-300"
                    onError={(e) => {
                      if (!imageError) {
                        setImageError(true);
                        // Fallback to online Kain7 if local fails
                        (e.target as HTMLImageElement).src = `https://kain7.com${content.imageSrc}`;
                      }
                    }}
                  />

                  {/* Hover Click to Zoom overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3 pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 bg-black/80 backdrop-blur-sm text-cyan-200 border border-cyan-500/40 text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg">
                      <ZoomIn className="size-3.5 text-cyan-400" />
                      {content.zoomHint}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-400 italic">
                * {lang === 'th' ? 'คลิกที่รูปเพื่อเปิดดูขนาดเต็ม (Full Resolution)' : 'Click on image to view full resolution'}
              </div>
            </div>

            {/* Right Column: Rules & Warnings */}
            <div className="flex flex-col gap-4">
              
              {/* Not Required Box (Red alert) */}
              <div className="bg-[#141018] p-4 sm:p-5 border-2 border-rose-500/40 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                    <X className="size-3 text-rose-400" />
                    {content.notRequiredBadge}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-rose-200 mb-1">
                  {content.notRequiredTitle}
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {content.notRequiredDesc}
                </p>
              </div>

              {/* Penalty Warning Box (Amber alert) */}
              <div className="bg-[#16130d] p-4 sm:p-5 border-2 border-amber-500/40 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300 mb-1">
                    {lang === 'th' ? 'ข้อควรระวังสำคัญ' : 'Important Notice'}
                  </h4>
                  <p className="text-amber-200/90 text-xs leading-relaxed">
                    {content.warningText}
                  </p>
                </div>
              </div>

              {/* Requirement Checklist */}
              <div className="bg-[#0e1422] p-4 border border-slate-800 rounded-2xl space-y-2">
                <h5 className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                  {lang === 'th' ? 'จุดที่ต้องแสดงชัดเจนในภาพ:' : 'Checklist for valid screenshot:'}
                </h5>
                <ul className="text-xs text-slate-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                    <span>{lang === 'th' ? 'ชื่อตัวละคร (Character Name) ต้องตรงกับในระบบ' : 'Character Name must be clearly visible'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                    <span>{lang === 'th' ? 'ค่าสเตตัสพื้นฐาน (HP, MP, โจมตี, ป้องกัน, แม่นยำ)' : 'Basic stats (HP, MP, ATK, DEF, Accuracy)'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                    <span>{lang === 'th' ? 'ไม่ติดบัฟกิจกรรมหรือน้ำยาชั่วคราว' : 'No temporary event buffs or potions active'}</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-[#090d15] shrink-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <p className="text-slate-400 text-xs leading-relaxed">
            {content.deviceNote}
          </p>

          <button
            type="button"
            disabled={!canClose}
            onClick={handleClose}
            className="w-full sm:w-auto min-w-44 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
          >
            {canClose ? content.closeBtnLabel : `${content.countdownPrefix} ${countdown}s`}
          </button>
        </div>

      </div>

      {/* Fullscreen High-Resolution Zoom Lightbox */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-6 bg-black/92 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          <div
            className="relative max-w-[95vw] max-h-[92vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Toolbar Controls */}
            <div className="absolute top-3 right-3 sm:-top-12 sm:right-0 flex items-center gap-2 z-20">
              <div className="bg-slate-900/95 border border-slate-700/90 rounded-xl p-1 flex items-center gap-1.5 shadow-2xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.min(3, Math.round((s + 0.25) * 100) / 100))}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100))}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-800 text-xs font-mono font-bold text-cyan-300 transition cursor-pointer"
                  title="Reset Zoom (100%)"
                >
                  {Math.round(zoomScale * 100)}%
                </button>
                <div className="w-px h-4 bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition cursor-pointer"
                  title={lang === 'th' ? 'ปิด (Esc)' : 'Close (Esc)'}
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Bottom caption */}
            <div className="absolute -bottom-9 left-2 text-xs text-slate-400 font-semibold hidden sm:flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span>{content.exampleTitle}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500 text-[11px] font-mono">
                {lang === 'th' ? 'กด Esc หรือคลิกพื้นหลังเพื่อปิด' : 'Press Esc or click backdrop to close'}
              </span>
            </div>

            {/* High-Resolution Zoomable Image */}
            <div className="overflow-auto max-w-[95vw] max-h-[85vh] rounded-2xl border border-slate-700/80 shadow-2xl bg-slate-950/80 flex items-center justify-center p-1">
              <img
                src={content.imageSrc}
                alt={content.exampleTitle}
                style={{
                  transform: `scale(${zoomScale})`,
                  transformOrigin: 'center center'
                }}
                className="max-h-[80vh] max-w-full object-contain rounded-xl select-none transition-transform duration-150"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Standalone Trigger Banner matching Kain7's design
interface ScreenshotGuideTriggerProps {
  onClick: () => void;
  lang?: 'th' | 'en';
}

export const ScreenshotGuideTrigger: React.FC<ScreenshotGuideTriggerProps> = ({
  onClick,
  lang = 'th'
}) => {
  return (
    <button
      type="button"
      onClick={() => {
        sounds.playClick();
        onClick();
      }}
      className="screenshot-guide-trigger group mb-3 px-3.5 py-2.5 rounded-xl w-full text-left ring-0 focus:ring-0 cursor-pointer shadow-lg"
    >
      {/* Neon Running Border */}
      <span className="screenshot-guide-trigger-border" aria-hidden="true" />

      {/* Trigger Content */}
      <span className="relative z-10 flex items-center justify-between gap-3">
        <span className="flex items-center gap-3 min-w-0">
          <span className="size-8 rounded-lg bg-[#1e2330] border border-slate-700/80 flex items-center justify-center text-slate-200 shrink-0 group-hover:border-cyan-400 transition shadow-inner">
            <HelpCircle className="size-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-slate-100 text-xs leading-tight group-hover:text-cyan-300 transition">
              {lang === 'th' ? 'How to submit correct screenshot' : 'How to submit correct screenshot'}
            </span>
            <span className="flex items-center gap-1.5 mt-1 text-slate-400 text-[11px] leading-none">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="group-hover:text-slate-300 transition">
                {lang === 'th' ? 'View examples' : 'View examples'}
              </span>
            </span>
          </span>
        </span>
        <span className="text-slate-400 group-hover:text-cyan-300 transition shrink-0">
          <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </span>
    </button>
  );
};
