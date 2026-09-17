import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  Swords,
  Shield,
  Crown,
  Flame,
  Star,
  Target,
  Calculator,
  Lock,
  Unlock,
  CheckCircle2,
  Layers,
  Palette,
  ArrowUpDown,
  Edit3,
  Check,
  X,
  ArrowLeft
} from 'lucide-react';
import { StatDefinition, FormulaSettings, FormulaPreset, StatCategory, StatInputType, ActiveTab } from '../types';
import {
  getFormulaSettings,
  saveFormulaSettings,
  FORMULA_PRESETS,
  DEFAULT_STAT_DEFINITIONS,
  applyPresetToStats,
  calculatePowerLevel,
  calculateTransferPowerLevel
} from '../services/powerFormulaService';
import { sounds } from '../utils/sound';

interface PowerFormulaViewProps {
  lang: 'th' | 'en';
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

const PRESET_NEON_COLORS = [
  { name: 'Electric Blue', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)' },
  { name: 'Neon Emerald', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.5)' },
  { name: 'Gold Amber', hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)' },
  { name: 'Cyber Purple', hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)' },
  { name: 'Crimson Rose', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.5)' },
  { name: 'Hot Pink', hex: '#ec4899', glow: 'rgba(236, 72, 153, 0.5)' },
  { name: 'Silver White', hex: '#e2e8f0', glow: 'rgba(226, 232, 240, 0.5)' },
  { name: 'Solar Cyan', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.5)' }
];

export const PowerFormulaView: React.FC<PowerFormulaViewProps> = ({
  lang,
  showToast,
  onNavigateTab
}) => {
  const [settings, setSettings] = useState<FormulaSettings>(getFormulaSettings());
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'add_new' | 'sandbox'>('stats');

  // New Stat Form State
  const [newLabelTh, setNewLabelTh] = useState('');
  const [newLabelEn, setNewLabelEn] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newCategory, setNewCategory] = useState<StatCategory>('custom');
  const [newInputType, setNewInputType] = useState<StatInputType>('number');
  const [newMultiplier, setNewMultiplier] = useState<number>(1);
  const [newNeonColor, setNewNeonColor] = useState<string>('#3b82f6');
  const [newIcon, setNewIcon] = useState<string>('Sparkles');

  // Sandbox Test Values
  const [sandboxStats, setSandboxStats] = useState<Record<string, number>>({});
  const [sandboxSpirits, setSandboxSpirits] = useState<Record<string, number>>({});

  // Formula Name editing state
  const [isEditingFormulaName, setIsEditingFormulaName] = useState(false);
  const [formulaNameInput, setFormulaNameInput] = useState('');

  // Stat renaming state
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [editLabelTh, setEditLabelTh] = useState('');
  const [editLabelEn, setEditLabelEn] = useState('');

  useEffect(() => {
    const current = getFormulaSettings();
    setSettings(current);
    setFormulaNameInput(
      current.name ||
        (lang === 'th' ? FORMULA_PRESETS[current.activePreset]?.nameTh : FORMULA_PRESETS[current.activePreset]?.nameEn) ||
        'Kain7 Standard'
    );
    setEditingStatId(null);
    setIsEditingFormulaName(false);

    // Pre-fill sandbox with reasonable test values
    const initialSandbox: Record<string, number> = {};
    const initialSpirits: Record<string, number> = {};
    current.stats.forEach((s) => {
      if (s.id === 'damage') initialSandbox[s.id] = 250;
      else if (s.id === 'accuracy') initialSandbox[s.id] = 280;
      else if (s.id === 'defense') initialSandbox[s.id] = 350;
      else if (s.id === 'damage_reduction') initialSandbox[s.id] = 45;
      else if (s.inputType === 'spirit_card') {
        initialSandbox[s.id] = 10;
        initialSpirits[s.id] = 3;
      } else {
        initialSandbox[s.id] = 20;
      }
    });
    setSandboxStats(initialSandbox);
    setSandboxSpirits(initialSpirits);
  }, [lang]);

  const handleSaveFormulaName = () => {
    const trimmed = formulaNameInput.trim();
    if (!trimmed) return;
    setSettings((prev) => ({
      ...prev,
      name: trimmed
    }));
    setIsEditingFormulaName(false);
    sounds.playClaim();
    if (showToast) {
      showToast(lang === 'th' ? `เปลี่ยนชื่อสูตรเป็น "${trimmed}" สำเร็จ` : `Formula renamed to "${trimmed}"`, 'success');
    }
  };

