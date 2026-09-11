import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Users,
  Zap,
  GripVertical,
  CheckSquare,
  Square,
  AlertCircle,
  MoveRight
} from 'lucide-react';
import { ClanGroup, Language, User, cleanClanName } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface ClanViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  clans: ClanGroup[];
  onAddClan: (clanName: string) => Promise<void>;
  onDeleteClan: (clanId: string) => Promise<void>;
  onMoveMemberClan: (userId: string, newClanName: string) => Promise<void>;
  onDeleteMember: (userId: string) => Promise<void>;
  onBatchDeleteMembers: (userIds: string[]) => Promise<void>;
  onAddMemberQuick?: (member: Partial<User>) => Promise<void>;
}

export const ClanView: React.FC<ClanViewProps> = ({
  lang,
  currentUser,
  allMembers,
  clans,
  onAddClan,
  onDeleteClan,
  onMoveMemberClan,
  onDeleteMember,
  onBatchDeleteMembers
}) => {
  const t = translations[lang];
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  // Add clan input
  const [newClanName, setNewClanName] = useState('');
  const [showAddClan, setShowAddClan] = useState(false);

  // Batch delete selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [clanToDelete, setClanToDelete] = useState<ClanGroup | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // Drag-and-drop member transfer between clans
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);

  // Only active members
  const activeMembers = allMembers.filter((m) => m.status === 'active');

  const handleDragStart = (userId: string) => {
    setDraggedUserId(userId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnClan = async (targetClanName: string) => {
    if (!draggedUserId) return;
    const cleanTarget = cleanClanName(targetClanName);
    const member = activeMembers.find((m) => m.id === draggedUserId);
    if (!member || cleanClanName(member.clan) === cleanTarget) {
      setDraggedUserId(null);
      return;
    }

    sounds.playClaim();
    await onMoveMemberClan(draggedUserId, cleanTarget);
    setDraggedUserId(null);
  };

  const handleToggleSelectUser = (id: string) => {
    sounds.playClick();
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllInClan = (clanMembers: User[]) => {
    sounds.playClick();
    const ids = clanMembers.map((m) => m.id);
    const allSelected = ids.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleBatchDelete = () => {
    if (selectedUserIds.length === 0) return;
    sounds.playClick();
    setShowBatchDeleteModal(true);
  };

  const handleConfirmBatchDelete = async () => {
    sounds.playClick();
    await onBatchDeleteMembers(selectedUserIds);
    setSelectedUserIds([]);
    setShowBatchDeleteModal(false);
  };

  const handleAddClanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = cleanClanName(newClanName.trim());
    if (!cleanNew) return;
    sounds.playClaim();
    await onAddClan(cleanNew);
    setNewClanName('');
    setShowAddClan(false);
  };

  // Compile list of clans to display: union of registered clans + existing clans from members
  const allClanNamesSet = new Set<string>();
  clans.forEach((c) => {
    const cleaned = cleanClanName(c.name);
    if (cleaned) allClanNamesSet.add(cleaned);
  });
  activeMembers.forEach((m) => {
    const cleaned = cleanClanName(m.clan);
    if (cleaned) allClanNamesSet.add(cleaned);
  });
  const displayClanNames = Array.from(allClanNamesSet);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
            {t.clanManagementTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {t.clanManagementDesc}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Batch delete button */}
          {isAdminOrOwner && selectedUserIds.length > 0 && (
            <button
              id="btn-batch-delete"
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold transition-all shadow cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>{t.batchDeleteSelected} ({selectedUserIds.length})</span>
            </button>
          )}

          {/* Add Clan button */}
          {isAdminOrOwner && (
            <button
              onClick={() => {
                sounds.playClick();
                setShowAddClan(!showAddClan);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addNewClan}</span>
            </button>
          )}
        </div>
      </div>

      {/* Drag instruction notice */}
      {isAdminOrOwner && (
        <div className="p-3 rounded-xl bg-[#0f1728] border border-[#38bdf8]/30 text-xs text-[#7dd3fc] flex items-center gap-2">
          <MoveRight className="w-4 h-4 text-[#38bdf8] shrink-0" />
          <span>{t.dragMemberHint}</span>
        </div>
      )}

      {/* Add Clan Form modal/strip */}
      {showAddClan && isAdminOrOwner && (
        <form
          onSubmit={handleAddClanSubmit}
          className="p-4 rounded-xl bg-[#0e1422] border border-slate-700 flex flex-wrap items-center gap-3 animate-in fade-in duration-150"
        >
          <input
            type="text"
            required
            placeholder={t.clanNamePlaceholder}
            value={newClanName}
            onChange={(e) => setNewClanName(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none flex-1 min-w-[200px]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddClan(false)}
              className="px-3 py-2 text-xs text-slate-400 hover:text-white"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#d4af37] text-slate-950 font-bold text-xs hover:brightness-110 transition-all"
            >
              + {t.addNewClan}
            </button>
          </div>
        </form>
      )}

      {/* CLANS COLUMNS / GRIDS (แยกแคลนออกให้ชัดเจน ลากชื่อย้ายแคลนได้) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayClanNames.map((clanName) => {
          const cleanName = cleanClanName(clanName);
          const registeredClan = clans.find((c) => cleanClanName(c.name) === cleanName);
          const clanMembers = activeMembers
            .filter((m) => (cleanClanName(m.clan) || 'No Clan') === cleanName)
            .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));

          const totalClanPower = clanMembers.reduce(
            (sum, m) => sum + (m.powerLevel || 0),
            0
          );
          const avgPower = clanMembers.length
            ? Math.round(totalClanPower / clanMembers.length)
            : 0;

          const isTargetDrag = draggedUserId !== null;

          return (
            <div
              key={cleanName}
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnClan(cleanName)}
              className={`rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden ${
                isTargetDrag
                  ? 'border-[#38bdf8]/80 hover:bg-[#142036]'
                  : 'border-slate-800'
              }`}
            >
              {/* Clan Header */}
              <div className="p-4 bg-[#0d1422] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f5d77f]">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-cinzel text-slate-100">
                      {cleanName}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>{clanMembers.length} {lang === 'th' ? 'คน' : 'members'}</span>
                      <span>•</span>
                      <span>
                        {t.totalPower}:{' '}
                        <span className="text-amber-400 font-mono font-bold">
                          {totalClanPower.toLocaleString()} CP
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isAdminOrOwner && clanMembers.length > 0 && (
                    <button
                      onClick={() => handleSelectAllInClan(clanMembers)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t.selectAll}</span>
                    </button>
                  )}

                  {isAdminOrOwner && registeredClan && clanMembers.length === 0 && (
                    <button
                      id={`btn-delete-clan-${registeredClan.id}`}
                      onClick={() => {
                        sounds.playClick();
                        setClanToDelete(registeredClan);
                      }}
                      className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                      title={t.deleteClan}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Clan Members Drop Zone & List */}
              <div className="p-4 flex-1 space-y-2 min-h-[160px]">
                {clanMembers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <p>{lang === 'th' ? 'ไม่มีสมาชิกในแคลนนี้' : 'No members in this clan'}</p>
                    {isAdminOrOwner && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        {lang === 'th' ? 'สามารถลากสมาชิกจากแคลนอื่นมาวางที่นี่' : 'Drag members here to reassign'}
                      </p>
                    )}
                  </div>
                ) : (
                  clanMembers.map((member, idx) => {
                    const isSelected = selectedUserIds.includes(member.id);
                    return (
                      <div
                        key={member.id}
                        draggable={isAdminOrOwner}
                        onDragStart={() => handleDragStart(member.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          isSelected
                            ? 'bg-[#18263d] border-[#38bdf8] text-white shadow'
                            : 'bg-[#0a0f19] border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Batch select checkbox */}
                          {isAdminOrOwner && (
                            <button
                              type="button"
                              onClick={() => handleToggleSelectUser(member.id)}
                              className="text-slate-400 hover:text-[#38bdf8]"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#38bdf8]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Drag handle */}
                          {isAdminOrOwner && (
                            <GripVertical className="w-4 h-4 text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0" />
                          )}

                          <span className="text-[11px] font-mono font-bold text-slate-500 w-5">
                            #{idx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-100 truncate">
                              {member.inGameName}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <span>{member.characterClass}</span>
                              <span>•</span>
                              <span className="text-amber-400 font-mono font-semibold">
                                {(member.powerLevel || 0).toLocaleString()} CP
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Individual Delete for Admin/Owner */}
                        {isAdminOrOwner && member.role !== 'owner' && (
                          <button
                            id={`btn-delete-clan-member-${member.id}`}
                            onClick={() => {
                              sounds.playClick();
                              setMemberToDelete(member);
                            }}
                            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-all shrink-0 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                            title={t.deleteMember}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Clan Footer Info */}
              <div className="p-3 bg-[#090d16] border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>{t.avgPower}: {avgPower.toLocaleString()} CP</span>
                {isAdminOrOwner && (
                  <span className="text-[10px] text-slate-500 italic">
                    {lang === 'th' ? 'ลากการ์ดเพื่อย้ายแคลน' : 'Drag card to transfer'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* IN-APP CONFIRM DELETE CLAN MODAL */}
      {clanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบแคลน' : 'Confirm Delete Clan'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th' ? 'การกระทำนี้จะลบแคลนนี้ออกจากระบบ' : 'Permanently removes this clan'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-5">
              <span className="text-slate-400">{t.clanName}: </span>
              <span className="font-bold text-amber-300">{cleanClanName(clanToDelete.name)}</span>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setClanToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-delete-clan-modal"
                onClick={() => {
                  sounds.playClick();
                  onDeleteClan(clanToDelete.id);
                  setClanToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'ยืนยันลบแคลน' : 'Delete Clan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM DELETE MEMBER MODAL */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบสมาชิก' : 'Confirm Delete Member'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th' ? 'การกระทำนี้จะลบข้อมูลสมาชิกออกจากระบบ' : 'Permanently removes this member'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.inGameName}:</span>
                <span className="font-bold text-slate-100">{memberToDelete.inGameName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t.clanName}:</span>
                <span className="text-amber-300">{cleanClanName(memberToDelete.clan)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-delete-member-modal"
                onClick={() => {
                  sounds.playClick();
                  onDeleteMember(memberToDelete.id);
                  setMemberToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? 'ยืนยันลบสมาชิก' : 'Delete Member'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM BATCH DELETE MODAL */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#181015] via-[#100a0e] to-[#080507] border border-red-500/50 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.25)] p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {lang === 'th' ? 'ยืนยันการลบแบบกลุ่ม' : 'Confirm Batch Delete'}
                </h3>
                <p className="text-xs text-red-400/90 font-medium">
                  {lang === 'th' ? `จะลบสมาชิกที่เลือกทั้งหมด ${selectedUserIds.length} คน` : `Delete all ${selectedUserIds.length} selected members`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-batch-delete-modal"
                onClick={handleConfirmBatchDelete}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-900/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'th' ? `ลบทั้ง ${selectedUserIds.length} คน` : 'Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
