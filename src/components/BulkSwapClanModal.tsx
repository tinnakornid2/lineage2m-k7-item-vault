import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Shield,
  Zap,
  Save,
  RotateCcw,
  GripVertical,
  ArrowRightLeft,
  Crown,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { User, cleanClanName, DEFAULT_CLAN } from '../types';
import { sounds } from '../utils/sound';

interface BulkSwapClanModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMembers: User[];
  clans: string[];
  lang: 'th' | 'en';
  onBulkUpdateClans: (swaps: { memberId: string; toClan: string }[]) => Promise<void>;
  onAddClan?: (clanName: string) => Promise<void> | void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BulkSwapClanModal: React.FC<BulkSwapClanModalProps> = ({
  isOpen,
  onClose,
  allMembers,
  clans,
  lang,
  onBulkUpdateClans,
  onAddClan,
  showToast
}) => {
  // Current assignment state: memberId -> currentClan
  const [memberClans, setMemberClans] = useState<Record<string, string>>({});
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customClans, setCustomClans] = useState<string[]>([]);
  const [newClanInput, setNewClanInput] = useState('');
  const [isAddingClan, setIsAddingClan] = useState(false);

  // Initialize clans
  const clanColumns = useMemo(() => {
    const list = new Set<string>();
    clans.forEach((c) => {
      const clean = cleanClanName(c);
      if (clean) list.add(clean);
    });
    customClans.forEach((c) => {
      const clean = cleanClanName(c);
      if (clean) list.add(clean);
    });
    list.add(DEFAULT_CLAN);
    list.add('VoltZ 2');
    list.add('VoltZ 3');
    list.add('Unassigned');
    return Array.from(list);
  }, [clans, customClans]);

  // Sync state on open
  React.useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      allMembers.forEach((m) => {
        const clean = cleanClanName(m.clan) || 'Unassigned';
        initial[m.id] = clean;
      });
      setMemberClans(initial);
      setSearchQuery('');
      setIsSaving(false);
    }
  }, [isOpen, allMembers]);

  if (!isOpen) return null;

  // Calculate pending swaps (changed clans)
  const pendingSwaps = useMemo(() => {
    const swaps: { memberId: string; fromClan: string; toClan: string }[] = [];
    allMembers.forEach((m) => {
      const originalClan = cleanClanName(m.clan) || 'Unassigned';
      const currentClan = memberClans[m.id] || originalClan;
      if (originalClan !== currentClan) {
        swaps.push({
          memberId: m.id,
          fromClan: originalClan,
          toClan: currentClan
        });
      }
    });
    return swaps;
  }, [allMembers, memberClans]);

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, memberId: string) => {
    setDraggedMemberId(memberId);
    e.dataTransfer.setData('text/plain', memberId);
    sounds.playClick();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetClan: string) => {
    e.preventDefault();
    const memberId = draggedMemberId || e.dataTransfer.getData('text/plain');
    if (!memberId) return;

    if (memberClans[memberId] !== targetClan) {
      sounds.playClaim();
      setMemberClans((prev) => ({
        ...prev,
        [memberId]: targetClan
      }));
    }
    setDraggedMemberId(null);
  };

  // Click-to-move quick handler
  const handleQuickMove = (memberId: string, targetClan: string) => {
    sounds.playClick();
    setMemberClans((prev) => ({
      ...prev,
      [memberId]: targetClan
    }));
  };

  // Reset to original clans
  const handleReset = () => {
    sounds.playClick();
    const initial: Record<string, string> = {};
    allMembers.forEach((m) => {
      initial[m.id] = cleanClanName(m.clan) || 'Unassigned';
    });
    setMemberClans(initial);
  };

  // Save all changes in one batch
  const handleSaveAll = async () => {
    if (pendingSwaps.length === 0) return;
    setIsSaving(true);
    try {
      sounds.playSuccess();
      await onBulkUpdateClans(
        pendingSwaps.map((s) => ({
          memberId: s.memberId,
          toClan: s.toClan === 'Unassigned' ? '' : s.toClan
        }))
      );
      if (showToast) {
        showToast(
          lang === 'th'
            ? `ย้ายสังกัดสมาชิกสำเร็จ ${pendingSwaps.length} คนเรียบร้อยแล้ว! 🏰`
            : `Reassigned ${pendingSwaps.length} members successfully! 🏰`,
          'success'
        );
      }
      onClose();
    } catch (err: any) {
      if (showToast) showToast(err?.message || 'Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add new clan column handler
  const handleCreateClan = async () => {
    const trimmed = newClanInput.trim();
    if (!trimmed) return;
    if (clanColumns.includes(trimmed)) {
      if (showToast) showToast(lang === 'th' ? 'มีชื่อแคลนนี้อยู่แล้ว' : 'Clan already exists', 'warning');
      return;
    }
    setCustomClans((prev) => [...prev, trimmed]);
    if (onAddClan) {
      try {
        await onAddClan(trimmed);
      } catch (err: any) {
        console.error('Failed to create clan:', err);
      }
    }
    setNewClanInput('');
    setIsAddingClan(false);
    sounds.playSuccess();
    if (showToast) {
      showToast(lang === 'th' ? `เพิ่มแคลน ${trimmed} สำเร็จ` : `Added clan ${trimmed}`, 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-7xl max-h-[95vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/20">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {lang === 'th' ? 'จัดสรรผังแคลนแบบกลุ่ม (Bulk Swap Clan Organizer)' : 'Bulk Swap Clan Organizer'}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  {allMembers.length} Members
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'ลากวางสมาชิกสลับแคลนหลัก/แคลนรอง ดูค่าพลังรวมของแต่ละแคลน และกดบันทึกรวดเดียวจบ'
                  : 'Drag and drop members between clan columns to reassign them. Apply all at once when ready.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative hidden md:block w-48">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'th' ? 'ค้นหาชื่อสมาชิก...' : 'Search member...'}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-750 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Columns Board Body */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-5 bg-slate-950/40">
          <div className="flex gap-4 h-full min-w-[900px] pb-16">
            {clanColumns.map((clanName) => {
              // Filter and sort members in this clan by PL descending
              const membersInClan = allMembers
                .filter((m) => {
                  const assignedClan = memberClans[m.id] || cleanClanName(m.clan) || 'Unassigned';
                  const matchesClan = assignedClan === clanName;
                  const matchesSearch =
                    !searchQuery ||
                    m.inGameName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (m.characterClass && m.characterClass.toLowerCase().includes(searchQuery.toLowerCase()));
                  return matchesClan && matchesSearch;
                })
                .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));

              const totalClanPL = membersInClan.reduce((sum, m) => sum + (m.powerLevel || 0), 0);
              const avgClanPL = membersInClan.length > 0 ? Math.round(totalClanPL / membersInClan.length) : 0;
              const isMainClan = clanName === DEFAULT_CLAN;

              return (
                <div
                  key={clanName}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, clanName)}
                  className={`flex-1 min-w-[280px] max-w-[340px] flex flex-col rounded-2xl border transition-all duration-200 ${
                    isMainClan
                      ? 'bg-slate-850/95 border-amber-500/40 shadow-lg shadow-amber-950/20'
                      : clanName === 'Unassigned'
                      ? 'bg-slate-900/70 border-dashed border-slate-750'
                      : 'bg-slate-850/70 border-slate-750'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-750/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isMainClan ? (
                          <Crown className="size-4 text-amber-400" />
                        ) : (
                          <Shield className="size-4 text-purple-400" />
                        )}
                        <span className="font-bold text-sm text-white">{clanName}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-900 border border-slate-700 text-slate-300">
                        {membersInClan.length} / 50
                      </span>
                    </div>

                    {/* Stats Summary Bar */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
                      <span>
                        Total: <strong className="text-amber-400">⚡ {totalClanPL.toLocaleString()} PL</strong>
                      </span>
                      <span>
                        Avg: <strong className="text-cyan-400">{avgClanPL.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Drop Zone & Members List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[calc(90vh-230px)]">
                    {membersInClan.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        {lang === 'th' ? 'ไม่มีสมาชิกในแคลนนี้' : 'No members in this clan'}
                        <div className="text-[10px] text-slate-600 mt-1">
                          {lang === 'th' ? 'ลากสมาชิกมาวางที่นี่' : 'Drag members here'}
                        </div>
                      </div>
                    ) : (
                      membersInClan.map((member, index) => {
                        const originalClan = cleanClanName(member.clan) || 'Unassigned';
                        const isMoved = originalClan !== clanName;

                        return (
                          <div
                            key={member.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, member.id)}
                            className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none border transition-all duration-150 ${
                              isMoved
                                ? 'bg-amber-500/15 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-md'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200 hover:bg-slate-850'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <GripVertical className="size-3.5 text-slate-500 shrink-0" />
                              <span className="w-5 text-center font-bold text-[11px] text-slate-500 shrink-0">
                                #{index + 1}
                              </span>
                              <div className="truncate">
                                <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                                  <span>{member.inGameName}</span>
                                  {isMoved && (
                                    <span className="text-[9px] px-1 rounded bg-amber-500 text-slate-950 font-bold uppercase">
                                      ย้าย
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <span>{member.characterClass || 'Class'}</span>
                                  {isMoved && (
                                    <span className="text-slate-500 line-through text-[9px]">
                                      ({originalClan})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold text-amber-400 font-mono">
                                ⚡ {(member.powerLevel || 0).toLocaleString()}
                              </span>

                              {/* Quick Move Dropdown button for touch devices */}
                              <select
                                value={clanName}
                                onChange={(e) => handleQuickMove(member.id, e.target.value)}
                                className="size-5 opacity-0 absolute cursor-pointer"
                                title="Move to another clan"
                              >
                                {clanColumns.map((c) => (
                                  <option key={c} value={c}>
                                    Move to {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add New Clan Column */}
            <div className="flex-1 min-w-[240px] max-w-[280px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-750/70 p-6 bg-slate-900/30 hover:border-purple-500/50 hover:bg-slate-900/50 transition">
              {isAddingClan ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Shield className="size-4 text-purple-400" />
                    <span>{lang === 'th' ? 'ชื่อแคลนใหม่' : 'New Clan Name'}</span>
                  </div>
                  <input
                    type="text"
                    value={newClanInput}
                    onChange={(e) => setNewClanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateClan();
                      if (e.key === 'Escape') {
                        setIsAddingClan(false);
                        setNewClanInput('');
                      }
                    }}
                    placeholder={lang === 'th' ? 'เช่น VoltZ 4...' : 'e.g. VoltZ 4...'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateClan}
                      className="flex-1 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      {lang === 'th' ? 'สร้าง' : 'Create'}
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingClan(false);
                        setNewClanInput('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                    >
                      {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingClan(true)}
                  className="flex flex-col items-center gap-2 text-slate-400 hover:text-purple-300 group transition cursor-pointer"
                >
                  <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/20 transition">
                    <Plus className="size-6" />
                  </div>
                  <span className="text-xs font-bold">
                    {lang === 'th' ? '+ เพิ่มแคลนใหม่' : '+ Add New Clan'}
                  </span>
                  <span className="text-[10px] text-slate-500 text-center">
                    {lang === 'th' ? 'สร้างคอลัมน์แคลนใหม่และลากสมาชิกใส่ได้ทันที' : 'Create new clan column and reassign'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Floating Action Bar */}
        <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {pendingSwaps.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                <AlertCircle className="size-4 text-amber-400 animate-pulse" />
                <span>
                  {lang === 'th'
                    ? `มีการสลับตำแหน่งสมาชิก ${pendingSwaps.length} คน (ยังไม่ได้บันทึก)`
                    : `${pendingSwaps.length} member reassignments pending save`}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                {lang === 'th'
                  ? 'ลากวางสมาชิกเพื่อจัดทัพแคลนหลัก/แคลนรองตามพลังรบ'
                  : 'Drag and drop members to balance clan strength'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pendingSwaps.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                <RotateCcw className="size-3.5" />
                <span>{lang === 'th' ? 'คืนค่าเดิม' : 'Reset'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              {lang === 'th' ? 'ปิด' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || pendingSwaps.length === 0}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition"
            >
              <Save className="size-4" />
              <span>
                {isSaving
                  ? lang === 'th'
                    ? 'กำลังบันทึก...'
                    : 'Saving...'
                  : lang === 'th'
                  ? `บันทึกการจัดทัพ (${pendingSwaps.length})`
                  : `Save Assignments (${pendingSwaps.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