  const handleStartRenameStat = (stat: StatDefinition) => {
    setEditingStatId(stat.id);
    setEditLabelTh(stat.labelTh);
    setEditLabelEn(stat.labelEn);
    sounds.playClick();
  };

  const handleSaveStatRename = (statId: string) => {
    const trimmedTh = editLabelTh.trim();
    if (!trimmedTh) return;
    const trimmedEn = editLabelEn.trim() || trimmedTh;
    setSettings((prev) => ({
      ...prev,
      stats: prev.stats.map((s) =>
        s.id === statId
          ? {
              ...s,
              labelTh: trimmedTh,
              labelEn: trimmedEn
            }
          : s
      )
    }));
    setEditingStatId(null);
    sounds.playClaim();
    if (showToast) {
      showToast(lang === 'th' ? `แก้ไขชื่อสเตตัสเป็น "${trimmedTh}" สำเร็จ` : `Stat renamed to "${trimmedEn}"`, 'success');
    }
  };

  const handleCancelStatRename = () => {
    setEditingStatId(null);
  };

  const handleMultiplierChange = (id: string, val: number) => {
    setSettings((prev) => ({
      ...prev,
      activePreset: 'custom',
      stats: prev.stats.map((s) => (s.id === id ? { ...s, multiplier: isNaN(val) ? 0 : val } : s))
    }));
  };

