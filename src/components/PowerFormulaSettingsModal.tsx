import React, { useState, useEffect } from 'react';
import {
  X,
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
  Check
} from 'lucide-react';
import { StatDefinition, FormulaSettings, FormulaPreset, StatCategory, StatInputType } from '../types';
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

interface PowerFormulaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'th' | 'en';
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
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

export const PowerFormulaSettingsModal: React.FC<PowerFormulaSettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  showToast
}) => {
  const [settings, setSettings] = useState<FormulaSettings>(getFormulaSettings());
  const [activeTab, setActiveTab] = useState<'stats' | 'add_new' | 'sandbox'>('stats');

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
    if (isOpen) {
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
    }
  }, [isOpen, lang]);

  if (!isOpen) return null;

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
    onClose();
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
    setActiveTab('stats');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {lang === 'th' ? 'ตั้งค่าสูตรคำนวณค่าพลัง' : 'Power Formula Settings'}
                </h2>
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

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'stats'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="size-3.5" />
              {lang === 'th' ? `สเตตัสทั้งหมด (${settings.stats.length})` : `Attributes (${settings.stats.length})`}
            </button>

            <button
              onClick={() => setActiveTab('add_new')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'add_new'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Plus className="size-3.5" />
              {lang === 'th' ? '+ สร้างสเตตัสใหม่' : '+ Add Custom Stat'}
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'sandbox'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Calculator className="size-3.5" />
              {lang === 'th' ? 'ทดสอบสูตร (Sandbox)' : 'Formula Sandbox'}
            </button>
          </div>

          {/* Formula Presets Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 hidden sm:inline">{lang === 'th' ? 'เลือกสูตรสำเร็จรูป:' : 'Presets:'}</span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
              {(['standard', 'pvp_war', 'pve_boss'] as FormulaPreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleSelectPreset(p)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                    settings.activePreset === p ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60' : 'text-slate-400 hover:text-white'
                  }`}
                  title={lang === 'th' ? FORMULA_PRESETS[p].descTh : FORMULA_PRESETS[p].descEn}
                >
                  {p === 'standard' ? '🛡️ Standard' : p === 'pvp_war' ? '⚔️ PvP War' : '🐉 PvE Boss'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {/* Formula Quick Info */}
              <div className="p-3 rounded-xl bg-slate-850/80 border border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-400" />
                  <span className="text-slate-300">
                    {lang === 'th'
                      ? 'คำนวณ Power Level (PL) แบบ Real-time ตามค่าน้ำหนักสเตตัส'
                      : 'Calculates Power Level (PL) in real-time using custom weights'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <span>
                    {lang === 'th' ? 'เปิดใช้งานในสูตร:' : 'Active:'}{' '}
                    <strong className="text-emerald-400">{settings.stats.filter((s) => s.isActive).length}</strong>
                  </span>
                  <span>
                    {lang === 'th' ? 'รวมใน Transfer PL:' : 'Transfer PL:'}{' '}
                    <strong className="text-cyan-400">{settings.stats.filter((s) => s.includeInTransfer).length}</strong>
                  </span>
                </div>
              </div>

              {/* Attributes Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-850 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3 w-12 text-center">#</th>
                        <th className="py-3 px-4">{lang === 'th' ? 'ชื่อสเตตัส (Attribute)' : 'Attribute Name'}</th>
                        <th className="py-3 px-3">{lang === 'th' ? 'หมวดหมู่' : 'Category'}</th>
                        <th className="py-3 px-3">{lang === 'th' ? 'ชนิดช่องกรอก' : 'Type'}</th>
                        <th className="py-3 px-3 text-center">{lang === 'th' ? 'ตัวคูณ (Multiplier)' : 'Multiplier'}</th>
                        <th className="py-3 px-3 text-center">{lang === 'th' ? 'สีไฟนีออน' : 'Neon Glow'}</th>
                        <th className="py-3 px-3 text-center">{lang === 'th' ? 'เปิดใช้' : 'Active'}</th>
                        <th className="py-3 px-3 text-center">{lang === 'th' ? 'ย้ายเซิร์ฟ' : 'Transfer'}</th>
                        <th className="py-3 px-3 text-center w-12">{lang === 'th' ? 'ลบ' : 'Del'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {settings.stats.map((stat, idx) => (
                        <tr
                          key={stat.id}
                          className={`hover:bg-slate-800/40 transition ${!stat.isActive ? 'opacity-50 bg-slate-950/30' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-200">
                            {editingStatId === stat.id ? (
                              <div className="space-y-1.5 py-1 min-w-[200px]">
                                <div>
                                  <label className="text-[10px] text-amber-400 block font-mono">ชื่อภาษาไทย (TH):</label>
                                  <input
                                    type="text"
                                    value={editLabelTh}
                                    onChange={(e) => setEditLabelTh(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveStatRename(stat.id);
                                      if (e.key === 'Escape') handleCancelStatRename();
                                    }}
                                    className="w-full px-2 py-1 rounded bg-slate-950 border border-amber-500 text-xs text-amber-200 focus:outline-none"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-400 block font-mono">ชื่อภาษาอังกฤษ (EN):</label>
                                  <input
                                    type="text"
                                    value={editLabelEn}
                                    onChange={(e) => setEditLabelEn(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveStatRename(stat.id);
                                      if (e.key === 'Escape') handleCancelStatRename();
                                    }}
                                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveStatRename(stat.id)}
                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                                  >
                                    <Check className="size-3" />
                                    <span>{lang === 'th' ? 'บันทึก' : 'Save'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelStatRename}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition cursor-pointer"
                                  >
                                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="group/stat flex items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-100">{lang === 'th' ? stat.labelTh : stat.labelEn}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleStartRenameStat(stat)}
                                      className="opacity-0 group-hover/stat:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                                      title={lang === 'th' ? 'คลิกเพื่อเปลี่ยนชื่อสเตตัสนี้' : 'Click to rename this stat'}
                                    >
                                      <Edit3 className="size-3" />
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                    <span>{stat.id}</span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-slate-400">{lang === 'th' ? stat.labelEn : stat.labelTh}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                stat.category === 'combat'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : stat.category === 'defense'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : stat.category === 'spirit'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : stat.category === 'special'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {stat.category.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {stat.inputType === 'spirit_card' ? (
                              <span className="text-purple-300 font-medium">🔮 Spirit Card</span>
                            ) : stat.inputType === 'percentage' ? (
                              <span className="text-cyan-300 font-medium">% Percent</span>
                            ) : (
                              <span className="text-slate-400"># Number</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-slate-500 font-semibold">×</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={stat.multiplier}
                                onChange={(e) => handleMultiplierChange(stat.id, parseFloat(e.target.value))}
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {stat.spiritConfig ? (
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={stat.spiritConfig.accentColor || '#3b82f6'}
                                  onChange={(e) => handleNeonColorChange(stat.id, e.target.value)}
                                  className="size-6 rounded cursor-pointer border border-slate-600 bg-transparent p-0"
                                  title={lang === 'th' ? 'คลิกเลือกสีไฟนีออน' : 'Pick neon color'}
                                />
                                <span
                                  className="size-3.5 rounded-full inline-block shadow-sm"
                                  style={{
                                    backgroundColor: stat.spiritConfig.accentColor,
                                    boxShadow: `0 0 8px ${stat.spiritConfig.accentColor}`
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={stat.isActive}
                              onChange={() => handleToggleActive(stat.id)}
                              className="size-4 accent-amber-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={stat.includeInTransfer}
                              onChange={() => handleToggleTransfer(stat.id)}
                              className="size-4 accent-cyan-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {DEFAULT_STAT_DEFINITIONS.every((d) => d.id !== stat.id) && (
                              <button
                                onClick={() => handleDeleteStat(stat.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition"
                                title="Delete"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'add_new' && (
            <form onSubmit={handleCreateStat} className="max-w-2xl mx-auto space-y-4 bg-slate-850 p-6 rounded-2xl border border-slate-700/80 shadow-xl">
              <div className="flex items-center gap-2.5 border-b border-slate-750 pb-3">
                <Plus className="size-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {lang === 'th' ? 'สร้างสเตตัสใหม่ รองรับการอัปเดตของเกม' : 'Create Custom Attribute for Future Updates'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'ชื่อสเตตัส (ภาษาไทย) *' : 'Attribute Name (TH) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newLabelTh}
                    onChange={(e) => setNewLabelTh(e.target.value)}
                    placeholder="เช่น พลังเจาะเกราะ, ผลึกขั้น 6"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'ชื่อสเตตัส (ภาษาอังกฤษ)' : 'Attribute Name (EN)'}
                  </label>
                  <input
                    type="text"
                    value={newLabelEn}
                    onChange={(e) => setNewLabelEn(e.target.value)}
                    placeholder="e.g. Armor Penetration"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'รหัสคีย์อ้างอิง (Key ID) *' : 'Key ID (Unique) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="e.g. penetration_power"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'หมวดหมู่ (Category)' : 'Category'}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as StatCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  >
                    <option value="combat">⚔️ โจมตี (Combat)</option>
                    <option value="defense">🛡️ ป้องกัน (Defense)</option>
                    <option value="spirit">🔮 ผลึกวิญญาณ (Spirit)</option>
                    <option value="special">✨ สเตตัสพิเศษ / PvP (Special)</option>
                    <option value="custom">⚙️ ทั่วไป (Custom)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'ชนิดช่องกรอก (Input Type)' : 'Input UI Type'}
                  </label>
                  <select
                    value={newInputType}
                    onChange={(e) => setNewInputType(e.target.value as StatInputType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  >
                    <option value="number"># ตัวเลขจำนวนเต็ม (Number)</option>
                    <option value="percentage">% เปอร์เซ็นต์ (Percentage)</option>
                    <option value="spirit_card">🔮 การ์ดผลึกวิญญาณ (Level + Enhancement [0][+1][+2][+3])</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? 'ตัวคูณเริ่มต้น (Multiplier)' : 'Initial Multiplier'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newMultiplier}
                    onChange={(e) => setNewMultiplier(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* If Spirit Card: Customize Neon Glow & Icon */}
              {newInputType === 'spirit_card' && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-750 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Palette className="size-4" />
                    {lang === 'th' ? 'ปรับแต่งแสงไฟนีออนและไอคอนการ์ดผลึก' : 'Customize Neon Glow & Spirit Icon'}
                  </div>

                  {/* Neon Color Palette */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      {lang === 'th' ? 'เลือกสีไฟนีออนประจำการ์ด:' : 'Select Neon Glow Color:'}
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {PRESET_NEON_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setNewNeonColor(c.hex)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition border ${
                            newNeonColor === c.hex ? 'border-white ring-2 ring-amber-400/50' : 'border-slate-700 hover:border-slate-500'
                          }`}
                          style={{ backgroundColor: `${c.hex}22`, color: c.hex }}
                        >
                          <span className="size-3 rounded-full" style={{ backgroundColor: c.hex, boxShadow: `0 0 6px ${c.hex}` }} />
                          {c.name}
                        </button>
                      ))}

                      {/* Custom Color Input */}
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[11px] text-slate-400">Custom:</span>
                        <input
                          type="color"
                          value={newNeonColor}
                          onChange={(e) => setNewNeonColor(e.target.value)}
                          className="size-7 rounded cursor-pointer border border-slate-600 bg-transparent p-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      {lang === 'th' ? 'ไอคอนประจำการ์ด:' : 'Card Icon:'}
                    </label>
                    <div className="flex items-center gap-2">
                      {['Sparkles', 'Swords', 'Shield', 'Crown', 'Zap', 'Flame', 'Star', 'Target'].map((iconName) => (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setNewIcon(iconName)}
                          className={`p-2 rounded-lg border transition ${
                            newIcon === iconName ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {iconName === 'Sparkles' && <Sparkles className="size-4" />}
                          {iconName === 'Swords' && <Swords className="size-4" />}
                          {iconName === 'Shield' && <Shield className="size-4" />}
                          {iconName === 'Crown' && <Crown className="size-4" />}
                          {iconName === 'Zap' && <Zap className="size-4" />}
                          {iconName === 'Flame' && <Flame className="size-4" />}
                          {iconName === 'Star' && <Star className="size-4" />}
                          {iconName === 'Target' && <Target className="size-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview Card */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="size-3 rounded-full" style={{ backgroundColor: newNeonColor, boxShadow: `0 0 8px ${newNeonColor}` }} />
                      <span className="font-bold text-xs text-white">{newLabelTh || 'ชื่อผลึกตัวอย่าง'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2, 3].map((tier) => (
                        <span
                          key={tier}
                          className="px-2.5 py-1 rounded text-[11px] font-bold border transition"
                          style={
                            tier === 3
                              ? { borderColor: newNeonColor, color: newNeonColor, boxShadow: `0 0 8px ${newNeonColor}44`, backgroundColor: `${newNeonColor}15` }
                              : { borderColor: '#334155', color: '#94a3b8' }
                          }
                        >
                          {tier === 0 ? '0' : `+${tier}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition"
                >
                  <Plus className="size-4" />
                  {lang === 'th' ? 'สร้างสเตตัส' : 'Create Stat'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              {/* Sandbox Header Result */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 via-slate-850 to-slate-900 border border-amber-500/40 shadow-lg">
                  <div className="text-xs text-amber-300 font-semibold mb-1">
                    {lang === 'th' ? 'ผลลัพธ์ Power Level (Standard PL)' : 'Calculated Standard PL'}
                  </div>
                  <div className="text-3xl font-black text-amber-400 flex items-center gap-2">
                    <Zap className="size-7" />
                    <span>{sandboxPL.toLocaleString()}</span>
                    <span className="text-sm font-semibold text-slate-400">PL</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 via-slate-850 to-slate-900 border border-cyan-500/40 shadow-lg">
                  <div className="text-xs text-cyan-300 font-semibold mb-1">
                    {lang === 'th' ? 'ผลลัพธ์ Transfer PL (ย้ายเซิร์ฟเวอร์)' : 'Calculated Transfer PL'}
                  </div>
                  <div className="text-3xl font-black text-cyan-400 flex items-center gap-2">
                    <ArrowUpDown className="size-7" />
                    <span>{sandboxTransferPL.toLocaleString()}</span>
                    <span className="text-sm font-semibold text-slate-400">PL</span>
                  </div>
                </div>
              </div>

              {/* Sandbox Inputs Grid */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-300">
                  {lang === 'th' ? 'ทดลองกรอกสเตตัสเพื่อดูการคำนวณสด:' : 'Test Stat Inputs for Live Calculation:'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {settings.stats
                    .filter((s) => s.isActive)
                    .map((stat) => (
                      <div key={stat.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                        <label className="block text-[11px] text-slate-400 truncate" title={stat.labelTh}>
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
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-400 text-center"
                        />
                        <div className="text-[10px] text-slate-500 text-center">
                          × {stat.multiplier} = {Math.round((sandboxStats[stat.id] || 0) * stat.multiplier)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition"
          >
            <RotateCcw className="size-3.5" />
            {lang === 'th' ? 'คืนค่าเริ่มต้นทั้งหมด' : 'Reset Defaults'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              {lang === 'th' ? 'ปิด' : 'Close'}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition"
            >
              <Save className="size-4" />
              {lang === 'th' ? 'บันทึกการตั้งค่าสูตร' : 'Save Formula'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
