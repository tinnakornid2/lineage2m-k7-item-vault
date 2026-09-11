import React, { useState } from 'react';
import {
  Users,
  Shield,
  Zap,
  Edit,
  Trash2,
  Check,
  X,
  Lock,
  KeyRound,
  UserCheck,
  Search,
  Crown,
  AlertCircle,
  Sword
} from 'lucide-react';
import { CharacterClass, Language, User, UserRole, CHARACTER_CLASSES } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface MembersViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  characterClasses?: string[];
  onOpenClassModal?: () => void;
  onApproveMember: (userId: string) => Promise<void>;
  onRejectMember: (userId: string) => Promise<void>;
  onUpdateMember: (userId: string, updates: Partial<User>) => Promise<void>;
  onDeleteMember: (userId: string) => Promise<void>;
}

export const MembersView: React.FC<MembersViewProps> = ({
  lang,
  currentUser,
  allMembers,
  characterClasses,
  onOpenClassModal,
  onApproveMember,
  onRejectMember,
  onUpdateMember,
  onDeleteMember
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);

  const canDeleteMember = (mem: User) => {
    if (!currentUser) return false;
    // Cannot delete your own account
    if (mem.id === currentUser.id) return false;
    // Owner can delete anyone except themselves
    if (currentUser.role === 'owner') return true;
    // Admin can delete members and managers
    if (currentUser.role === 'admin') {
      return mem.role !== 'owner' && mem.role !== 'admin';
    }
    // Manager can delete standard members
    if (currentUser.role === 'manager') {
      return mem.role === 'member';
    }
    return false;
  };

  // Edit form state
  const [editInGameName, setEditInGameName] = useState('');
  const [editPowerLevel, setEditPowerLevel] = useState<number>(0);
  const [editClan, setEditClan] = useState('');
  const [editClass, setEditClass] = useState<CharacterClass>('Orb');
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [editPassword, setEditPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter members by pending vs active
  const pendingMembers = allMembers.filter((m) => m.status === 'pending_approval');
  const activeMembers = allMembers.filter(
    (m) =>
      m.status === 'active' &&
      (m.inGameName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.clan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group active members by clan, sorted by powerLevel descending
  const clansMap = activeMembers.reduce((acc, mem) => {
    const cName = mem.clan || 'Unassigned';
    if (!acc[cName]) acc[cName] = [];
    acc[cName].push(mem);
    return acc;
  }, {} as Record<string, User[]>);

  // Sort each clan's members by Power Level descending
  Object.keys(clansMap).forEach((clan) => {
    clansMap[clan].sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  });

  const handleOpenEdit = (user: User) => {
    sounds.playClick();
    setEditingUser(user);
    setEditInGameName(user.inGameName);
    setEditPowerLevel(user.powerLevel || 0);
    setEditClan(user.clan);
    setEditClass(user.characterClass);
    setEditRole(user.role);
    setEditPassword(user.password || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSaving(true);
    try {
      sounds.playClaim();
      await onUpdateMember(editingUser.id, {
        inGameName: editInGameName.trim(),
        powerLevel: Number(editPowerLevel) || 0,
        clan: editClan.trim(),
        characterClass: editClass,
        role: editRole,
        password: editPassword.trim() || editingUser.password
      });
      setEditingUser(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22]">
            {t.allMembersTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {t.allMembersDesc}
          </p>
        </div>

        {/* Search & Class Management */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {onOpenClassModal && isAdminOrOwner && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onOpenClassModal();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/15 to-[#aa841c]/20 hover:from-[#d4af37]/30 hover:to-[#aa841c]/30 border border-[#d4af37]/50 text-[#f5d77f] hover:text-white text-xs font-semibold transition-all shadow-md cursor-pointer shrink-0"
              title={lang === 'th' ? 'จัดการรายชื่ออาชีพ' : 'Manage Classes'}
            >
              <Sword className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{lang === 'th' ? 'จัดการอาชีพ' : 'Manage Classes'}</span>
            </button>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0e1422] border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#d4af37] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 1. PENDING REGISTRATION APPROVALS (เฉพาะ Admin / Owner กดยืนยันสมาชิกด้วยตัวเอง) */}
      {isAdminOrOwner && (
        <div className="p-5 rounded-2xl bg-gradient-to-b from-[#182133] to-[#0f1524] border border-[#38bdf8]/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-cinzel text-sky-300 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#38bdf8]" />
              <span>{t.pendingApprovals} ({pendingMembers.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              {lang === 'th' ? 'แอดมินหรือโอเนอร์กดอนุมัติสมาชิกลงระบบ' : 'Admin & Owner manual verification'}
            </span>
          </div>

          {pendingMembers.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500 bg-[#0a0f19] rounded-lg border border-slate-800">
              {t.noPendingMembers}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-xl bg-[#090d16] border border-slate-700/80 flex flex-col justify-between gap-3 shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">
                        {member.inGameName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {t.pendingBadge}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                      <div>
                        {t.username}: <span className="text-slate-200">{member.username}</span>
                      </div>
                      <div>
                        {t.clanName}: <span className="text-slate-200">{member.clan}</span>
                      </div>
                      <div>
                        {t.characterClass}: <span className="text-slate-200">{member.characterClass}</span>
                      </div>
                      <div>
                        {t.powerLevel}:{' '}
                        <span className="text-amber-400 font-mono font-bold">
                          {(member.powerLevel || 0).toLocaleString()} CP
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        sounds.playClaim();
                        onApproveMember(member.id);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.approveBtn}</span>
                    </button>
                    <button
                      onClick={() => {
                        sounds.playClick();
                        onRejectMember(member.id);
                      }}
                      className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 transition-all cursor-pointer"
                      title={t.rejectBtn}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. ALL ACTIVE MEMBERS GROUPED BY CLAN & SORTED BY POWER LEVEL */}
      <div className="space-y-6">
        {Object.keys(clansMap).length === 0 ? (
          <div className="p-10 text-center rounded-xl bg-[#0c121e] border border-slate-800 text-xs text-slate-500">
            {lang === 'th' ? 'ไม่พบข้อมูลสมาชิกตามที่ค้นหา' : 'No members found'}
          </div>
        ) : (
          Object.entries(clansMap).map(([clanName, members]: [string, User[]]) => {
            const clanPower = members.reduce((sum, m) => sum + (m.powerLevel || 0), 0);
            return (
              <div
                key={clanName}
                className="rounded-xl bg-gradient-to-b from-[#111726] to-[#0a0e18] border border-slate-800 shadow-xl overflow-hidden"
              >
                {/* Clan Header Strip */}
                <div className="p-4 bg-[#0e1422] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[#f5d77f]">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 font-cinzel">
                        {clanName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {members.length} {lang === 'th' ? 'คน' : 'members'} •{' '}
                        {t.totalPower}: <span className="font-mono text-amber-400 font-bold">{clanPower.toLocaleString()} CP</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Horizontal Table for Members in this Clan */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 min-w-[650px]">
                    <thead className="bg-[#080d16] text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                        <th className="py-2.5 px-4">{t.inGameName}</th>
                        <th className="py-2.5 px-4">{t.username}</th>
                        <th className="py-2.5 px-4">{t.characterClass}</th>
                        <th className="py-2.5 px-4">{t.powerLevel}</th>
                        <th className="py-2.5 px-4">Role</th>
                        {isAdminOrOwner && (
                          <th className="py-2.5 px-4 text-right">{t.actions}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {members.map((mem, idx) => (
                        <tr key={mem.id} className="hover:bg-[#121c2e]/50 transition-colors">
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-100 flex items-center gap-2">
                            <span>{mem.inGameName}</span>
                            {mem.role === 'owner' && (
                              <Crown className="w-3.5 h-3.5 text-amber-400" />
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 font-mono">
                            {mem.username}
                          </td>
                          <td className="py-2.5 px-4 text-slate-300">
                            {mem.characterClass}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-amber-300">
                            {(mem.powerLevel || 0).toLocaleString()} CP
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                                mem.role === 'owner'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : mem.role === 'admin'
                                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                  : mem.role === 'manager'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {mem.role === 'manager'
                                ? t.roleManager
                                : mem.role === 'admin'
                                ? t.roleAdmin
                                : mem.role === 'owner'
                                ? t.roleOwner
                                : t.roleMember}
                            </span>
                          </td>
                          {isAdminOrOwner && (
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  id={`btn-edit-member-${mem.id}`}
                                  onClick={() => handleOpenEdit(mem)}
                                  className="p-1.5 rounded-lg bg-[#162235] hover:bg-[#1f314d] text-[#f5d77f] border border-slate-700 transition-all cursor-pointer"
                                  title={t.editProfile}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                {canDeleteMember(mem) && (
                                  <button
                                    id={`btn-delete-member-${mem.id}`}
                                    onClick={() => {
                                      sounds.playClick();
                                      setMemberToDelete(mem);
                                    }}
                                    className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 hover:border-red-600 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                                    title={t.deleteMember}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* EDIT MEMBER MODAL (รวมถึงรหัสผ่าน, ค่าพลัง, แคลน, อาชีพ) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-xl bg-gradient-to-b from-[#141c2c] via-[#0d1320] to-[#070b13] border border-[#d4af37]/40 shadow-2xl p-6 text-slate-200">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <Edit className="w-5 h-5 text-[#f5d77f]" />
              <h3 className="text-base font-bold font-cinzel text-slate-100">
                {t.editProfile}: {editingUser.inGameName}
              </h3>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {/* In-Game Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.inGameName}
                </label>
                <input
                  type="text"
                  required
                  value={editInGameName}
                  onChange={(e) => setEditInGameName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              {/* Power Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.changePowerLevel}
                </label>
                <input
                  type="number"
                  min="0"
                  value={editPowerLevel}
                  onChange={(e) => setEditPowerLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-slate-100 font-mono focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              {/* Clan Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.changeClan}
                </label>
                <input
                  type="text"
                  value={editClan}
                  onChange={(e) => setEditClan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              {/* Character Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.changeClass}
                </label>
                <select
                  value={editClass}
                  onChange={(e) => setEditClass(e.target.value as CharacterClass)}
                  className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none"
                >
                  {(characterClasses && characterClasses.length > 0
                    ? characterClasses
                    : CHARACTER_CLASSES
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role (Owner can set role) */}
              {isOwner && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.changeRole}
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none"
                  >
                    <option value="member">{t.roleMember}</option>
                    <option value="manager">{t.roleManager}</option>
                    <option value="admin">{t.roleAdmin}</option>
                    <option value="owner">{t.roleOwner}</option>
                  </select>
                </div>
              )}

              {/* Password Edit (as requested: "รวมถึงระหัสผ่าน") */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.editPassword}</span>
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={lang === 'th' ? 'กรอกรหัสผ่านใหม่' : 'New password'}
                  className="w-full px-3 py-2 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-slate-100 focus:border-[#d4af37] focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e6be44] text-slate-950 font-bold text-xs shadow transition-all disabled:opacity-50"
                >
                  {isSaving ? t.loading : t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM DELETE MEMBER MODAL (Safe for iframes) */}
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
                  {lang === 'th' ? 'การกระทำนี้จะลบข้อมูลออกจากระบบถาวร' : 'This action permanently removes the user'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 mb-5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">{t.inGameName}:</span>
                <span className="font-bold text-slate-100">{memberToDelete.inGameName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t.clanName}:</span>
                <span className="text-amber-300 font-semibold">{memberToDelete.clan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t.role}:</span>
                <span className="text-sky-300 font-mono uppercase text-[11px]">{memberToDelete.role}</span>
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
                id="btn-confirm-delete-member"
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

    </div>
  );
};