  const handleToggleActive = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      activePreset: 'custom',
      stats: prev.stats.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    }));
  };

  const handleToggleTransfer = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      activePreset: 'custom',
      stats: prev.stats.map((s) => (s.id === id ? { ...s, includeInTransfer: !s.includeInTransfer } : s))
    }));
  };

  const handleNeonColorChange = (id: string, colorHex: string) => {
    setSettings((prev) => ({
      ...prev,
      stats: prev.stats.map((s) =>
        s.id === id && s.spiritConfig
          ? {
              ...s,
              spiritConfig: {
                ...s.spiritConfig,
                accentColor: colorHex
              }
            }
          : s
      )
    }));
  };

  const handleSelectPreset = (preset: FormulaPreset) => {
    sounds.playClick();
    const updatedStats = applyPresetToStats(preset, settings.stats);
    setSettings((prev) => ({
      ...prev,
      activePreset: preset,
      stats: updatedStats
    }));
    if (showToast) {
      showToast(
        lang === 'th' ? `ใช้งานสูตร: ${FORMULA_PRESETS[preset].nameTh}` : `Applied preset: ${FORMULA_PRESETS[preset].nameEn}`,
        'info'
      );
    }
  };

  const handleSave = () => {
    sounds.playSuccess();
    saveFormulaSettings(settings);
    if (showToast) {
      showToast(lang === 'th' ? 'บันทึกการตั้งค่าสูตร Power Formula สำเร็จ ⚡' : 'Formula settings saved successfully ⚡', 'success');
    }
  };

  const handleResetToDefault = () => {
    if (!window.confirm(lang === 'th' ? 'ต้องการคืนค่าสูตรเริ่มต้นทั้งหมด (Kain7 Standard) ใช่หรือไม่?' : 'Reset to default Kain7 formula?')) {
      return;
    }
    sounds.playClick();
    const resetSettings: FormulaSettings = {
      activePreset: 'standard',
      stats: DEFAULT_STAT_DEFINITIONS,
      freezeStatsUntil: null,
      updatedAt: Date.now()
    };
    setSettings(resetSettings);
    saveFormulaSettings(resetSettings);
    if (showToast) {
      showToast(lang === 'th' ? 'รีเซ็ตสูตรกลับเป็นค่ามาตรฐานเรียบร้อย' : 'Formula reset to default', 'info');
    }
  };

  const handleCreateStat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelTh.trim() || !newKey.trim()) {
      alert(lang === 'th' ? 'กรุณากรอกชื่อสเตตัสและคีย์' : 'Please enter stat name and key');
      return;
    }

    const cleanKey = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (settings.stats.some((s) => s.id === cleanKey)) {
      alert(lang === 'th' ? 'คีย์สเตตัสนี้มีอยู่ในระบบแล้ว' : 'Stat key already exists');
      return;
    }

    const createdStat: StatDefinition = {
      id: cleanKey,
      labelTh: newLabelTh.trim(),
      labelEn: newLabelEn.trim() || newLabelTh.trim(),
      category: newCategory,
      inputType: newInputType,
      multiplier: Number(newMultiplier) || 1,
      calcMethod: 'linear',
      isActive: true,
      includeInTransfer: true,
      isRequired: false,
      order: settings.stats.length + 1,
      spiritConfig:
        newInputType === 'spirit_card'
          ? {
              icon: newIcon,
              accentColor: newNeonColor,
              enhancementOptions: [0, 1, 2, 3],
              enhancementBonus: { 0: 0, 1: 5, 2: 10, 3: 20 }
            }
          : undefined
    };

    sounds.playClaim();
    setSettings((prev) => ({
      ...prev,
      activePreset: 'custom',
      stats: [...prev.stats, createdStat]
    }));

    // Reset Form
    setNewLabelTh('');
    setNewLabelEn('');
    setNewKey('');
    setNewMultiplier(1);
    setActiveSubTab('stats');

    if (showToast) {
      showToast(
        lang === 'th' ? `เพิ่มสเตตัสใหม่ "${createdStat.labelTh}" สำเร็จ!` : `New stat "${createdStat.labelEn}" created!`,
        'success'
      );
    }
  };

  const handleDeleteStat = (id: string) => {
    if (!window.confirm(lang === 'th' ? 'ต้องการลบสเตตัสนี้ใช่หรือไม่?' : 'Delete this stat?')) return;
    sounds.playClick();
    setSettings((prev) => ({
      ...prev,
      activePreset: 'custom',
      stats: prev.stats.filter((s) => s.id !== id)
    }));
  };

  const sandboxPL = calculatePowerLevel(sandboxStats, sandboxSpirits, settings, false);
  const sandboxTransferPL = calculateTransferPowerLevel(sandboxStats, sandboxSpirits, settings);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* ── TOP HEADER BAR ────────────────────────────────────── */}
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
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 transition mr-2 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>{lang === 'th' ? 'กลับแดชบอร์ด' : 'Dashboard'}</span>
              </button>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              ADMIN ENGINE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20 shrink-0">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {lang === 'th' ? 'สูตรคำนวณค่าพลัง (Power Formula)' : 'Power Formula Settings'}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {settings.activePreset.toUpperCase()}
                </span>
              </div>

              {/* Editable Formula Name Badge */}
              <div className="flex items-center gap-2 mt-1">
                {isEditingFormulaName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={formulaNameInput}
                      onChange={(e) => setFormulaNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveFormulaName();
                        if (e.key === 'Escape') setIsEditingFormulaName(false);
                      }}
                      placeholder={lang === 'th' ? 'พิมพ์ชื่อสูตร...' : 'Enter formula name...'}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-400 text-xs text-amber-300 font-bold focus:outline-none shadow-inner"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveFormulaName}
                      className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                      title={lang === 'th' ? 'บันทึกชื่อสูตร' : 'Save formula name'}
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingFormulaName(false)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer"
                      title={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setFormulaNameInput(
                        settings.name ||
                          (lang === 'th' ? FORMULA_PRESETS[settings.activePreset]?.nameTh : FORMULA_PRESETS[settings.activePreset]?.nameEn) ||
                          'Kain7 Standard'
                      );
                      setIsEditingFormulaName(true);
                    }}
                    className="inline-flex items-center gap-2 cursor-pointer text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full group transition"
                    title={lang === 'th' ? 'คลิกเพื่อเปลี่ยนชื่อสูตร' : 'Click to rename formula'}
                  >
                    <span className="font-semibold">
                      {settings.name ||
                        (lang === 'th' ? FORMULA_PRESETS[settings.activePreset]?.nameTh : FORMULA_PRESETS[settings.activePreset]?.nameEn) ||
                        'Kain7 Standard'}
                    </span>
                    <Edit3 className="size-3 text-amber-400/70 group-hover:text-amber-300 group-hover:scale-110 transition" />
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({lang === 'th' ? 'คลิกเปลี่ยนชื่อสูตร' : 'click to rename'})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/80 transition cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>{lang === 'th' ? 'คืนค่าเริ่มต้น' : 'Reset Defaults'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Save className="size-4" />
            <span>{lang === 'th' ? 'บันทึกการตั้งค่าสูตร' : 'Save Formula'}</span>
          </button>
        </div>
      </div>

      {/* ── PRESETS SELECTOR BAR ────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {lang === 'th' ? 'ชุดสูตรสำเร็จรูป (Preset Formulas)' : 'Formula Presets'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {(Object.keys(FORMULA_PRESETS) as FormulaPreset[]).map((presetKey) => {
            const preset = FORMULA_PRESETS[presetKey];
            const isSelected = settings.activePreset === presetKey;
            return (
              <button
                key={presetKey}
                type="button"
                onClick={() => handleSelectPreset(presetKey)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer relative ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/15'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 size-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                )}
                <div className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                  {lang === 'th' ? preset.nameTh : preset.nameEn}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                  {lang === 'th' ? preset.descTh : preset.descEn}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SUB-TAB NAVIGATION ───────────────────────────────────── */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
        <button
          type="button"
          onClick={() => setActiveSubTab('stats')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeSubTab === 'stats'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="size-4" />
          <span>{lang === 'th' ? `สเตตัสทั้งหมด (${settings.stats.length})` : `Attributes (${settings.stats.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('add_new')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeSubTab === 'add_new'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Plus className="size-4" />
          <span>{lang === 'th' ? '+ สร้างสเตตัสใหม่' : '+ Add Custom Stat'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sandbox')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
            activeSubTab === 'sandbox'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Calculator className="size-4" />
          <span>{lang === 'th' ? 'กระดานทดสอบคำนวณ (Sandbox)' : 'Sandbox Calculator'}</span>
        </button>
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden p-4 sm:p-6">
        {/* TAB 1: STATS LIST */}
        {activeSubTab === 'stats' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <div>{lang === 'th' ? 'สเตตัสและตัวคูณปัจจุบัน' : 'Current Attributes & Multipliers'}</div>
              <div className="text-[11px] text-slate-500">
                {lang === 'th' ? 'ปรับตัวคูณเพื่อเปลี่ยนค่าน้ำหนักในสูตร Kain7' : 'Adjust multipliers to tune formula weights'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {settings.stats.map((stat) => (
                <div
                  key={stat.id}
                  className={`p-3.5 rounded-xl border transition ${
                    stat.isActive
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/30 border-slate-800/40 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {editingStatId === stat.id ? (
                        <div className="space-y-1.5 mb-2">
                          <input
                            type="text"
                            value={editLabelTh}
                            onChange={(e) => setEditLabelTh(e.target.value)}
                            placeholder={lang === 'th' ? 'ชื่อภาษาไทย' : 'Thai Name'}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-amber-400 text-xs text-amber-300 font-bold focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editLabelEn}
                            onChange={(e) => setEditLabelEn(e.target.value)}
                            placeholder={lang === 'th' ? 'ชื่อภาษาอังกฤษ' : 'English Name'}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-amber-400 text-xs text-slate-300 focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveStatRename(stat.id)}
                              className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-bold"
                            >
                              {lang === 'th' ? 'บันทึก' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelStatRename}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                            >
                              {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-xs sm:text-sm">
                            {lang === 'th' ? stat.labelTh : stat.labelEn}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">({stat.id})</span>
                          <button
                            type="button"
                            onClick={() => handleStartRenameStat(stat)}
                            className="text-slate-500 hover:text-amber-400 p-0.5 rounded transition"
                            title={lang === 'th' ? 'เปลี่ยนชื่อสเตตัส' : 'Rename stat'}
                          >
                            <Edit3 className="size-3" />
                          </button>
                          {stat.category && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase">
                              {stat.category}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {lang === 'th' ? stat.labelEn : stat.labelTh}
                      </div>

                      {/* Neon Color Picker for Spirits */}
                      {stat.inputType === 'spirit_card' && stat.spiritConfig && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-slate-400">{lang === 'th' ? 'สีกรอบนีออน:' : 'Neon:'}</span>
                          <div className="flex items-center gap-1">
                            {PRESET_NEON_COLORS.map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => handleNeonColorChange(stat.id, c.hex)}
                                className={`size-4 rounded-full border transition cursor-pointer ${
                                  stat.spiritConfig?.accentColor === c.hex
                                    ? 'border-white scale-125 shadow-[0_0_8px_currentColor]'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: c.hex, color: c.hex }}
                                title={c.name}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Controls Right */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Multiplier Slider / Input */}
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                        <span className="text-[10px] text-slate-400">×</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={stat.multiplier}
                          onChange={(e) => handleMultiplierChange(stat.id, parseFloat(e.target.value))}
                          className="w-14 bg-transparent text-xs font-mono font-bold text-amber-300 text-right focus:outline-none"
                        />
                      </div>

                      {/* Toggle Active */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(stat.id)}
                        className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                          stat.isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                        title={stat.isActive ? (lang === 'th' ? 'เปิดใช้งาน' : 'Active') : (lang === 'th' ? 'ปิดใช้งาน' : 'Disabled')}
                      >
                        {stat.isActive ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                      </button>

                      {/* Delete Custom Stat */}
                      {stat.category === 'custom' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStat(stat.id)}
                          className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition cursor-pointer"
                          title={lang === 'th' ? 'ลบสเตตัสนี้' : 'Delete stat'}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ADD NEW STAT */}
        {activeSubTab === 'add_new' && (
          <form onSubmit={handleCreateStat} className="max-w-2xl mx-auto space-y-4">
            <div className="text-sm font-bold text-white border-b border-slate-800 pb-2">
              {lang === 'th' ? 'สร้างสเตตัสกำหนดเองใหม่ (Custom Stat Engine)' : 'Create New Custom Attribute'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'ชื่อภาษาไทย *' : 'Thai Label *'}
                </label>
                <input
                  type="text"
                  required
                  value={newLabelTh}
                  onChange={(e) => setNewLabelTh(e.target.value)}
                  placeholder={lang === 'th' ? 'เช่น พลังโจมตีบอส' : 'e.g. Boss Attack'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'ชื่อภาษาอังกฤษ' : 'English Label'}
                </label>
                <input
                  type="text"
                  value={newLabelEn}
                  onChange={(e) => setNewLabelEn(e.target.value)}
                  placeholder="e.g. Boss Attack"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'คีย์ระบุ (Key/ID) *' : 'Attribute Key *'}
                </label>
                <input
                  type="text"
                  required
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. boss_damage"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'หมวดหมู่' : 'Category'}
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as StatCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="attack">{lang === 'th' ? 'พลังโจมตี (Attack)' : 'Attack'}</option>
                  <option value="defense">{lang === 'th' ? 'พลังป้องกัน (Defense)' : 'Defense'}</option>
                  <option value="critical">{lang === 'th' ? 'คริติคอล (Critical)' : 'Critical'}</option>
                  <option value="spirits">{lang === 'th' ? 'ผลึกวิญญาณ (Spirits)' : 'Spirits'}</option>
                  <option value="custom">{lang === 'th' ? 'กำหนดเอง (Custom)' : 'Custom'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'ตัวคูณเริ่มต้น (Multiplier)' : 'Initial Multiplier'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newMultiplier}
                  onChange={(e) => setNewMultiplier(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/30 transition cursor-pointer"
              >
                {lang === 'th' ? '+ เพิ่มสเตตัสลงในระบบ' : '+ Add Stat to Formula'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: SANDBOX CALCULATOR */}
        {activeSubTab === 'sandbox' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                  {lang === 'th' ? 'ผลลัพธ์การคำนวณจากสูตรปัจจุบัน' : 'Computed Power Results'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {lang === 'th' ? 'ทดสอบกรอกตัวเลขสเตตัสเพื่อดูค่าพลังที่คำนวณได้แบบเรียลไทม์' : 'Simulate stats to test formula live'}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Standard PL</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                    ⚡ {sandboxPL.toLocaleString()}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="text-right">
                  <div className="text-[10px] text-cyan-400 uppercase font-bold">Transfer PL</div>
                  <div className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
                    🌐 {sandboxTransferPL.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Stat Inputs */}
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                {lang === 'th' ? 'ทดลองกรอกค่าสเตตัส' : 'Simulation Inputs'}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {settings.stats
                  .filter((s) => s.isActive)
                  .map((stat) => (
                    <div key={stat.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <label className="block text-[11px] text-slate-400 truncate font-semibold" title={stat.labelTh}>
                        {lang === 'th' ? stat.labelTh : stat.labelEn}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={sandboxStats[stat.id] ?? 0}
                        onChange={(e) =>
                          setSandboxStats({
                            ...sandboxStats,
                            [stat.id]: parseFloat(e.target.value) || 0
                          })
                        }
                        className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-400 text-center"
                      />
                      <div className="text-[10px] text-slate-500 text-center font-mono">
                        × {stat.multiplier} = {Math.round((sandboxStats[stat.id] || 0) * stat.multiplier).toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM STICKY BAR ─────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <button
          type="button"
          onClick={handleResetToDefault}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          <span>{lang === 'th' ? 'คืนค่าเริ่มต้นทั้งหมด (Kain7 Standard)' : 'Reset to Default (Kain7 Standard)'}</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white text-xs font-bold shadow-xl shadow-emerald-600/30 transition cursor-pointer"
        >
          <Save className="size-4" />
          <span>{lang === 'th' ? 'บันทึกการตั้งค่าสูตร' : 'Save Formula Settings'}</span>
        </button>
      </div>
    </div>
  );
};
