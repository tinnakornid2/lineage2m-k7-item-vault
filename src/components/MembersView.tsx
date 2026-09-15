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
  UserCheck,
  Search,
  Crown,
  AlertCircle,
  Sword,
  ArrowRightLeft,
  ArrowRight,
  LayoutGrid,
  List,
  Loader2
} from 'lucide-react';
import { CharacterClass, Language, User, UserRole, CHARACTER_CLASSES, OFFICIAL_CLASSES, cleanClanName, ClanGroup } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface MembersViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  clans?: ClanGroup[];
  selectedClanScope?: string;
  onSelectClanScope?: (scope: string) => void;
  onOpenRequestCp?: () => void;
  onApproveMember: (userId: string) => Promise<void>;
  onRejectMember: (userId: string) => Promise<void>;
  onApproveCpUpdate?: (userId: string) => Promise<void>;
  onRejectCpUpdate?: (userId: string) => Promise<void>;
  onUpdateMember: (userId: string, updates: Partial<User>) => Promise<void>;
  onDeleteMember: (userId: string) => Promise<void>;
  onOpenBulkSwap?: () => void;
  onOpenStatApproval?: () => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  lang,
  currentUser,
  allMembers,
  clans = [],
  selectedClanScope = 'all',
  onSelectClanScope,
  onOpenRequestCp,
  onApproveMember,
  onRejectMember,
  onApproveCpUpdate,
  onRejectCpUpdate,
  onUpdateMember,
  onDeleteMember,
  onOpenBulkSwap,
  onOpenStatApproval
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

  const canDeleteMember = (mem: User) => {
    if (!currentUser) return false;
    // Cannot delete your own account
    if (mem.id === currentUser.id) return false;
    // Owner accounts are immutable and cannot be deleted by another owner.
    if (currentUser.role === 'owner') return mem.role !== 'owner';
    // Admin can delete standard members and party leaders
    if (currentUser.role === 'admin') {
      return mem.role !== 'owner' && mem.role !== 'admin';
    }
    return false;
  };

  const canEditMember = (mem: User) => {
    if (!currentUser || mem.id === currentUser.id || mem.role === 'owner') return false;
    if (currentUser.role === 'owner') return true;
    return currentUser.role === 'admin' && (mem.role === 'party_leader' || mem.role === 'member');
  };

  const classMap = new Map(OFFICIAL_CLASSES.map((c) => [c.nameEn.toLowerCase(), c]));

  // Edit form state
  const [editInGameName, setEditInGameName] = useState('');
  const [editPowerLevel, setEditPowerLevel] = useState<number>(0);
  const [editClan, setEditClan] = useState('');
  const [editClass, setEditClass] = useState<CharacterClass>('Orb');
  const [editClasses, setEditClasses] = useState<string[]>([]);
  const [editLevel, setEditLevel] = useState<number>(0);
  const [editLegendClasses, setEditLegendClasses] = useState<number>(0);
  const [editLegendAgathions, setEditLegendAgathions] = useState<number>(0);
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [isSaving, setIsSaving] = useState(false);

  // View mode: Table vs 4-Column Grid
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Clan Scope & Filter
  const [internalClanFilter, setInternalClanFilter] = useState<string>('all');
  const activeClanScope = (selectedClanScope && selectedClanScope !== 'all') ? selectedClanScope : internalClanFilter;

  const handleClanFilterChange = (clan: string) => {
    sounds.playClick();
    setInternalClanFilter(clan);
    if (onSelectClanScope) {
      onSelectClanScope(clan);
    }
  };

  // Filter members by pending vs active
  const pendingMembers = allMembers.filter((m) => m.status === 'pending_approval');
  const pendingCpMembers = allMembers.filter(
    (m) => m.status === 'active' && Boolean(m.pendingPowerLevel && m.pendingPowerLevel > 0)
  );
  const activeMembers = allMembers.filter((m) => {
    if (m.status !== 'active') return false;
    if (activeClanScope !== 'all') {
      if (cleanClanName(m.clan).toLowerCase() !== cleanClanName(activeClanScope).toLowerCase()) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inIgn = m.inGameName.toLowerCase().includes(q);
      const inClan = m.clan.toLowerCase().includes(q);
      const inUser = m.username.toLowerCase().includes(q);
      const inClass = m.characterClass && m.characterClass.toLowerCase().includes(q);
      const inClasses = m.classes && m.classes.some((c) => c.toLowerCase().includes(q));
      if (!inIgn && !inClan && !inUser && !inClass && !inClasses) return false;
    }
    return true;
  });

  // Group active members by clan, sorted by powerLevel descending
  const clansMap = activeMembers.reduce((acc, mem) => {
    const cName = cleanClanName(mem.clan) || 'Unassigned';
    if (!acc[cName]) acc[cName] = [];
    acc[cName].push(mem);
    return acc;
  }, {} as Record<string, User[]>);

  // Sort each clan's members by Power Level descending
  Object.keys(clansMap).forEach((clan) => {
    clansMap[clan].sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  });

  // Dynamically sort clans according to the clans prop sequence (which reflects custom Firestore order)
  const orderedClanNames = clans.map((c) => cleanClanName(c.name).toLowerCase());
  const OFFICIAL_CLAN_ORDER = ['voltz', 'levels', 'stronk', 'no-clan'];
  const CLAN_COLOR_FALLBACK: Record<string, string> = {
    voltz: '#22c55e',
    levels: '#ef4444',
    stronk: '#eab308',
    'no-clan': '#3b82f6'
  };

  const sortedClanEntries: [string, User[]][] = (Object.entries(clansMap) as [string, User[]][]).sort(([clanA], [clanB]) => {
    const nameA = cleanClanName(clanA).toLowerCase();
    const nameB = cleanClanName(clanB).toLowerCase();

    // 1. Primary sort: Follow custom order from clans prop
    const idxA = orderedClanNames.indexOf(nameA);
    const idxB = orderedClanNames.indexOf(nameB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    // 2. Secondary fallback: Official default 4-clan sequence
    const fallbackA = OFFICIAL_CLAN_ORDER.indexOf(nameA);
    const fallbackB = OFFICIAL_CLAN_ORDER.indexOf(nameB);
    if (fallbackA !== -1 && fallbackB !== -1) return fallbackA - fallbackB;
    if (fallbackA !== -1) return -1;
    if (fallbackB !== -1) return 1;

    return clanA.localeCompare(clanB);
  });

  const handleOpenEdit = (user: User) => {
    sounds.playClick();
    setEditingUser(user);
    setEditInGameName(user.inGameName);
    setEditPowerLevel(user.powerLevel || 0);
    setEditClan(cleanClanName(user.clan));
    setEditClass(user.characterClass);
    setEditClasses(user.classes || (user.characterClass ? [user.characterClass] : []));
    setEditLevel(user.level || 0);
    setEditLegendClasses(user.legendClasses || 0);
    setEditLegendAgathions(user.legendAgathions || 0);
    setEditRole(user.role);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSaving(true);
    try {
      sounds.playClaim();
      const primaryClass = editClasses.length > 0 ? editClasses[0] : editClass;
      await onUpdateMember(editingUser.id, {
        inGameName: editInGameName.trim(),
        powerLevel: Number(editPowerLevel) || 0,
        pendingPowerLevel: null,
        pendingPowerLevelRequestedAt: null,
        clan: cleanClanName(editClan.trim()) || 'VoltZ',
        classes: editClasses,
        characterClass: primaryClass,
        level: Number(editLevel) || 0,
        legendClasses: Number(editLegendClasses) || 0,
        legendAgathions: Number(editLegendAgathions) || 0,
        role: editRole
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

        {/* Search & Bulk Actions */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">

          {onOpenBulkSwap && isAdminOrOwner && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onOpenBulkSwap();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 via-purple-500/15 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-purple-500/50 text-purple-300 hover:text-white text-xs font-semibold transition-all shadow-md cursor-pointer shrink-0"
              title={lang === 'th' ? 'จัดสรรแคลนแบบกลุ่ม' : 'Bulk Swap Clans'}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
              <span>{lang === 'th' ? 'จัดสรรแคลน (Bulk Swap)' : 'Bulk Swap'}</span>
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

      {/* Clan Filter Tabs / Scope Switcher & Layout Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
          <button
            type="button"
            onClick={() => handleClanFilterChange('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeClanScope === 'all'
                ? 'bg-[#d4af37]/20 border border-[#d4af37] text-[#f5d77f] shadow-lg shadow-[#d4af37]/10'
                : 'bg-[#0e1422] border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'ทุกแคลน' : 'All Clans'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
              {allMembers.filter((m) => m.status === 'active').length}
            </span>
          </button>

          {clans.map((c) => {
            const isSelected = cleanClanName(activeClanScope).toLowerCase() === cleanClanName(c.name).toLowerCase();
            const memberCount = allMembers.filter(
              (m) => m.status === 'active' && cleanClanName(m.clan).toLowerCase() === cleanClanName(c.name).toLowerCase()
            ).length;
            const cleanName = cleanClanName(c.name);
            const badgeText = cleanName.length >= 2 ? cleanName.substring(0, 2).toUpperCase() : cleanName.toUpperCase();

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleClanFilterChange(cleanName)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-slate-800/90 border text-white shadow-lg'
                    : 'bg-[#0e1422] border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                style={{
                  borderColor: isSelected ? (c.color || '#e2b714') : undefined,
                  boxShadow: isSelected ? `0 0 15px ${c.color || '#e2b714'}30` : undefined
                }}
              >
                <div
                  className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center font-mono text-white shrink-0"
                  style={{ backgroundColor: c.color || '#64748b' }}
                >
                  {badgeText}
                </div>
                <span className={isSelected ? 'text-white font-bold' : ''}>{cleanName}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                  {memberCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle: Table vs 4-Column Grid */}
        <div className="flex items-center gap-1 bg-[#090d16] p-1 rounded-xl border border-slate-800 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setViewMode('table');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-slate-800 text-[#f5d77f] shadow border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
            title={lang === 'th' ? 'มุมมองตาราง' : 'Table View'}
          >
            <List className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'ตาราง' : 'Table'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setViewMode('grid');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-slate-800 text-[#f5d77f] shadow border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
            title={lang === 'th' ? 'เรียง 4 แคลน' : '4 Clans Grid'}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'เรียง 4 แคลน' : '4 Clans'}</span>
          </button>
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
                        {t.clanName}: <span className="text-slate-200">{cleanClanName(member.clan)}</span>
                      </div>
                      <div>
                        {t.characterClass}: <span className="text-slate-200">{member.characterClass}</span>
                      </div>
                      <div>
                        {t.powerLevel}:{' '}
                        <span className="text-amber-400 font-mono font-bold">
                          ⚡ {(member.powerLevel || 0).toLocaleString()} PL
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={processingMemberId === member.id}
                      onClick={async () => {
                        setProcessingMemberId(member.id);
                        try {
                          sounds.playClaim();
                          await onApproveMember(member.id);
                        } finally {
                          setProcessingMemberId(null);
                        }
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow cursor-pointer disabled:opacity-50"
                    >
                      {processingMemberId === member.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {processingMemberId === member.id
                          ? (lang === 'th' ? 'กำลังอนุมัติ...' : 'Approving...')
                          : t.approveBtn}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={processingMemberId === member.id}
                      onClick={async () => {
                        setProcessingMemberId(member.id);
                        try {
                          sounds.playClick();
                          await onRejectMember(member.id);
                        } finally {
                          setProcessingMemberId(null);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 transition-all cursor-pointer disabled:opacity-50"
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

      {/* 2. PENDING STAT UPDATE BANNER NOTICE */}
      {isAdminOrOwner && pendingCpMembers.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Zap className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                <span>{lang === 'th' ? 'มีคำขออัปเดตสเตตัสรอการตรวจสอบ' : 'Pending Stat Update Requests'}</span>
                <span className="px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                  {pendingCpMembers.length}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {lang === 'th'
                  ? 'ตรวจสอบความถูกต้องของสเตตัส คลาส และภาพสกรีนช็อตได้ที่หน้าตรวจคำขอสเตตัส'
                  : 'Verify member stats, classes, and screenshots in the Stat Approvals page'}
              </div>
            </div>
          </div>
          {onOpenStatApproval && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenStatApproval();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>{lang === 'th' ? 'ไปที่หน้าตรวจคำขอสเตตัส' : 'Go to Stat Approvals'}</span>
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 3. ALL ACTIVE MEMBERS GROUPED BY CLAN (SORTED BY OFFICIAL 4-CLAN SEQUENCE & POWER LEVEL) */}
      <div className="space-y-6">
        {sortedClanEntries.length === 0 ? (
          <div className="p-10 text-center rounded-xl bg-[#0c121e] border border-slate-800 text-xs text-slate-500">
            {lang === 'th' ? 'ไม่พบข้อมูลสมาชิกตามที่ค้นหา' : 'No members found'}
          </div>
        ) : viewMode === 'grid' ? (
          /* 4-COLUMN RESPONSIVE GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            {sortedClanEntries.map(([clanName, members]) => {
              const cleanName = cleanClanName(clanName);
              const registeredClan = clans.find((c) => cleanClanName(c.name) === cleanName);
              const clanColor = registeredClan?.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#64748b';
              const clanInitial = cleanName.length >= 2 ? cleanName.substring(0, 2).toUpperCase() : cleanName.toUpperCase();
              const clanPower = members.reduce((sum, m) => sum + (m.powerLevel || 0), 0);
              const avgPower = members.length ? Math.round(clanPower / members.length) : 0;

              return (
                <div
                  key={clanName}
                  className="rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border border-slate-800 shadow-xl flex flex-col justify-between overflow-hidden"
                >
                  {/* Clan Header */}
                  <div className="p-3.5 bg-[#0d1422] border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white font-mono text-xs shrink-0 shadow-md border border-white/10"
                        style={{ backgroundColor: clanColor }}
                      >
                        {clanInitial}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold font-cinzel text-slate-100 truncate">
                          {cleanName}
                        </h3>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                          <span>{members.length} {lang === 'th' ? 'คน' : 'members'}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-mono font-bold">
                            ⚡ {clanPower.toLocaleString()} PL
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Member list in this clan */}
                  <div className="p-3 flex-1 space-y-2 min-h-[160px] max-h-[620px] overflow-y-auto">
                    {members.map((mem, idx) => {
                      const primaryClass = (mem.classes && mem.classes.length > 0) ? mem.classes[0] : (mem.characterClass || '');
                      const meta = primaryClass ? classMap.get(primaryClass.toLowerCase()) : undefined;

                      return (
                        <div
                          key={mem.id}
                          className="p-2.5 rounded-xl border bg-[#0a0f19] border-slate-800 hover:border-slate-700 text-slate-200 transition-all flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[10px] font-mono font-bold text-slate-500 w-4 shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{mem.inGameName}</span>
                                {Boolean(mem.level && mem.level > 0) && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono shrink-0">
                                    Lv.{mem.level}
                                  </span>
                                )}
                                {mem.role === 'owner' && (
                                  <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                {primaryClass && (
                                  <span className="inline-flex items-center gap-1 text-purple-300 font-medium truncate">
                                    {meta?.icon && (
                                      <img
                                        src={meta.icon}
                                        alt={primaryClass}
                                        className="size-3 object-contain shrink-0"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    )}
                                    <span className="truncate">{primaryClass}</span>
                                  </span>
                                )}
                                {primaryClass && <span>•</span>}
                                <span className="text-amber-400 font-mono font-semibold shrink-0">
                                  ⚡ {(mem.powerLevel || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {isAdminOrOwner && (
                            <button
                              onClick={() => handleOpenEdit(mem)}
                              className="p-1 rounded text-slate-500 hover:text-amber-300 hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
                              title={t.edit}
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer info */}
                  <div className="p-2.5 bg-[#090d16] border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{t.avgPower}: ⚡ {avgPower.toLocaleString()} PL</span>
                    <span className="text-slate-500 font-mono">{members.length} {lang === 'th' ? 'คน' : 'members'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DETAILED TABLE VIEW (SORTED BY 4 OFFICIAL CLANS) */
          sortedClanEntries.map(([clanName, members]: [string, User[]]) => {
            const cleanName = cleanClanName(clanName);
            const registeredClan = clans.find((c) => cleanClanName(c.name) === cleanName);
            const clanColor = registeredClan?.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#64748b';
            const clanInitial = cleanName.length >= 2 ? cleanName.substring(0, 2).toUpperCase() : cleanName.toUpperCase();
            const clanPower = members.reduce((sum, m) => sum + (m.powerLevel || 0), 0);

            return (
              <div
                key={clanName}
                className="rounded-xl bg-gradient-to-b from-[#111726] to-[#0a0e18] border border-slate-800 shadow-xl overflow-hidden"
              >
                {/* Clan Header Strip */}
                <div className="p-4 bg-[#0e1422] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white font-mono text-xs shrink-0 shadow-md border border-white/10"
                      style={{ backgroundColor: clanColor }}
                    >
                      {clanInitial}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 font-cinzel">
                        {cleanName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {members.length} {lang === 'th' ? 'คน' : 'members'} •{' '}
                        {t.totalPower}: <span className="font-mono text-amber-400 font-bold">⚡ {clanPower.toLocaleString()} PL</span>
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
                        <th className="py-2.5 px-4">{t.powerLevel} (PL)</th>
                        <th className="py-2.5 px-4">Role</th>
                        {isAdminOrOwner && (
                          <th className="py-2.5 px-4 text-right">{t.actions}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {members.map((mem, idx) => {
                        const primaryClass = (mem.classes && mem.classes.length > 0) ? mem.classes[0] : (mem.characterClass || '');
                        const meta = primaryClass ? classMap.get(primaryClass.toLowerCase()) : undefined;

                        return (
                          <tr key={mem.id} className="hover:bg-[#121c2e]/50 transition-colors">
                            <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-400">
                              #{idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-100 flex items-center gap-2">
                              <span>{mem.inGameName}</span>
                              {Boolean(mem.level && mem.level > 0) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                                  Lv.{mem.level}
                                </span>
                              )}
                              {mem.role === 'owner' && (
                                <Crown className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 font-mono">
                              {mem.username}
                            </td>
                            <td className="py-2.5 px-4 text-slate-300">
                              {primaryClass ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-200 border border-purple-500/30 shadow-sm">
                                  {meta?.icon && (
                                    <img
                                      src={meta.icon}
                                      alt={primaryClass}
                                      className="size-3.5 object-contain shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <span>{primaryClass}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-amber-300">⚡ {(mem.powerLevel || 0).toLocaleString()} PL</span>
                                {mem.id === currentUser?.id && onOpenRequestCp && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sounds.playClick();
                                      onOpenRequestCp();
                                    }}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-white text-[10px] font-sans font-medium transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                    title={t.requestCpUpdate}
                                  >
                                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                                    <span>{t.requestCpUpdate}</span>
                                  </button>
                                )}
                              </div>
                              {mem.pendingPowerLevel && mem.pendingPowerLevel > 0 && (
                                <div className="text-[10px] text-[#f5d77f] font-sans font-medium flex items-center gap-1 mt-0.5 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded w-fit">
                                  <span className="animate-pulse">⏳</span> {t.cpPendingBadge}: ⚡ {mem.pendingPowerLevel.toLocaleString()} PL
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                                  mem.role === 'owner'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : mem.role === 'admin'
                                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {mem.role === 'admin'
                                  ? t.roleAdmin
                                  : mem.role === 'owner'
                                  ? t.roleOwner
                                  : t.roleMember}
                              </span>
                            </td>
                            {isAdminOrOwner && (
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canEditMember(mem) && (
                                    <button
                                      id={`btn-edit-member-${mem.id}`}
                                      onClick={() => handleOpenEdit(mem)}
                                      className="p-1.5 rounded-lg bg-[#162235] hover:bg-[#1f314d] text-[#f5d77f] border border-slate-700 transition-all cursor-pointer"
                                      title={t.editProfile}
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  )}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Member profile editor */}
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

              {/* Character Profile: Classes (multi) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'th' ? 'อาชีพของตัวละคร (Class multi):' : 'Character Classes (Class multi):'}
                </label>
                <div className="p-2 rounded-lg bg-[#090d16] border border-slate-700 max-h-40 overflow-y-auto space-y-1">
                  {OFFICIAL_CLASSES.map((cls) => {
                    const isChecked = editClasses.includes(cls.nameEn);
                    return (
                      <label
                        key={cls.id}
                        className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded border text-xs transition ${
                          isChecked
                            ? 'border-purple-500 bg-purple-950/40 text-white'
                            : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditClasses([...editClasses, cls.nameEn]);
                            } else {
                              setEditClasses(editClasses.filter((c) => c !== cls.nameEn));
                            }
                          }}
                          className="size-3.5 rounded accent-purple-500 cursor-pointer"
                        />
                        <img
                          src={cls.icon}
                          alt={cls.nameEn}
                          className="size-4 object-contain shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span>{cls.nameEn}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Level, Legend Classes, Legend Agathions Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={editLevel === 0 ? '' : editLevel}
                    onChange={(e) => setEditLevel(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-center text-slate-100 focus:border-[#d4af37] focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 truncate" title="Legend Classes">
                    Legend Class
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editLegendClasses === 0 ? '' : editLegendClasses}
                    onChange={(e) => setEditLegendClasses(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-center text-slate-100 focus:border-[#d4af37] focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 truncate" title="Legend Agathions">
                    Legend Agath.
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editLegendAgathions === 0 ? '' : editLegendAgathions}
                    onChange={(e) => setEditLegendAgathions(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#090d16] border border-slate-700 text-xs text-center text-slate-100 focus:border-[#d4af37] focus:outline-none font-bold"
                  />
                </div>
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
                    <option value="admin">{t.roleAdmin}</option>
                  </select>
                </div>
              )}

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
                <span className="text-amber-300 font-semibold">{cleanClanName(memberToDelete.clan)}</span>
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
