import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Zap,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Swords,
  Shield,
  Crown,
  Flame,
  Star,
  Target,
  Image as ImageIcon,
  RotateCcw,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { User, StatDefinition, FormulaSettings, OFFICIAL_CLASSES, isUserStatsPending } from '../types';
import { getFormulaSettings, calculatePowerLevel } from '../services/powerFormulaService';
import { compressImageFile } from '../utils/imageCompressor';
import { sounds } from '../utils/sound';
import { ScreenshotGuideModal, ScreenshotGuideTrigger } from './ScreenshotGuideModal';

interface MyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  lang: 'th' | 'en';
  onRequestStatUpdate: (
    userId: string,
    newStats: Record<string, number>,
    newSpiritEnhancements: Record<string, number>,
    newPowerLevel: number,
    screenshotUrl?: string,
    profileData?: {
      classes?: string[];
      level?: number;
      legendClasses?: number;
      legendAgathions?: number;
    }
  ) => Promise<void>;
  onCancelPendingRequest?: (userId: string) => Promise<void>;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onViewImageZoom?: (url: string, title?: string) => void;
}

export const MyStatsModal: React.FC<MyStatsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  lang,
  onRequestStatUpdate,
  onCancelPendingRequest,
  showToast,
  onViewImageZoom
}) => {
  const [formulaSettings, setFormulaSettings] = useState<FormulaSettings>(getFormulaSettings());
  const [stats, setStats] = useState<Record<string, number>>({});
  const [spiritEnhancements, setSpiritEnhancements] = useState<Record<string, number>>({});
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [charLevel, setCharLevel] = useState<number>(0);
  const [charLegendClasses, setCharLegendClasses] = useState<number>(0);
  const [charLegendAgathions, setCharLegendAgathions] = useState<number>(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      const config = getFormulaSettings();
      setFormulaSettings(config);

      // Initialize stats: If user has pending stats, use them; otherwise use confirmed stats or defaults
      const currentStats = currentUser.pendingStats || currentUser.stats || {};
      const currentSpirits = currentUser.pendingSpiritEnhancements || currentUser.spiritEnhancements || {};

      const initialStats: Record<string, number> = {};
      const initialSpirits: Record<string, number> = {};

      config.stats.forEach((stat) => {
        initialStats[stat.id] = currentStats[stat.id] ?? 0;
        if (stat.inputType === 'spirit_card') {
          initialSpirits[stat.id] = currentSpirits[stat.id] ?? 0;
        }
      });

      setStats(initialStats);
      setSpiritEnhancements(initialSpirits);
      setScreenshotUrl(currentUser.pendingStatScreenshotUrl || '');

      // Character Profile (classes, level, legends)
      const initialClasses = currentUser.pendingClasses !== undefined && currentUser.pendingClasses !== null
        ? currentUser.pendingClasses
        : (currentUser.classes || (currentUser.characterClass ? [currentUser.characterClass] : []));
      setSelectedClasses(initialClasses);

      const initialLevel = currentUser.pendingLevel !== undefined && currentUser.pendingLevel !== null
        ? currentUser.pendingLevel
        : (currentUser.level || 0);
      setCharLevel(initialLevel);

      const initialLegendClasses = currentUser.pendingLegendClasses !== undefined && currentUser.pendingLegendClasses !== null
        ? currentUser.pendingLegendClasses
        : (currentUser.legendClasses || 0);
      setCharLegendClasses(initialLegendClasses);

      const initialLegendAgathions = currentUser.pendingLegendAgathions !== undefined && currentUser.pendingLegendAgathions !== null
        ? currentUser.pendingLegendAgathions
        : (currentUser.legendAgathions || 0);
      setCharLegendAgathions(initialLegendAgathions);

      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentUser]);

  // Global Ctrl + V paste listener inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processScreenshotFile(file, true);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen || !currentUser) return null;

  const processScreenshotFile = async (file: File, isPaste = false) => {
    try {
      sounds.playClick();
      const compressed = await compressImageFile(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 });
      setScreenshotUrl(compressed);
      if (showToast) {
        showToast(
          lang === 'th' ? 'แนบภาพสกรีนช็อตสำเร็จ (Ctrl + V) 📋' : 'Screenshot attached from clipboard 📋',
          'success'
        );
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshotUrl(reader.result as string);
        sounds.playClick();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processScreenshotFile(file, false);
      e.target.value = '';
    }
  };

  const handleStatNumberChange = (statId: string, val: string) => {
    const num = val === '' ? 0 : parseFloat(val);
    setStats((prev) => ({
      ...prev,
      [statId]: isNaN(num) ? 0 : Math.max(0, num)
    }));
  };

  const handleSpiritEnhancementSelect = (statId: string, tier: number) => {
    sounds.playClick();
    setSpiritEnhancements((prev) => ({
      ...prev,
      [statId]: tier
    }));
  };

  const handleToggleClass = (classNameEn: string) => {
    sounds.playClick();
    setSelectedClasses((prev) =>
      prev.includes(classNameEn)
        ? prev.filter((c) => c !== classNameEn)
        : [...prev, classNameEn]
    );
  };

  // Live Real-Time Power Level Calculation
  const currentVerifiedPL = currentUser.powerLevel || 0;
  const calculatedNewPL = calculatePowerLevel(stats, spiritEnhancements, formulaSettings, false);
  const plDiff = calculatedNewPL - currentVerifiedPL;

  const hasPending = isUserStatsPending(currentUser);
  const isRejected = Boolean(currentUser.statRejectionReason);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (calculatedNewPL <= 0) {
      setErrorMessage(lang === 'th' ? 'กรุณากรอกสเตตัสให้ได้ค่าพลังมากกว่า 0' : 'Please enter valid stats greater than 0');
      return;
    }

    if (!screenshotUrl) {
      setErrorMessage(
        lang === 'th'
          ? 'กรุณาแนบภาพสกรีนช็อตสเตตัสในเกม (วางรูปด้วย Ctrl+V หรืออัปโหลดไฟล์) เพื่อให้แอดมินตรวจสอบ'
          : 'Please attach a screenshot of your stats in game for admin verification'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      sounds.playClaim();
      await onRequestStatUpdate(
        currentUser.id,
        stats,
        spiritEnhancements,
        calculatedNewPL,
        screenshotUrl,
        {
          classes: selectedClasses,
          level: charLevel,
          legendClasses: charLegendClasses,
          legendAgathions: charLegendAgathions
        }
      );
      setSuccessMessage(
        lang === 'th'
          ? 'ส่งคำขออัปเดตสเตตัสเรียบร้อยแล้ว! แอดมินจะทำการตรวจสอบเร็วๆ นี้'
          : 'Stat update request submitted! Admin will verify shortly'
      );
      if (showToast) {
        showToast(
          lang === 'th' ? 'ส่งคำขออัปเดตสเตตัสสำเร็จ ⚡' : 'Stat update request submitted ⚡',
          'success'
        );
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPending = async () => {
    if (!onCancelPendingRequest) return;
    setIsSubmitting(true);
    try {
      sounds.playClick();
      await onCancelPendingRequest(currentUser.id);
      setSuccessMessage(lang === 'th' ? 'ยกเลิกคำขอเรียบร้อยแล้ว' : 'Pending request cancelled');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group stats by categories
  const activeStats = formulaSettings.stats.filter((s) => s.isActive);
  const combatStats = activeStats.filter((s) => s.category === 'combat');
  const defenseStats = activeStats.filter((s) => s.category === 'defense');
  const spiritStats = activeStats.filter((s) => s.inputType === 'spirit_card');
  const otherStats = activeStats.filter((s) => s.category === 'special' || s.category === 'custom');

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="size-4" />;
      case 'Swords':
        return <Swords className="size-4" />;
      case 'Shield':
        return <Shield className="size-4" />;
      case 'Crown':
        return <Crown className="size-4" />;
      case 'Zap':
        return <Zap className="size-4" />;
      case 'Flame':
        return <Flame className="size-4" />;
      case 'Star':
        return <Star className="size-4" />;
      default:
        return <Sparkles className="size-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
              <Zap className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {lang === 'th' ? 'สเตตัสของฉัน (My Stats & Power Level)' : 'My Stats & Power Level'}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  ⚡ {currentVerifiedPL.toLocaleString()} PL
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'อัปเดตสเตตัสตัวละครและผลึกวิญญาณ เพื่อคำนวณค่าพลังที่แท้จริงและปลดล็อกสิทธิ์รับไอเทม'
                  : 'Update character stats and spirits to calculate your true Power Level'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Rejection / Pending Banners */}
        {isRejected && !hasPending && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/70 text-rose-200 flex items-start gap-3 text-xs shadow-lg animate-fade-in">
            <AlertCircle className="size-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-300">
                {lang === 'th' ? '❌ คำขอสเตตัสล่าสุดไม่ผ่านการอนุมัติ' : '❌ Stat request was rejected'}
              </div>
              <p className="text-slate-300">
                {lang === 'th' ? 'เหตุผลจากแอดมิน: ' : 'Admin Feedback: '}
                <span className="font-semibold text-rose-300 underline underline-offset-2">
                  "{currentUser.statRejectionReason}"
                </span>
              </p>
              <div className="text-[11px] text-slate-400">
                {lang === 'th'
                  ? 'ระบบได้คงค่าเดิมที่คุณเคยกรอกไว้ให้แล้ว กรุณาแก้ไขเฉพาะจุดที่แอดมินแจ้ง แนบภาพใหม่ และกดส่งคำขออีกครั้ง'
                  : 'Your previous inputs are pre-filled. Please fix the requested fields and resubmit.'}
              </div>
            </div>
          </div>
        )}

        {hasPending && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <Clock className="size-4 text-amber-400 animate-spin" />
              <span>
                {lang === 'th'
                  ? `⏳ มีคำขออัปเดตสเตตัสใหม่ (${currentUser.pendingPowerLevel?.toLocaleString()} PL) รอแอดมินตรวจสอบ`
                  : `⏳ Stat update request (${currentUser.pendingPowerLevel?.toLocaleString()} PL) pending admin approval`}
              </span>
            </div>
            {onCancelPendingRequest && (
              <button
                type="button"
                onClick={handleCancelPending}
                disabled={isSubmitting}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                {lang === 'th' ? 'ยกเลิกคำขอ' : 'Cancel Request'}
              </button>
            )}
          </div>
        )}

        {/* Modal Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 pb-24">
          {/* Section 0: Character Stats Profile Card (Class multi, Level, Legends) */}
          <div className="rounded-2xl bg-slate-850/95 border border-slate-750 p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-300 shadow-inner shrink-0">
                  <svg className="size-5 text-slate-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3Zm2.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 5.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm.75 3.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5ZM10 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 10 8Zm-2.378 3c.346 0 .583-.343.395-.633A2.998 2.998 0 0 0 5.5 9a2.998 2.998 0 0 0-2.517 1.367c-.188.29.05.633.395.633h4.244Z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                    Character Stats
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'th'
                      ? 'ข้อมูลโปรไฟล์หลักสำหรับระบุตัวตนและใช้เป็นฐานคำนวณความก้าวหน้าของตัวละคร'
                      : 'Core profile inputs used to identify the character and calculate the main progression baseline.'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-3 py-1 rounded-full border border-slate-700/80 bg-slate-800/80 text-slate-300 tracking-wider shrink-0">
                PROFILE
              </span>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Class Picker (Multi-Select) */}
              <div className="lg:col-span-5 space-y-2">
                <label className="block text-xs font-semibold text-white">
                  Class <span className="font-normal text-slate-400">(multi)</span>
                </label>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-750 max-h-48 overflow-y-auto space-y-1.5">
                  {OFFICIAL_CLASSES.map((cls) => {
                    const isChecked = selectedClasses.includes(cls.nameEn);
                    return (
                      <div
                        key={cls.id}
                        onClick={() => handleToggleClass(cls.nameEn)}
                        className={`cursor-pointer flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition select-none ${
                          isChecked
                            ? 'border-purple-500 bg-purple-950/40 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="size-4 rounded accent-purple-500 cursor-pointer shrink-0"
                        />
                        <img
                          src={cls.icon}
                          alt={cls.nameEn}
                          className="size-5 shrink-0 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-xs font-medium truncate">
                          {cls.nameEn}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Level, Legend Classes, Legend Agathions */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Level */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-750 flex flex-col justify-between space-y-2">
                  <label className="text-xs font-semibold text-white">
                    Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={charLevel === 0 ? '' : charLevel}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setCharLevel(isNaN(v) ? 0 : Math.max(0, Math.min(99, v)));
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-850 border border-slate-700 text-white font-bold text-base text-center focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Legend Classes */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-750 flex flex-col justify-between space-y-2">
                  <label className="text-xs font-semibold text-white">
                    Legend Classes
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={charLegendClasses === 0 ? '' : charLegendClasses}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setCharLegendClasses(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-850 border border-slate-700 text-white font-bold text-base text-center focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Legend Agathions */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-750 flex flex-col justify-between space-y-2">
                  <label className="text-xs font-semibold text-white">
                    Legend Agathions
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={charLegendAgathions === 0 ? '' : charLegendAgathions}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setCharLegendAgathions(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-850 border border-slate-700 text-white font-bold text-base text-center focus:border-purple-500 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Combat Stats */}
          {combatStats.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Swords className="size-4 text-rose-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'สเตตัสการโจมตี (Combat Stats)' : 'Combat Stats'}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {combatStats.map((stat) => (
                  <div key={stat.id} className="p-3 rounded-xl bg-slate-850/80 border border-slate-750 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-300 truncate" title={stat.labelTh}>
                      {lang === 'th' ? stat.labelTh : stat.labelEn}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-sm focus:border-amber-400 focus:outline-none"
                      />
                      {stat.inputType === 'percentage' && (
                        <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold pointer-events-none">
                          %
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Defense Stats */}
          {defenseStats.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Shield className="size-4 text-blue-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'สเตตัสการป้องกันและลดทอน (Defense & Resistance)' : 'Defense & Resistance'}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {defenseStats.map((stat) => (
                  <div key={stat.id} className="p-3 rounded-xl bg-slate-850/80 border border-slate-750 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-300 truncate" title={stat.labelTh}>
                      {lang === 'th' ? stat.labelTh : stat.labelEn}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-sm focus:border-amber-400 focus:outline-none"
                      />
                      {stat.inputType === 'percentage' && (
                        <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold pointer-events-none">
                          %
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Interactive Spirits Progression Cards (ตรงตามรูปภาพ 100%) */}
          {spiritStats.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                    <Flame className="size-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      {lang === 'th' ? 'ผลึกวิญญาณ (Spirits Progression)' : 'Spirits Progression'}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        PROGRESSION
                      </span>
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {lang === 'th'
                    ? 'กรอกเลเวล และคลิกเลือกขั้นบวก 0, +1, +2, +3'
                    : 'Enter level and click enhancement tier'}
                </span>
              </div>

              {/* Spirits Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {spiritStats.map((stat) => {
                  const cfg = stat.spiritConfig;
                  const neonColor = cfg?.accentColor || '#3b82f6';
                  const currentTier = spiritEnhancements[stat.id] ?? 0;

                  return (
                    <div
                      key={stat.id}
                      className="p-4 rounded-2xl bg-slate-850/90 border border-slate-750 transition hover:border-slate-650 space-y-3 shadow-md"
                    >
                      {/* Spirit Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-6 rounded-lg flex items-center justify-center text-xs"
                            style={{ backgroundColor: `${neonColor}22`, color: neonColor }}
                          >
                            {renderIcon(cfg?.icon)}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-white">
                            {lang === 'th' ? stat.labelTh.replace(/ผลึกวิญญาณ:\s*/, '') : stat.labelEn.replace(/Spirit:\s*/, '')}
                          </span>
                        </div>
                      </div>

                      {/* Level & Enhancement Inputs */}
                      <div className="flex items-center gap-3">
                        {/* Level Input */}
                        <div className="w-24 shrink-0 space-y-1">
                          <label className="block text-[10px] text-slate-400 font-semibold uppercase">
                            Level
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center font-bold text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        {/* Enhancement Tiles [0] [+1] [+2] [+3] */}
                        <div className="flex-1 space-y-1">
                          <label className="block text-[10px] text-slate-400 font-semibold uppercase">
                            Enhancement
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[0, 1, 2, 3].map((tier) => {
                              const isSelected = currentTier === tier;
                              return (
                                <button
                                  key={tier}
                                  type="button"
                                  onClick={() => handleSpiritEnhancementSelect(stat.id, tier)}
                                  className={`py-2 rounded-xl text-xs font-bold transition select-none flex items-center justify-center border ${
                                    isSelected
                                      ? 'shadow-md scale-105'
                                      : 'bg-slate-900 text-slate-400 border-slate-750 hover:border-slate-650 hover:text-slate-200'
                                  }`}
                                  style={
                                    isSelected
                                      ? {
                                          borderColor: neonColor,
                                          color: neonColor,
                                          backgroundColor: `${neonColor}18`,
                                          boxShadow: `0 0 12px ${neonColor}44`
                                        }
                                      : undefined
                                  }
                                >
                                  {tier === 0 ? '0' : `+${tier}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Other / Special Stats */}
          {otherStats.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Star className="size-4 text-amber-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'สเตตัสพิเศษและอื่นๆ (Special Stats)' : 'Special Stats'}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {otherStats.map((stat) => (
                  <div key={stat.id} className="p-3 rounded-xl bg-slate-850/80 border border-slate-750 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-300 truncate" title={stat.labelTh}>
                      {lang === 'th' ? stat.labelTh : stat.labelEn}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-sm focus:border-amber-400 focus:outline-none"
                      />
                      {stat.inputType === 'percentage' && (
                        <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold pointer-events-none">
                          %
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Screenshot Proof Upload (Ctrl + V supported) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'แนบภาพสกรีนช็อตยืนยันสเตตัส (Proof of Stats) *' : 'Screenshot Proof *'}
                </h3>
              </div>
              <span className="text-[11px] text-amber-300/90 font-medium">
                {lang === 'th' ? '⚡ กด Ctrl + V วางภาพได้ทันที' : '⚡ Ctrl + V to paste screenshot'}
              </span>
            </div>

            {/* Kain7 Screenshot Guide Trigger with Rotating Neon Border */}
            <ScreenshotGuideTrigger
              onClick={() => setIsGuideOpen(true)}
              lang={lang}
            />

            {screenshotUrl ? (
              <div className="relative p-3 rounded-2xl bg-slate-850 border border-slate-700 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={screenshotUrl}
                    alt="Stat Screenshot"
                    className="size-16 rounded-xl object-cover border border-slate-600 cursor-pointer hover:opacity-80 transition"
                    onClick={() => onViewImageZoom?.(screenshotUrl, 'Stat Proof')}
                  />
                  <div>
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="size-3.5" />
                      {lang === 'th' ? 'แนบภาพหลักฐานเรียบร้อยแล้ว' : 'Screenshot attached'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {lang === 'th' ? 'คลิกที่รูปเพื่อเปิดดูภาพขยายใหญ่' : 'Click image to view full size'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScreenshotUrl('')}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition"
                >
                  {lang === 'th' ? 'เปลี่ยนรูป' : 'Remove'}
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-700 hover:border-amber-400/80 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-950/40 hover:bg-slate-850/40 cursor-pointer transition text-center group">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" />
                <div className="size-10 rounded-full bg-slate-800 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-300 flex items-center justify-center transition">
                  <Upload className="size-5" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  {lang === 'th' ? 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ภาพมาวาง' : 'Click to browse or drag image here'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {lang === 'th'
                    ? 'หรือกด Ctrl + V วางรูปจากหน้าจอเกมได้ทันที (รองรับ JPG, PNG)'
                    : 'Or press Ctrl + V to paste image directly from clipboard'}
                </div>
              </label>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </form>

        {/* Floating Bottom Real-time PL Bar */}
        <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {lang === 'th' ? 'ค่าพลังคำนวณสด (Calculated PL)' : 'Calculated PL'}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                  ⚡ {calculatedNewPL.toLocaleString()} PL
                </span>
                {plDiff !== 0 && (
                  <span
                    className={`text-xs font-bold font-mono ${
                      plDiff > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    ({plDiff > 0 ? `+${plDiff.toLocaleString()}` : plDiff.toLocaleString()} PL)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              {lang === 'th' ? 'ปิด' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || calculatedNewPL <= 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition"
            >
              <Zap className="size-4" />
              <span>
                {isSubmitting
                  ? lang === 'th'
                    ? 'กำลังส่ง...'
                    : 'Submitting...'
                  : lang === 'th'
                  ? 'ส่งคำขออัปเดตสเตตัส'
                  : 'Submit Stat Request'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Kain7 Screenshot Guide Modal */}
      <ScreenshotGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
        onViewImageZoom={onViewImageZoom}
      />
    </div>
  );
};
