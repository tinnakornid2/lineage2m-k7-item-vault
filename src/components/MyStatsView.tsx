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
  ArrowLeft,
  X,
  UserCheck
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
  
  // Right Column Stat Tab Switcher: 'combat' | 'defense' | 'special'
  const [activeStatCategory, setActiveStatCategory] = useState<'combat' | 'defense' | 'special'>('combat');

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
          ? 'กรุณาแนบภาพสกรีนช็อตสเตตัสในเกม (วางรูปด้วย Ctrl+V หรืออัปโหลด) เพื่อยืนยัน'
          : 'Please attach a screenshot of your stats in game for verification'
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
        return <Sparkles className="size-3.5" />;
      case 'Swords':
        return <Swords className="size-3.5" />;
      case 'Shield':
        return <Shield className="size-3.5" />;
      case 'Crown':
        return <Crown className="size-3.5" />;
      case 'Zap':
      default:
        return <Zap className="size-3.5" />;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-16">
      {/* 1. COMPACT TOP HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onNavigateTab('dashboard');
              }}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title={lang === 'th' ? 'กลับแดชบอร์ด' : 'Dashboard'}
            >
              <ArrowLeft className="size-4" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
                {lang === 'th' ? 'สเตตัสและความก้าวหน้าของฉัน' : 'My Stats & Progression'}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                {formulaSettings.name || 'Kain7 Formula'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {currentUser.inGameName} • {currentUser.clan} • {currentUser.characterClass || 'No Class'}
            </p>
          </div>
        </div>

        {/* Current Verified Power Badge (Compact) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 shadow-md">
          <div className="size-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Zap className="size-4" />
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase font-bold text-slate-400">
              {lang === 'th' ? 'ค่าพลังยืนยันแล้ว' : 'Verified PL'}
            </div>
            <div className="text-sm sm:text-base font-black text-amber-400 font-mono leading-none">
              ⚡ {currentVerifiedPL.toLocaleString()} PL
            </div>
          </div>
        </div>
      </div>

      {/* Admin Rejection Alert Banner (Compact) */}
      {isRejected && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs flex items-center justify-between gap-3 text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4 text-rose-400 shrink-0" />
            <span>
              <strong className="text-rose-300">{lang === 'th' ? 'คำขอไม่ผ่าน: ' : 'Rejected: '}</strong>
              "{currentUser.statRejectionReason}"
            </span>
          </div>
          <span className="text-[10px] text-rose-400 shrink-0">
            {lang === 'th' ? 'กรุณาแก้ไขและส่งคำขอใหม่' : 'Please adjust & resubmit'}
          </span>
        </div>
      )}

      {/* Pending Request Banner (Compact) */}
      {hasPending && (
        <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/50 text-xs flex items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 text-amber-400 animate-spin shrink-0" />
            <span>
              {lang === 'th'
                ? `มีคำขออัปเดต (${currentUser.pendingPowerLevel?.toLocaleString()} PL) รอแอดมินตรวจ`
                : `Update request (${currentUser.pendingPowerLevel?.toLocaleString()} PL) pending`}
            </span>
          </div>
          {onCancelPendingRequest && (
            <button
              type="button"
              onClick={handleCancelPending}
              disabled={isSubmitting}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 shrink-0"
            >
              {lang === 'th' ? 'ยกเลิกคำขอ' : 'Cancel'}
            </button>
          )}
        </div>
      )}

      {/* 2. MAIN BALANCED 2-COLUMN DASHBOARD (Single-Screen Friendly Layout) */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* ══════════════════════════════════════════════════════════
              LEFT COLUMN (7 COLS): TIMELINE GRAPH + PROFILE & SPIRITS
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-4">
            {/* A. GROWTH TIMELINE CHART (Compact Vector Edition) */}
            <GrowthTimelineChart
              user={currentUser}
              lang={lang}
              onSaveHistory={onSaveHistory}
              showToast={showToast}
            />

            {/* B. CHARACTER PROFILE & MULTI-CLASS (Compact Bar) */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-purple-400" />
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    {lang === 'th' ? 'โปรไฟล์ตัวละคร & อาชีพ (Multi-Class)' : 'Character Profile & Multi-Class'}
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400">
                  {selectedClasses.length} {lang === 'th' ? 'อาชีพที่เลือก' : 'classes'}
                </span>
              </div>

              {/* Multi-Class Chips Picker */}
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_CLASSES.map((cls) => {
                  const isChecked = selectedClasses.includes(cls.nameEn);
                  return (
                    <button
                      type="button"
                      key={cls.id}
                      onClick={() => handleToggleClass(cls.nameEn)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border select-none ${
                        isChecked
                          ? 'border-purple-500 bg-purple-950/50 text-white shadow-sm shadow-purple-500/30'
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <img
                        src={cls.icon}
                        alt={cls.nameEn}
                        className="size-3.5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span>{cls.nameEn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Level, Legend Classes, Legend Agathions (Compact Inline Strip) */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {/* Level */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase truncate">
                      {lang === 'th' ? 'เลเวล' : 'Level'}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate">Lv. 1 - 99</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={charLevel === 0 ? '' : charLevel}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setCharLevel(isNaN(v) ? 0 : Math.max(0, Math.min(99, v)));
                    }}
                    placeholder="75"
                    className="w-14 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm text-center focus:border-purple-500 outline-none"
                  />
                </div>

                {/* Legend Classes */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase truncate">
                      {lang === 'th' ? 'คลาสตำนาน' : 'Legend Class'}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate">Count</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={charLegendClasses === 0 ? '' : charLegendClasses}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setCharLegendClasses(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                    placeholder="0"
                    className="w-14 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm text-center focus:border-purple-500 outline-none"
                  />
                </div>

                {/* Legend Agathions */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase truncate">
                      {lang === 'th' ? 'อากาธีออน' : 'Agathion'}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate">Legend</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={charLegendAgathions === 0 ? '' : charLegendAgathions}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setCharLegendAgathions(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                    placeholder="0"
                    className="w-14 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm text-center focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* C. SPIRITS PROGRESSION (Compact 5-Spirits Grid) */}
            {spiritStats.length > 0 && (
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="size-4 text-purple-400" />
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                      {lang === 'th' ? 'ผลึกวิญญาณ (Spirits Progression)' : 'Spirits Progression'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    5 SPIRITS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {spiritStats.map((stat) => {
                    const cfg = stat.spiritConfig;
                    const neonColor = cfg?.accentColor || '#3b82f6';
                    const currentTier = spiritEnhancements[stat.id] ?? 0;

                    return (
                      <div
                        key={stat.id}
                        className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-6 rounded-md flex items-center justify-center text-xs shrink-0"
                            style={{ backgroundColor: `${neonColor}20`, color: neonColor }}
                          >
                            {renderIcon(cfg?.icon)}
                          </span>
                          <div className="truncate">
                            <div className="font-bold text-xs text-white truncate">
                              {lang === 'th' ? stat.labelTh.replace(/ผลึกวิญญาณ:\s*/, '') : stat.labelEn.replace(/Spirit:\s*/, '')}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono">
                              ×{stat.multiplier} PL
                            </div>
                          </div>
                        </div>

                        {/* Level input + Enhancement Tiles */}
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                            onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                            placeholder="Lv"
                            className="w-11 px-1.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-center font-bold text-xs text-white outline-none focus:border-amber-400"
                            title="Spirit Level"
                          />

                          <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-md border border-slate-800">
                            {[0, 1, 2, 3].map((tier) => {
                              const isSelected = currentTier === tier;
                              return (
                                <button
                                  key={tier}
                                  type="button"
                                  onClick={() => handleSpiritEnhancementSelect(stat.id, tier)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition select-none ${
                                    isSelected
                                      ? 'shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                  style={
                                    isSelected
                                      ? {
                                          borderColor: neonColor,
                                          color: neonColor,
                                          backgroundColor: `${neonColor}25`
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
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════
              RIGHT COLUMN (5 COLS): STAT INPUTS + VERIFICATION & SUBMIT
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* D. STAT ATTRIBUTES CENTER (Tabbed to avoid endless scrolling) */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3.5 shadow-lg">
              {/* Category Tab Switcher */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setActiveStatCategory('combat');
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition text-[11px] font-bold ${
                      activeStatCategory === 'combat'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Swords className="size-3" />
                    <span>{lang === 'th' ? 'โจมตี' : 'Combat'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setActiveStatCategory('defense');
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition text-[11px] font-bold ${
                      activeStatCategory === 'defense'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Shield className="size-3" />
                    <span>{lang === 'th' ? 'ป้องกัน' : 'Defense'}</span>
                  </button>

                  {otherStats.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setActiveStatCategory('special');
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition text-[11px] font-bold ${
                        activeStatCategory === 'special'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Star className="size-3" />
                      <span>{lang === 'th' ? 'พิเศษ' : 'Special'}</span>
                    </button>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 font-mono">
                  {activeStatCategory === 'combat'
                    ? `${combatStats.length} ค่า`
                    : activeStatCategory === 'defense'
                    ? `${defenseStats.length} ค่า`
                    : `${otherStats.length} ค่า`}
                </span>
              </div>

              {/* Active Category Inputs (Clean 2-Column Compact Grid) */}
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {(activeStatCategory === 'combat'
                  ? combatStats
                  : activeStatCategory === 'defense'
                  ? defenseStats
                  : otherStats
                ).map((stat) => (
                  <div
                    key={stat.id}
                    className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 space-y-1 transition"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="font-semibold text-slate-300 truncate" title={stat.labelTh}>
                        {lang === 'th' ? stat.labelTh : stat.labelEn}
                      </label>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">
                        ×{stat.multiplier}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                        onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-750 text-amber-300 font-bold font-mono text-sm focus:border-amber-400 outline-none"
                      />
                      {stat.inputType === 'percentage' && (
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 font-bold pointer-events-none">
                          %
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* E. VERIFICATION SCREENSHOT & LIVE CALCULATED PL SUBMIT HUB */}
            <div className="rounded-2xl bg-slate-900/90 border border-amber-500/30 p-4 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-emerald-400" />
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    {lang === 'th' ? 'แนบภาพสกรีนช็อต & คำนวณค่าพลัง' : 'Proof & Submit Hub'}
                  </h3>
                </div>
                <ScreenshotGuideTrigger onClick={() => setIsGuideOpen(true)} lang={lang} />
              </div>

              {/* Compact Screenshot Area */}
              {screenshotUrl ? (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="size-12 rounded-lg overflow-hidden border border-emerald-500/60 cursor-pointer shrink-0"
                      onClick={() => onViewImageZoom?.(screenshotUrl, 'Stat Proof')}
                    >
                      <img src={screenshotUrl} alt="Proof" className="w-full h-full object-cover" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs text-emerald-400 flex items-center gap-1 truncate">
                        <CheckCircle className="size-3.5 shrink-0" />
                        <span>{lang === 'th' ? 'แนบภาพสำเร็จแล้ว' : 'Proof Attached'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {lang === 'th' ? 'คลิกเพื่อดูภาพขยาย' : 'Click to inspect'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScreenshotUrl('')}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold border border-rose-500/30 transition shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="border border-dashed border-slate-700 hover:border-amber-400/80 rounded-xl p-3 flex items-center justify-between gap-3 bg-slate-950/60 hover:bg-slate-950 cursor-pointer transition">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" />
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0">
                      <Upload className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {lang === 'th' ? 'เลือกไฟล์ หรือกด Ctrl + V' : 'Browse file or Ctrl + V'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {lang === 'th' ? 'วางภาพถ่ายจากหน้าจอเกม' : 'Paste screenshot from game'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold shrink-0">
                    Ctrl + V
                  </span>
                </label>
              )}

              {/* Real-time Calculated PL Summary Strip */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    {lang === 'th' ? 'ค่าพลังคำนวณสด (Calculated PL)' : 'Calculated Power'}
                  </div>
                  <div className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                    ⚡ {calculatedNewPL.toLocaleString()} PL
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-[10px] text-slate-400">{lang === 'th' ? 'ส่วนต่าง' : 'Delta'}</div>
                  <div
                    className={`text-xs font-bold ${
                      plDiff > 0 ? 'text-emerald-400' : plDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {plDiff > 0 ? `+${plDiff.toLocaleString()}` : plDiff.toLocaleString()} PL
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Big Action Submit CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting || calculatedNewPL <= 0 || !screenshotUrl}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/25 transition active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw className="size-4 animate-spin" />
                    <span>{lang === 'th' ? 'กำลังส่งข้อมูล...' : 'Submitting...'}</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4 fill-slate-950" />
                    <span>{lang === 'th' ? 'ส่งคำขออัปเดตสเตตัส' : 'Submit Stat Update Request'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Screenshot Guide Modal */}
      <ScreenshotGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
      />
    </div>
  );
};
