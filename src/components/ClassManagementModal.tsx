import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Shield,
  Crown,
  Sparkles,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';
import { ClassMeta, Language, OFFICIAL_CLASSES } from '../types';
import { sounds } from '../utils/sound';

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  isOwner: boolean;
  classes: ClassMeta[];
  onSaveClasses: (classes: ClassMeta[]) => Promise<void>;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PRESET_ICONS = [
  { label: 'Dual Blades (ดาบคู่)', path: '/assets/classes/dualblades.png' },
  { label: 'Priest / Orb (ลูกแก้ว/พระ)', path: '/assets/classes/orb.png' },
  { label: 'Spear (หอก)', path: '/assets/classes/spear.png' },
  { label: 'Greatsword (ดาบใหญ่)', path: '/assets/classes/greatsword.png' },
  { label: 'Mage / Staff (เวทย์/คทา)', path: '/assets/classes/staff.png' },
  { label: 'Archer / Bow (ธนู)', path: '/assets/classes/bow.png' },
  { label: 'Assassin / Dagger (มีดสั้น)', path: '/assets/classes/dagger.png' },
  { label: 'One-Handed Sword (ดาบโล่)', path: '/assets/classes/sword.png' },
  { label: 'Crossbow (หน้าไม้)', path: '/assets/classes/xbow.png' }
];

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  isOpen,
  onClose,
  lang,
  isOwner,
  classes,
  onSaveClasses,
  showToast
}) => {
  // If not open, do not render
  if (!isOpen) return null;

  // Local draft state
  const [classList, setClassList] = useState<ClassMeta[]>(() => [...classes]);
  const [isSaving, setIsSaving] = useState(false);

  // New Class Form state
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameTh, setNewNameTh] = useState('');
  const [newIcon, setNewIcon] = useState('/assets/classes/sword.png');
  const [isCustomIconUrl, setIsCustomIconUrl] = useState(false);
  const [customIconInput, setCustomIconInput] = useState('');

  // Editing state: class id currently being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameTh, setEditNameTh] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Translation helpers
  const t = {
    title: lang === 'th' ? 'ตั้งค่าและจัดการคลาสตัวละคร' : 'Character Class Management',
    subtitle: lang === 'th'
      ? 'เพิ่ม แก้ไขเปลี่ยนชื่อ และลบคลาสตัวละครในระบบ (สิทธิ์เฉพาะ Owner)'
      : 'Add, rename, and delete character classes in the vault (Owner Only)',
    ownerBadge: lang === 'th' ? 'สิทธิ์ระดับ OWNER' : 'OWNER ACCESS',
    accessDenied: lang === 'th' ? 'เฉพาะบัญชี Owner เท่านั้นที่สามารถจัดการคลาสได้' : 'Only Owner accounts can manage character classes',
    addNewTitle: lang === 'th' ? 'เพิ่มคลาสใหม่' : 'Add New Class',
    nameEnLabel: lang === 'th' ? 'ชื่อภาษาอังกฤษ (English Name)' : 'English Name',
    nameEnPlaceholder: lang === 'th' ? 'เช่น Rapier, Magic Cannon' : 'e.g., Rapier, Magic Cannon',
    nameThLabel: lang === 'th' ? 'ชื่อภาษาไทย (Thai Name)' : 'Thai Name',
    nameThPlaceholder: lang === 'th' ? 'เช่น เรเปียร์ (Rapier)' : 'e.g., Rapier (Thai)',
    iconLabel: lang === 'th' ? 'เลือกไอคอนคลาส' : 'Select Class Icon',
    presetIcons: lang === 'th' ? 'ไอคอนมาตรฐาน' : 'Preset Icons',
    customUrl: lang === 'th' ? 'หรือใส่ลิงก์รูปภาพเอง (Custom URL)' : 'Or Custom Image URL',
    addButton: lang === 'th' ? '➕ เพิ่มคลาสใหม่' : '➕ Add Class',
    classListTitle: lang === 'th' ? 'รายการคลาสทั้งหมดในระบบ' : 'Configured Character Classes',
    totalClasses: (n: number) => lang === 'th' ? `ทั้งหมด ${n} คลาส` : `Total ${n} classes`,
    edit: lang === 'th' ? 'แก้ไข' : 'Edit',
    saveEdit: lang === 'th' ? 'บันทึก' : 'Save',
    cancel: lang === 'th' ? 'ยกเลิก' : 'Cancel',
    delete: lang === 'th' ? 'ลบ' : 'Delete',
    confirmDelete: lang === 'th' ? 'ยืนยันลบ' : 'Confirm Delete',
    deleteWarning: lang === 'th' ? 'ต้องการลบคลาสนี้ออกจากระบบใช่หรือไม่?' : 'Delete this class from the system?',
    resetDefaults: lang === 'th' ? 'รีเซ็ตกลับเป็นค่าเริ่มต้น' : 'Reset to Defaults',
    resetWarning: lang === 'th' ? 'คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตคลาสทั้งหมดกลับเป็น 9 คลาสมาตรฐาน?' : 'Reset all classes back to the 9 default classes?',
    saveAll: lang === 'th' ? 'บันทึกการเปลี่ยนแปลงทั้งหมด' : 'Save All Changes',
    saving: lang === 'th' ? 'กำลังบันทึก...' : 'Saving...',
    close: lang === 'th' ? 'ปิดหน้าต่าง' : 'Close',
    nameRequired: lang === 'th' ? 'กรุณาระบุชื่อภาษาอังกฤษของคลาส' : 'Please provide an English name for the class',
    duplicateName: lang === 'th' ? 'มีคลาสชื่อนี้อยู่ในระบบแล้ว' : 'A class with this name already exists',
    minOneClass: lang === 'th' ? 'ต้องมีคลาสตัวละครอย่างน้อย 1 คลาสในระบบ' : 'There must be at least 1 character class in the system'
  };

  // Add new class handler
  const handleAddClass = () => {
    const trimmedEn = newNameEn.trim();
    if (!trimmedEn) {
      showToast?.(t.nameRequired, 'error');
      return;
    }

    const trimmedTh = newNameTh.trim() || trimmedEn;
    const finalIcon = isCustomIconUrl && customIconInput.trim() ? customIconInput.trim() : newIcon;

    // Check duplicate
    const exists = classList.some(
      (c) => c.nameEn.toLowerCase() === trimmedEn.toLowerCase()
    );
    if (exists) {
      showToast?.(t.duplicateName, 'error');
      return;
    }

    sounds.playClaim();
    const newClassObj: ClassMeta = {
      id: trimmedEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36),
      nameEn: trimmedEn,
      nameTh: trimmedTh,
      icon: finalIcon
    };

    const updated = [...classList, newClassObj];
    setClassList(updated);

    // Reset inputs
    setNewNameEn('');
    setNewNameTh('');
    setCustomIconInput('');
    setIsCustomIconUrl(false);

    showToast?.(
      lang === 'th' ? `เพิ่มคลาส "${trimmedEn}" สำเร็จ! กด "บันทึก" เพื่ออัปเดตระบบ` : `Added "${trimmedEn}"! Click "Save All" to commit.`,
      'info'
    );
  };

  // Start editing a class
  const handleStartEdit = (item: ClassMeta) => {
    sounds.playClick();
    setEditingId(item.id);
    setEditNameEn(item.nameEn);
    setEditNameTh(item.nameTh);
    setEditIcon(item.icon);
    setDeleteConfirmId(null);
  };

  // Save inline edit
  const handleSaveEdit = (id: string) => {
    const trimmedEn = editNameEn.trim();
    if (!trimmedEn) {
      showToast?.(t.nameRequired, 'error');
      return;
    }

    const trimmedTh = editNameTh.trim() || trimmedEn;
    sounds.playClick();

    const updated = classList.map((c) =>
      c.id === id
        ? {
            ...c,
            nameEn: trimmedEn,
            nameTh: trimmedTh,
            icon: editIcon.trim() || c.icon
          }
        : c
    );

    setClassList(updated);
    setEditingId(null);
  };

  // Delete a class
  const handleDeleteClass = (id: string) => {
    if (classList.length <= 1) {
      showToast?.(t.minOneClass, 'error');
      return;
    }

    sounds.playClick();
    const updated = classList.filter((c) => c.id !== id);
    setClassList(updated);
    setDeleteConfirmId(null);
    if (editingId === id) setEditingId(null);
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    if (window.confirm(t.resetWarning)) {
      sounds.playClick();
      setClassList([...OFFICIAL_CLASSES]);
      setEditingId(null);
      setDeleteConfirmId(null);
      showToast?.(
        lang === 'th' ? 'รีเซ็ตกลับเป็น 9 คลาสมาตรฐานแล้ว อย่าลืมกดบันทึกการเปลี่ยนแปลง' : 'Reset to 9 default classes. Remember to click Save All.',
        'info'
      );
    }
  };

  // Save all to database & sync
  const handleSaveAll = async () => {
    if (!isOwner) {
      showToast?.(t.accessDenied, 'error');
      return;
    }

    if (classList.length === 0) {
      showToast?.(t.minOneClass, 'error');
      return;
    }

    setIsSaving(true);
    try {
      sounds.playClaim();
      await onSaveClasses(classList);
      showToast?.(
        lang === 'th' ? 'บันทึกการตั้งค่าคลาสเรียบร้อยแล้ว ⚔️' : 'Character classes saved successfully ⚔️',
        'success'
      );
      onClose();
    } catch (err: any) {
      console.error('Error saving character classes:', err);
      showToast?.(
        lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึกคลาส' : 'Failed to save character classes',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0b111e] border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0e1626]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Crown className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {t.title}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {t.ownerBadge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {t.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title={t.close}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6">
          {!isOwner ? (
            <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-center space-y-2">
              <AlertTriangle className="size-8 mx-auto text-rose-400" />
              <p className="font-semibold">{t.accessDenied}</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: Add New Class Form */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0e172a]/90 border border-amber-500/20 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                    <Plus className="size-4 text-amber-400" />
                    <span>{t.addNewTitle}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    1. {lang === 'th' ? 'เพิ่มคลาสใหม่' : 'Add Class'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* English Name Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      {t.nameEnLabel} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newNameEn}
                      onChange={(e) => setNewNameEn(e.target.value)}
                      placeholder={t.nameEnPlaceholder}
                      className="w-full bg-[#080d18] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm text-white outline-none transition"
                    />
                  </div>

                  {/* Thai Name Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      {t.nameThLabel}
                    </label>
                    <input
                      type="text"
                      value={newNameTh}
                      onChange={(e) => setNewNameTh(e.target.value)}
                      placeholder={t.nameThPlaceholder}
                      className="w-full bg-[#080d18] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm text-white outline-none transition"
                    />
                  </div>
                </div>

                {/* Icon Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">
                      {t.iconLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomIconUrl(!isCustomIconUrl)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 transition underline cursor-pointer"
                    >
                      {isCustomIconUrl ? t.presetIcons : t.customUrl}
                    </button>
                  </div>

                  {isCustomIconUrl ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customIconInput}
                        onChange={(e) => setCustomIconInput(e.target.value)}
                        placeholder="https://example.com/class-icon.png"
                        className="flex-1 bg-[#080d18] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none transition"
                      />
                      {customIconInput && (
                        <div className="size-9 rounded-lg bg-slate-800 border border-slate-700 p-1 flex items-center justify-center shrink-0">
                          <img
                            src={customIconInput}
                            alt="preview"
                            className="size-7 object-contain"
                            onError={(e) => ((e.target as HTMLElement).style.opacity = '0.3')}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {PRESET_ICONS.map((p) => {
                        const isSelected = newIcon === p.path && !isCustomIconUrl;
                        return (
                          <button
                            key={p.path}
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setNewIcon(p.path);
                            }}
                            className={`p-1.5 rounded-xl border flex items-center gap-1.5 text-xs transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                : 'bg-[#080d18] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                            title={p.label}
                          >
                            <img src={p.path} alt={p.label} className="size-5 object-contain" />
                            <span className="text-[11px] truncate max-w-[90px]">{p.label.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddClass}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
                  >
                    <span>{t.addButton}</span>
                  </button>
                </div>
              </div>

              {/* SECTION 2: List of Configured Classes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">
                      {t.classListTitle}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ({t.totalClasses(classList.length)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    title={t.resetDefaults}
                  >
                    <RotateCcw className="size-3" />
                    <span>{t.resetDefaults}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {classList.map((cls, idx) => {
                    const isEditing = editingId === cls.id;
                    const isConfirmingDelete = deleteConfirmId === cls.id;

                    if (isEditing) {
                      return (
                        <div
                          key={cls.id}
                          className="p-3 rounded-xl bg-[#141e33] border-2 border-amber-500/80 shadow-lg space-y-2.5 animate-fadeIn"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                            <span>2. {t.edit} #{idx + 1}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{cls.id}</span>
                          </div>

                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editNameEn}
                              onChange={(e) => setEditNameEn(e.target.value)}
                              placeholder={t.nameEnLabel}
                              className="w-full bg-[#080d18] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                            />
                            <input
                              type="text"
                              value={editNameTh}
                              onChange={(e) => setEditNameTh(e.target.value)}
                              placeholder={t.nameThLabel}
                              className="w-full bg-[#080d18] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                            />
                            <input
                              type="text"
                              value={editIcon}
                              onChange={(e) => setEditIcon(e.target.value)}
                              placeholder="Icon URL"
                              className="w-full bg-[#080d18] border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-amber-400"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                            >
                              {t.cancel}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(cls.id)}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow cursor-pointer"
                            >
                              <Check className="size-3 stroke-[3]" />
                              <span>{t.saveEdit}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={cls.id}
                        className="p-2.5 rounded-xl bg-[#090f1d] border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-2.5 shadow-sm group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-[10px] font-mono font-bold text-slate-500 w-4 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="size-8 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center p-1 shrink-0">
                            <img
                              src={cls.icon}
                              alt={cls.nameEn}
                              className="size-6 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.opacity = '0.3';
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                              <span className="truncate">{cls.nameEn}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {cls.nameTh !== cls.nameEn ? cls.nameTh : cls.nameEn}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons: Edit, Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/50 p-1 rounded-lg animate-fadeIn">
                              <button
                                type="button"
                                onClick={() => handleDeleteClass(cls.id)}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                                title={t.confirmDelete}
                              >
                                {t.confirmDelete}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(cls)}
                                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-700/60 hover:border-amber-500/40 transition cursor-pointer"
                                title={t.edit}
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  sounds.playClick();
                                  setDeleteConfirmId(cls.id);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 transition cursor-pointer"
                                title={t.delete}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-[#0c1424]">
          <div className="text-[11px] text-slate-400">
            {lang === 'th' ? '⚔️ แก้ไขแล้วอย่าลืมกดบันทึกเพื่อซิงก์ข้อมูลทุกคน' : '⚔️ Remember to save changes to sync across all users'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              {t.close}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <span>{t.saving}</span>
                ) : (
                  <>
                    <Check className="size-4 stroke-[3]" />
                    <span>{t.saveAll}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
