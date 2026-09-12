import React, { useState, useEffect } from 'react';
import {
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
  Image as ImageIcon,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Info
} from 'lucide-react';
import { User, FormulaSettings, OFFICIAL_CLASSES, ActiveTab, StatHistoryPoint } from '../types';
import { getFormulaSettings, calculatePowerLevel } from '../services/powerFormulaService';
import { compressImageFile } from '../utils/imageCompressor';
import { sounds } from '../utils/sound';
import { ScreenshotGuideModal, ScreenshotGuideTrigger } from './ScreenshotGuideModal';
import { GrowthTimelineChart } from './GrowthTimelineChart';

interface MyStatsViewProps {
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
  onNavigateTab?: (tab: ActiveTab) => void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onViewImageZoom?: (url: string, title?: string) => void;
  onSaveHistory?: (newHistory: StatHistoryPoint[]) => Promise<void>;
}

export const MyStatsView: React.FC<MyStatsViewProps> = ({
  currentUser,
  lang,
  onRequestStatUpdate,
  onCancelPendingRequest,
  onNavigateTab,
  showToast,
  onViewImageZoom,
  onSaveHistory
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

  // Synchronize stats and profile from currentUser
  useEffect(() => {
    if (currentUser) {
      const config = getFormulaSettings();
      setFormulaSettings(config);

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
  }, [currentUser]);

  // Global Ctrl + V paste listener on the page
  useEffect(() => {
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
  }, []);

  if (!currentUser) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="size-12 mx-auto text-amber-400" />
        <h2 className="text-xl font-bold text-white">
          {lang === 'th' ? 'กรุณาเข้าสู่ระบบก่อนจัดการสเตตัส' : 'Please log in to view your stats'}
        </h2>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('dashboard')}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
          >
            {lang === 'th' ? 'กลับหน้าหลัก' : 'Back to Dashboard'}
          </button>
        )}
      </div>
    );
  }

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

  const hasPending = Boolean(currentUser.pendingPowerLevel && currentUser.pendingPowerLevel > 0);
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
      default:
        return <Zap className="size-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-24">
      {/* Top Header & Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onNavigateTab('dashboard');
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 transition mr-2"
              >
                <ArrowLeft className="size-3.5" />
                <span>{lang === 'th' ? 'กลับแดชบอร์ด' : 'Dashboard'}</span>
              </button>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {formulaSettings.name || 'Kain7 Power Formula'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22] flex items-center gap-3">
            <span>{lang === 'th' ? 'สเตตัสและความก้าวหน้าของฉัน' : 'My Stats & Progression'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {lang === 'th'
              ? 'กรอกข้อมูลตัวละคร (Multi-class), เลเวล, ผลึกวิญญาณ และสเตตัสเพื่อคำนวณค่าพลังที่แท้จริงของคุณ'
              : 'Configure your multi-classes, character level, spirit progression, and stats to calculate verified Power Level.'}
          </p>
        </div>

        {/* Current Verified Power Badge */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-amber-500/40 shadow-xl flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">
                {lang === 'th' ? 'ค่าพลังปัจจุบัน (Verified)' : 'Current Verified PL'}
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                ⚡ {currentVerifiedPL.toLocaleString()} PL
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Rejection Alert Banner */}
      {isRejected && (
        <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/60 text-xs flex items-start gap-3.5 shadow-xl animate-fade-in">
          <AlertCircle className="size-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm text-rose-300">
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

      {/* Pending Request Banner */}
      {hasPending && (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/60 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xl">
          <div className="flex items-center gap-3">
            <Clock className="size-5 text-amber-400 animate-spin shrink-0" />
            <div>
              <div className="font-bold text-amber-300">
                {lang === 'th'
                  ? `⏳ มีคำขออัปเดตสเตตัสใหม่ (${currentUser.pendingPowerLevel?.toLocaleString()} PL) รอแอดมินตรวจสอบ`
                  : `⏳ Stat update request (${currentUser.pendingPowerLevel?.toLocaleString()} PL) pending admin approval`}
              </div>
              <div className="text-[11px] text-amber-300/80">
                {lang === 'th'
                  ? 'ส่งเมื่อ ' + (currentUser.pendingPowerLevelRequestedAt ? new Date(currentUser.pendingPowerLevelRequestedAt).toLocaleString('th-TH') : 'ไม่นานมานี้')
                  : 'Submitted ' + (currentUser.pendingPowerLevelRequestedAt ? new Date(currentUser.pendingPowerLevelRequestedAt).toLocaleString() : 'recently')}
              </div>
            </div>
          </div>
          {onCancelPendingRequest && (
            <button
              type="button"
              onClick={handleCancelPending}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 self-start sm:self-auto"
            >
              {lang === 'th' ? 'ยกเลิกคำขอนี้' : 'Cancel Request'}
            </button>
          )}
        </div>
      )}

      {/* GROWTH & PROGRESSION TIMELINE CHART */}
      <GrowthTimelineChart
        user={currentUser}
        lang={lang}
        onSaveHistory={onSaveHistory}
        showToast={showToast}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: CHARACTER STATS PROFILE CARD (Exact 1:1 match with Kain7) */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-750 p-5 sm:p-6 space-y-5 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-300 shadow-inner shrink-0">
                <svg className="size-5 text-slate-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3Zm2.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 5.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm.75 3.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5ZM10 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 10 8Zm-2.378 3c.346 0 .583-.343.395-.633A2.998 2.998 0 0 0 5.5 9a2.998 2.998 0 0 0-2.517 1.367c-.188.29.05.633.395.633h4.244Z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Character Stats
                </h3>
                <p className="text-xs text-slate-400">
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

          {/* Body: Multi-Class List + 3 Stat Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Class (multi) Scrollable Box */}
            <div className="lg:col-span-5 space-y-2">
              <label className="block text-xs font-semibold text-white">
                Class <span className="font-normal text-slate-400">(multi)</span>
              </label>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-750 max-h-56 overflow-y-auto space-y-2 custom-scrollbar">
                {OFFICIAL_CLASSES.map((cls) => {
                  const isChecked = selectedClasses.includes(cls.nameEn);
                  return (
                    <div
                      key={cls.id}
                      onClick={() => handleToggleClass(cls.nameEn)}
                      className={`cursor-pointer flex items-center gap-3 px-3 py-2 rounded-xl border transition-all select-none ${
                        isChecked
                          ? 'border-purple-500 bg-purple-950/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-[1.01]'
                          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
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
                      <span className="text-xs font-semibold truncate">
                        {cls.nameEn}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Level, Legend Classes, Legend Agathions */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Level */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-750 flex flex-col justify-between space-y-3">
                <label className="text-xs font-semibold text-white">
                  Level
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={charLevel === 0 ? '' : charLevel}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setCharLevel(isNaN(v) ? 0 : Math.max(0, Math.min(99, v)));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xl text-center focus:border-purple-500 focus:outline-none transition shadow-inner"
                />
                <span className="text-[10px] text-slate-500 text-center">Lv. 1 - 99</span>
              </div>

              {/* Legend Classes */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-750 flex flex-col justify-between space-y-3">
                <label className="text-xs font-semibold text-white">
                  Legend Classes
                </label>
                <input
                  type="number"
                  min="0"
                  value={charLegendClasses === 0 ? '' : charLegendClasses}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setCharLegendClasses(isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xl text-center focus:border-purple-500 focus:outline-none transition shadow-inner"
                />
                <span className="text-[10px] text-slate-500 text-center">Class ตำนาน</span>
              </div>

              {/* Legend Agathions */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-750 flex flex-col justify-between space-y-3">
                <label className="text-xs font-semibold text-white">
                  Legend Agathions
                </label>
                <input
                  type="number"
                  min="0"
                  value={charLegendAgathions === 0 ? '' : charLegendAgathions}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setCharLegendAgathions(isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xl text-center focus:border-purple-500 focus:outline-none transition shadow-inner"
                />
                <span className="text-[10px] text-slate-500 text-center">อากาธีออนตำนาน</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: COMBAT STATS */}
        {combatStats.length > 0 && (
          <div className="rounded-2xl bg-slate-900/90 border border-slate-750 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="size-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Swords className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'สเตตัสการโจมตี (Combat Stats)' : 'Combat Stats'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'th' ? 'ค่าพลังโจมตีและความแม่นยำพื้นฐาน' : 'Core damage and accuracy attributes'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {combatStats.map((stat) => (
                <div key={stat.id} className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-750 space-y-1.5 hover:border-slate-650 transition">
                  <label className="block text-xs font-semibold text-slate-300 truncate" title={stat.labelTh}>
                    {lang === 'th' ? stat.labelTh : stat.labelEn}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                      onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-base focus:border-amber-400 focus:outline-none"
                    />
                    {stat.inputType === 'percentage' && (
                      <span className="absolute right-3 top-3 text-xs text-slate-500 font-bold pointer-events-none">
                        %
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    × {stat.multiplier} PL
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: DEFENSE & RESISTANCE STATS */}
        {defenseStats.length > 0 && (
          <div className="rounded-2xl bg-slate-900/90 border border-slate-750 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="size-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Shield className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'สเตตัสการป้องกันและลดทอน (Defense & Resistance)' : 'Defense & Resistance'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'th' ? 'พลังป้องกัน ลดทอนดาเมจ ต้านทานสกิล และเปอร์เซ็นต์ลดความเสียหาย' : 'Defenses, reductions, and resistances'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {defenseStats.map((stat) => (
                <div key={stat.id} className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-750 space-y-1.5 hover:border-slate-650 transition">
                  <label className="block text-xs font-semibold text-slate-300 truncate" title={stat.labelTh}>
                    {lang === 'th' ? stat.labelTh : stat.labelEn}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                      onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-base focus:border-amber-400 focus:outline-none"
                    />
                    {stat.inputType === 'percentage' && (
                      <span className="absolute right-3 top-3 text-xs text-slate-500 font-bold pointer-events-none">
                        %
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    × {stat.multiplier} PL
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: INTERACTIVE SPIRITS PROGRESSION CARDS */}
        {spiritStats.length > 0 && (
          <div className="rounded-2xl bg-slate-900/90 border border-slate-750 p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <Flame className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {lang === 'th' ? 'ผลึกวิญญาณ (Spirits Progression)' : 'Spirits Progression'}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      5 SPIRITS
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'th' ? 'ระบุระดับเลเวล (Level) และคลิกเลือกขั้นบวก 0, +1, +2, +3' : 'Enter spirit level and select enhancement tier'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {spiritStats.map((stat) => {
                const cfg = stat.spiritConfig;
                const neonColor = cfg?.accentColor || '#3b82f6';
                const currentTier = spiritEnhancements[stat.id] ?? 0;

                return (
                  <div
                    key={stat.id}
                    className="p-4 rounded-2xl bg-slate-850/90 border border-slate-750 transition hover:border-slate-650 space-y-3.5 shadow-md"
                  >
                    {/* Spirit Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-7 rounded-lg flex items-center justify-center text-xs shadow-sm"
                          style={{ backgroundColor: `${neonColor}22`, color: neonColor }}
                        >
                          {renderIcon(cfg?.icon)}
                        </span>
                        <span className="font-bold text-sm text-white">
                          {lang === 'th' ? stat.labelTh.replace(/ผลึกวิญญาณ:\s*/, '') : stat.labelEn.replace(/Spirit:\s*/, '')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ×{stat.multiplier} PL
                      </span>
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
                          onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center font-bold text-base text-white focus:outline-none focus:border-amber-400"
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

        {/* SECTION 5: SPECIAL & PVP STATS */}
        {otherStats.length > 0 && (
          <div className="rounded-2xl bg-slate-900/90 border border-slate-750 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="size-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Star className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'สเตตัสพิเศษและสงคราม (Special & PvP Stats)' : 'Special & PvP Stats'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'th' ? 'ต้านทาน/แม่นยำสตัน โอกาสทริปเปิ้ล และดวงดาว' : 'Stun resist/acc, triple chance, aster'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {otherStats.map((stat) => (
                <div key={stat.id} className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-750 space-y-1.5 hover:border-slate-650 transition">
                  <label className="block text-xs font-semibold text-slate-300 truncate" title={stat.labelTh}>
                    {lang === 'th' ? stat.labelTh : stat.labelEn}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                      onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-base focus:border-amber-400 focus:outline-none"
                    />
                    {stat.inputType === 'percentage' && (
                      <span className="absolute right-3 top-3 text-xs text-slate-500 font-bold pointer-events-none">
                        %
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    × {stat.multiplier} PL
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 6: SCREENSHOT PROOF UPLOAD (Spacious Full-Width Container) */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-750 p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ImageIcon className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'th' ? 'แนบภาพสกรีนช็อตยืนยันสเตตัส (Proof of Stats) *' : 'Proof of Stats *'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'th' ? 'ภาพถ่ายหน้าต่างสเตตัสจากในเกม เพื่อให้ Admin ตรวจสอบความถูกต้อง' : 'Upload an in-game screenshot showing your character stats'}
                </p>
              </div>
            </div>
            <span className="text-xs text-amber-300/90 font-semibold flex items-center gap-1.5 self-start sm:self-auto bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25">
              <span>⚡</span>
              <span>{lang === 'th' ? 'กด Ctrl + V วางภาพได้ทันที' : 'Ctrl + V to paste screenshot'}</span>
            </span>
          </div>

          {/* Screenshot Guide Trigger */}
          <ScreenshotGuideTrigger
            onClick={() => setIsGuideOpen(true)}
            lang={lang}
          />

          {screenshotUrl ? (
            <div className="relative p-4 rounded-2xl bg-slate-950 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div
                  className="relative size-24 sm:size-28 rounded-xl overflow-hidden border-2 border-emerald-500/60 cursor-pointer group shrink-0"
                  onClick={() => onViewImageZoom?.(screenshotUrl, 'Stat Proof')}
                >
                  <img
                    src={screenshotUrl}
                    alt="Stat Screenshot"
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                    🔍 {lang === 'th' ? 'ดูรูปเต็ม' : 'Zoom'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="size-4" />
                    <span>{lang === 'th' ? 'แนบภาพหลักฐานเรียบร้อยแล้ว' : 'Screenshot attached'}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {lang === 'th' ? 'คลิกที่ภาพเพื่อขยายดูภาพสกรีนช็อตเต็มจอ' : 'Click thumbnail to inspect in full resolution'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setScreenshotUrl('')}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition self-end sm:self-center"
              >
                {lang === 'th' ? 'เปลี่ยนภาพหลักฐาน' : 'Remove Image'}
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-700 hover:border-amber-400/80 rounded-2xl p-8 flex flex-col items-center justify-center gap-2.5 bg-slate-950/40 hover:bg-slate-850/40 cursor-pointer transition text-center group">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" />
              <div className="size-12 rounded-full bg-slate-800 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-300 flex items-center justify-center transition">
                <Upload className="size-6" />
              </div>
              <div className="text-sm font-bold text-slate-200">
                {lang === 'th' ? 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ภาพมาวาง' : 'Click to browse or drag image here'}
              </div>
              <div className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'หรือกด Ctrl + V วางรูปจากหน้าจอเกมได้ทันที (รองรับ JPG, PNG)'
                  : 'Or press Ctrl + V to paste image directly from clipboard'}
              </div>
            </label>
          )}
        </div>

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-3 shadow-lg">
            <AlertCircle className="size-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-3 shadow-lg">
            <CheckCircle className="size-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STICKY BOTTOM REAL-TIME CALCULATION & SUBMIT BAR */}
        <div className="sticky bottom-4 z-20 p-4 sm:p-5 rounded-2xl bg-slate-950/95 border border-slate-750 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {lang === 'th' ? 'ค่าพลังคำนวณสด (Calculated PL)' : 'Calculated PL'}
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                  ⚡ {calculatedNewPL.toLocaleString()} PL
                </span>
                {plDiff !== 0 && (
                  <span
                    className={`text-xs sm:text-sm font-bold font-mono px-2 py-0.5 rounded-full ${
                      plDiff > 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {plDiff > 0 ? `+${plDiff.toLocaleString()}` : plDiff.toLocaleString()} PL
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onNavigateTab('dashboard');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || calculatedNewPL <= 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
            >
              <Zap className="size-4 fill-slate-950" />
              <span>
                {isSubmitting
                  ? lang === 'th'
                    ? 'กำลังส่งคำขอ...'
                    : 'Submitting...'
                  : lang === 'th'
                  ? 'ส่งคำขออัปเดตสเตตัส'
                  : 'Submit Stat Request'}
              </span>
            </button>
          </div>
        </div>
      </form>

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
