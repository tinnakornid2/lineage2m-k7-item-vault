import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Shield,
  Users,
  Sword,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Language, User } from '../types';
import { sounds } from '../utils/sound';

interface ClassSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: string[];
  members: User[];
  onAddClass: (className: string) => Promise<void>;
  onDeleteClass: (className: string) => Promise<void>;
  onResetClasses: () => Promise<void>;
  isOwner: boolean;
  lang: Language;
}

export const ClassSettingsModal: React.FC<ClassSettingsModalProps> = ({
  isOpen,
  onClose,
  classes,
  members,
  onAddClass,
  onDeleteClass,
  onResetClasses,
  isOwner,
  lang
}) => {
  const [newClassName, setNewClassName] = useState('');
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Calculate member count per class
  const memberCountByClass: Record<string, number> = {};
  members.forEach((m) => {
    if (m.characterClass) {
      const normalized = m.characterClass.trim();
      memberCountByClass[normalized] = (memberCountByClass[normalized] || 0) + 1;
    }
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) return;

    if (classes.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(
        lang === 'th'
          ? `มีอาชีพ "${trimmed}" ในระบบอยู่แล้ว`
          : `Class "${trimmed}" already exists`
      );
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    sounds.playClick();
    try {
      await onAddClass(trimmed);
      setNewClassName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete) return;
    setIsSubmitting(true);
    sounds.playClick();
    try {
      await onDeleteClass(classToDelete);
      setClassToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsSubmitting(true);
    sounds.playClick();
    try {
      await onResetClasses();
      setShowResetConfirm(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset classes');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-[#090f1d] border border-[#1e2e4b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-prompt"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-[#d4af37]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative p-5 sm:p-6 border-b border-[#1c2942]/80 flex items-center justify-between bg-gradient-to-r from-[#0d1627] via-[#091122] to-[#0d1627]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#f5d77f] shadow-sm">
              <Sword className="w-5 h-5 text-[#f5d77f]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {lang === 'th' ? 'จัดการรายชื่ออาชีพในกิลด์' : 'Guild Class Management'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold uppercase">
                  {isOwner
                    ? lang === 'th'
                      ? 'สิทธิ์ Owner'
                      : 'Owner Access'
                    : lang === 'th'
                    ? 'สิทธิ์ Officer'
                    : 'Officer Access'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'th'
                  ? 'เพิ่มหรือลบอาชีพที่สมาชิกสามารถเลือกได้ในระบบคลังและกิลด์'
                  : 'Add or remove character classes available for guild registration'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Add New Class Form */}
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{lang === 'th' ? 'เพิ่มอาชีพใหม่' : 'Add New Class'}</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => {
                  setNewClassName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={
                  lang === 'th'
                    ? 'พิมพ์ชื่ออาชีพใหม่ เช่น Rapier, Magic Cannon, Shield...'
                    : 'e.g. Rapier, Magic Cannon, Shield...'
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0d1627] border border-[#1e2e4b] focus:border-[#d4af37] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d4af37]/50 transition-all"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={!newClassName.trim() || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:from-[#f5d77f] hover:to-[#c99a22] text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'th' ? 'เพิ่มอาชีพ' : 'Add Class'}</span>
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </p>
            )}
          </form>

          {/* Current Classes List Header */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {lang === 'th' ? 'รายชื่ออาชีพทั้งหมด' : 'Active Classes'} ({classes.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setShowResetConfirm(true);
                }}
                className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                title={lang === 'th' ? 'คืนค่ารายชื่ออาชีพมาตรฐานเกม' : 'Reset to game defaults'}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{lang === 'th' ? 'คืนค่ามาตรฐาน' : 'Reset Defaults'}</span>
              </button>
            </div>

            {/* Classes Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {classes.map((className) => {
                const memberCount = memberCountByClass[className] || 0;
                return (
                  <div
                    key={className}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0d1627]/80 border border-[#1e2e4b] hover:border-[#38bdf8]/40 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/30 flex items-center justify-center text-[#7dd3fc] text-xs font-bold shrink-0">
                        {className.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-200 truncate">
                          {className}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>
                            {memberCount}{' '}
                            {lang === 'th' ? 'คนในกิลด์' : 'member(s)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        setClassToDelete(className);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/60 transition-all cursor-pointer shrink-0"
                      title={lang === 'th' ? `ลบอาชีพ ${className}` : `Delete ${className}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Delete Confirmation Sub-modal */}
        {classToDelete && (
          <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md p-5 rounded-2xl bg-[#0d1424] border border-red-800/80 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-700/60 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'th' ? 'ยืนยันการลบอาชีพ' : 'Confirm Class Deletion'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lang === 'th'
                      ? `คุณต้องการลบอาชีพ "${classToDelete}" ออกจากระบบใช่หรือไม่?`
                      : `Are you sure you want to remove "${classToDelete}"?`}
                  </p>
                </div>
              </div>

              {(memberCountByClass[classToDelete] || 0) > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200">
                  ⚠️ {lang === 'th'
                    ? `ปัจจุบันมีสมาชิกในกิลด์ใช้อาชีพนี้อยู่ ${memberCountByClass[classToDelete]} คน (ประวัติของสมาชิกจะไม่ถูกลบ)`
                    : `Currently ${memberCountByClass[classToDelete]} member(s) have this class.`}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setClassToDelete(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'ยืนยันลบ' : 'Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Confirmation Sub-modal */}
        {showResetConfirm && (
          <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md p-5 rounded-2xl bg-[#0d1424] border border-amber-800/80 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-700/60 text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'th' ? 'คืนค่ารายชื่ออาชีพมาตรฐาน' : 'Reset Default Classes'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lang === 'th'
                      ? 'ระบบจะรีเซ็ตรายชื่ออาชีพให้กลับเป็น 13 อาชีพมาตรฐานของ Lineage 2M'
                      : 'Reset character classes to the 13 official Lineage 2M classes.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'ยืนยันคืนค่า' : 'Confirm Reset'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#1c2942]/80 bg-[#050913]/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {lang === 'th'
              ? 'การเปลี่ยนแปลงจะซิงค์ไปยังหน้าสมัครสมาชิกและหน้ากิลด์ทันที'
              : 'Changes sync immediately to registration and member views'}
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            {lang === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
