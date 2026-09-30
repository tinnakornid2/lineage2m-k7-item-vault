import React, { useState, useMemo } from 'react';
import {
  Shield,
  Users,
  Zap,
  UserX,
  Search,
  X,
  ArrowRightLeft,
  Sparkles,
  Crown,
  ShieldCheck
} from 'lucide-react';
import { ClanGroup, Language, User, cleanClanName, isNoClan, OFFICIAL_CLASSES } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface ClanRosterViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  clans: ClanGroup[];
  onNavigateToBulkSwap?: () => void;
}

const CLAN_COLOR_FALLBACK: Record<string, string> = {
  voltz: '#22c55e',
  levels: '#ef4444',
  stronk: '#eab308'
};

export const ClanRosterView: React.FC<ClanRosterViewProps> = ({
  lang,
  currentUser,
  allMembers,
  clans,
  onNavigateToBulkSwap
}) => {
  const t = translations[lang];
  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClanTab, setSelectedClanTab] = useState<string>('all');

  // Active members only
  const activeMembers = useMemo(
    () => allMembers.filter((m) => m.status === 'active'),
    [allMembers]
  );

  // Compile list of registered clans (including safe official fallbacks)
  const displayClans = useMemo(() => {
    const clanMap = new Map<string, ClanGroup>();
    clans.forEach((c, idx) => {
      const cleanName = cleanClanName(c.name);
      if (cleanName && !isNoClan(cleanName) && !clanMap.has(cleanName.toLowerCase())) {
        clanMap.set(cleanName.toLowerCase(), {
          ...c,
          name: cleanName,
          color: c.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#d4af37',
          order: c.order ?? idx,
          enabled: c.enabled !== false
        });
      }
    });

    return Array.from(clanMap.values()).sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999)
    );
  }, [clans]);

  // Only display clans that are ENABLED (toggled ON in Bulk Swap)
  const visibleClans = useMemo(() => {
    return displayClans.filter((c) => c.enabled !== false);
  }, [displayClans]);

  const clansToRender = useMemo(() => {
    if (!selectedClanTab || selectedClanTab === 'all') return visibleClans;
    if (selectedClanTab === 'unassigned') return [];
    const match = visibleClans.filter(
      (c) => cleanClanName(c.name).toLowerCase() === cleanClanName(selectedClanTab).toLowerCase()
    );
    return match.length > 0 ? match : visibleClans;
  }, [visibleClans, selectedClanTab]);

  // Set of valid clan names
  const validClanNamesLower = useMemo(
    () => new Set(displayClans.map((c) => cleanClanName(c.name).toLowerCase())),
    [displayClans]
  );

  // Members who are not assigned to any registered clan
  const unassignedMembers = useMemo(() => {
    return activeMembers
      .filter((m) => {
        if (isNoClan(m.clan)) return true;
        const clean = cleanClanName(m.clan).toLowerCase();
        return !validClanNamesLower.has(clean);
      })
      .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  }, [activeMembers, validClanNamesLower]);

  // Search filter
  const cleanSearch = searchQuery.trim().toLowerCase();
  const filterMember = (m: User) => {
    if (!cleanSearch) return true;
    const ign = (m.inGameName || '').toLowerCase();
    const primaryClass = ((m.classes && m.classes[0]) || m.characterClass || '').toLowerCase();
    const lvl = m.level ? m.level.toString() : '';
    return ign.includes(cleanSearch) || primaryClass.includes(cleanSearch) || lvl.includes(cleanSearch);
  };

  const filteredUnassignedMembers = useMemo(
    () => unassignedMembers.filter(filterMember),
    [unassignedMembers, cleanSearch]
  );

  // Overall alliance stats
  const totalAlliancePower = useMemo(
    () => activeMembers.reduce((sum, m) => sum + (m.powerLevel || 0), 0),
    [activeMembers]
  );

  const unassignedPower = useMemo(
    () => unassignedMembers.reduce((sum, m) => sum + (m.powerLevel || 0), 0),
    [unassignedMembers]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & ALLIANCE SUMMARY CONTROLS
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#111728] via-[#0d1322] to-[#0a0f1a] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#e6be44] to-[#c99a22] flex items-center gap-2">
              <Shield className="w-7 h-7 text-[#d4af37]" />
              <span>{t.clanRosterTitle || (lang === 'th' ? 'แคลน' : 'Clans')}</span>
            </h1>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {visibleClans.length} {t.visibleClansCount || (lang === 'th' ? 'แคลนที่เปิดอยู่' : 'Active Clans')}
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {activeMembers.length} {t.totalMembers || (lang === 'th' ? 'สมาชิก' : 'Members')}
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t.clanRosterSubtitle || (lang === 'th' ? 'ทำเนียบสมาชิกแยกตามแคลนและสมาชิกที่รอจัดสรร (อัปเดตเรียลไทม์)' : 'Real-time rosters of each clan and unassigned members')}
          </p>
        </div>

        {/* Action Controls & Search */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Real-time Search Box */}
          <div className="relative flex-1 sm:w-60 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.filterClanMembers || (lang === 'th' ? 'ค้นหาชื่อสมาชิกหรือคลาส...' : 'Search member name or class...')}
              className="w-full pl-8 pr-7 py-2 rounded-xl bg-[#090d16] border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:border-[#d4af37] focus:outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Jump to Bulk Swap (Admin/Owner only) */}
          {isAdminOrOwner && onNavigateToBulkSwap && (
            <button
              id="btn-navigate-to-bulk-swap"
              type="button"
              onClick={() => {
                sounds.playClick();
                onNavigateToBulkSwap();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-purple-800/40 hover:from-purple-600/45 hover:to-indigo-600/45 border border-purple-500/50 text-purple-200 hover:text-white text-xs font-bold shadow-lg shadow-purple-950/40 transition-all cursor-pointer shrink-0 active:scale-95"
              title={lang === 'th' ? 'ไปที่หน้าจัดสรรแคลนแบบกลุ่ม' : 'Go to Bulk Swap'}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-300" />
              <span>{t.tabBulkSwap || (lang === 'th' ? 'จัดสรรแคลน' : 'Bulk Swap')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. ALLIANCE POWER SUMMARY STRIP
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
        <div className="p-3 rounded-xl bg-[#0e1422] border border-slate-800/80 shadow-md">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>{t.visibleClansCount || (lang === 'th' ? 'แคลนที่เปิดอยู่' : 'Active Clans')}</span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-slate-100 mt-1">
            {visibleClans.length}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-slate-800/80 shadow-md">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'th' ? 'สมาชิกทั้งหมด' : 'Total Members'}</span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-1">
            {activeMembers.length}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-slate-800/80 shadow-md">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.totalAlliancePower || (lang === 'th' ? 'พลังรวมพันธมิตร' : 'Total Power')}</span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-amber-300 mt-1 truncate">
            ⚡ {totalAlliancePower.toLocaleString()}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-slate-800/80 shadow-md">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.unassignedClan || (lang === 'th' ? 'รอจัดสรร' : 'Unassigned')}</span>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-amber-400 mt-1">
            {unassignedMembers.length} {lang === 'th' ? 'คน' : ''}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2.5. QUICK CLAN SCOPE FILTER TABS
         ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {/* All Clans Tab */}
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setSelectedClanTab('all');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            selectedClanTab === 'all'
              ? 'bg-[#d4af37]/20 border border-[#d4af37]/60 text-[#f5d77f] shadow'
              : 'bg-[#0d1424] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>{lang === 'th' ? 'ทุกแคลน' : 'All Clans'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
            {activeMembers.length}
          </span>
        </button>

        {/* Individual Clans Tabs */}
        {visibleClans.map((c) => {
          const isSelected = selectedClanTab.toLowerCase() === c.name.toLowerCase();
          const cMembers = activeMembers.filter(
            (m) => cleanClanName(m.clan).toLowerCase() === cleanClanName(c.name).toLowerCase()
          );
          const cColor = c.color || CLAN_COLOR_FALLBACK[c.name.toLowerCase()] || '#d4af37';

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                sounds.playClick();
                setSelectedClanTab(c.name);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? 'border shadow text-white font-bold'
                  : 'bg-[#0d1424] border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              style={{
                backgroundColor: isSelected ? `${cColor}25` : undefined,
                borderColor: isSelected ? `${cColor}80` : undefined,
                boxShadow: isSelected ? `0 0 12px ${cColor}30` : undefined
              }}
            >
              <div
                className="w-3.5 h-3.5 rounded text-[8px] font-bold flex items-center justify-center font-mono text-white shrink-0"
                style={{ backgroundColor: cColor }}
              >
                {c.name.substring(0, 1).toUpperCase()}
              </div>
              <span className={isSelected ? 'text-white' : ''}>{c.name}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800/80 text-[10px] font-mono font-bold text-slate-300">
                {cMembers.length}/50
              </span>
            </button>
          );
        })}

        {/* Unassigned Tab */}
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setSelectedClanTab('unassigned');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            selectedClanTab === 'unassigned'
              ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300 shadow'
              : 'bg-[#0d1424] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <UserX className="w-3.5 h-3.5 text-amber-400" />
          <span>{lang === 'th' ? 'ไม่มีแคลน / รอจัดสรร' : 'Unassigned'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-amber-400">
            {unassignedMembers.length}
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. CLANS & UNASSIGNED POOL GRID (EXPANDED SPACIOUS ROSTER)
         ───────────────────────────────────────────────────────────── */}
      <div className={`grid gap-6 items-start ${
        selectedClanTab !== 'all' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'
      }`}>
        {/* Render Each Visible Clan */}
        {clansToRender.map((clan, idx) => {
          const cleanName = cleanClanName(clan.name);
          const clanMembers = activeMembers
            .filter((m) => (cleanClanName(m.clan) || '').toLowerCase() === cleanName.toLowerCase())
            .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));

          const filteredClanMembers = clanMembers.filter(filterMember);

          const totalClanPower = clanMembers.reduce(
            (sum, m) => sum + (m.powerLevel || 0),
            0
          );
          const avgPower = clanMembers.length
            ? Math.round(totalClanPower / clanMembers.length)
            : 0;

          const clanColor = clan.color || CLAN_COLOR_FALLBACK[cleanName.toLowerCase()] || '#d4af37';
          const clanInitial =
            cleanName.length >= 2
              ? cleanName.substring(0, 2).toUpperCase()
              : cleanName.toUpperCase();

          const getClassMeta = (nameOrId?: string) => {
            if (!nameOrId) return null;
            const lower = nameOrId.toLowerCase().trim();
            return OFFICIAL_CLASSES.find(
              (c) =>
                c.id.toLowerCase() === lower ||
                c.nameEn.toLowerCase() === lower ||
                c.nameTh.toLowerCase().includes(lower)
            ) || null;
          };

          return (
            <div
              key={clan.id || cleanName}
              id={`roster-clan-${cleanName}`}
              className="rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border border-slate-800 transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden hover:border-slate-700"
            >
              {/* Clan Header */}
              <div className="p-3.5 sm:p-4 bg-[#0d1422] border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white font-mono text-sm shrink-0 shadow-md border border-white/10"
                    style={{ backgroundColor: clanColor }}
                  >
                    {clanInitial}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold font-cinzel text-slate-100 truncate">
                        {cleanName}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 truncate mt-0.5">
                      <span className="text-emerald-400 font-semibold font-mono">
                        {clanMembers.length}/50 {lang === 'th' ? 'คน' : 'members'}
                      </span>
                      <span>•</span>
                      <span className="text-amber-400 font-mono font-bold">
                        ⚡ {totalClanPower.toLocaleString()} PL
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400">{t.avgPower || (lang === 'th' ? 'เฉลี่ย' : 'Avg')}</div>
                  <div className="text-xs sm:text-sm font-mono font-bold text-slate-200">
                    ⚡ {avgPower.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Members List - Spacious 2-column 50-member grid */}
              <div className="p-3 sm:p-3.5 flex-1 min-h-[240px]">
                {clanMembers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <Shield className="w-8 h-8 text-slate-600 mb-2 stroke-[1.2]" />
                    <p>{lang === 'th' ? 'ไม่มีสมาชิกในแคลนนี้' : 'No members in this clan'}</p>
                  </div>
                ) : filteredClanMembers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <Search className="w-6 h-6 text-slate-600 mb-2" />
                    <p>{lang === 'th' ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'No matching members found'}</p>
                  </div>
                ) : (() => {
                    const totalSlots = cleanSearch ? filteredClanMembers.length : Math.max(50, clanMembers.length);
                    const midPoint = Math.ceil(totalSlots / 2);
                    const leftSlots = Array.from({ length: midPoint }, (_, i) => ({
                      slotIdx: i,
                      slotRank: i + 1,
                      member: filteredClanMembers[i]
                    }));
                    const rightSlots = Array.from({ length: totalSlots - midPoint }, (_, i) => {
                      const slotIdx = midPoint + i;
                      return {
                        slotIdx,
                        slotRank: slotIdx + 1,
                        member: filteredClanMembers[slotIdx]
                      };
                    });

                    const renderSlotItem = (item: { slotIdx: number; slotRank: number; member?: User }, keyPrefix: string) => {
                      const { member, slotRank, slotIdx } = item;
                      if (!member) {
                        if (cleanSearch) return null;
                        return (
                          <div
                            key={`${keyPrefix}-empty-${slotIdx}`}
                            className="py-1 px-2.5 rounded-xl bg-[#070b14]/40 border border-slate-800/30 flex items-center justify-between text-[9.5px] text-slate-600 select-none min-h-[44px]"
                          >
                            <span className="font-mono w-5 text-center text-slate-600 shrink-0 font-bold">
                              {slotRank}
                            </span>
                            <span className="italic truncate flex-1 pl-1.5 text-[9px]">
                              {lang === 'th' ? '- ตำแหน่งว่าง -' : '- Open Slot -'}
                            </span>
                          </div>
                        );
                      }

                      const primaryClass = (member.classes && member.classes[0]) || member.characterClass || '';
                      const meta = getClassMeta(primaryClass);
                      const isOwner = member.role === 'owner';
                      const isAdmin = member.role === 'admin';

                      return (
                        <div
                          key={member.id}
                          className="py-1.5 px-2.5 rounded-xl bg-[#090e1a]/95 border border-slate-800/80 hover:border-[#d4af37]/50 hover:bg-[#0d1527] transition-all flex flex-col gap-1 shadow-sm group min-w-0"
                          title={`${member.inGameName} | ${cleanName} | ${primaryClass || 'Class'} | ⚡ ${(member.powerLevel || 0).toLocaleString()} PL`}
                        >
                          {/* ROW 1: Rank, Character In-Game Name (FULL WIDTH, PROMINENT), Role, Power Level */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {/* Rank # */}
                              <span className={`text-[10px] font-mono font-bold w-5 text-center shrink-0 ${
                                slotRank === 1
                                  ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                                  : slotRank === 2
                                  ? 'text-slate-200 drop-shadow'
                                  : slotRank === 3
                                  ? 'text-amber-600 drop-shadow'
                                  : 'text-slate-400'
                              }`}>
                                #{slotRank}
                              </span>

                              {/* Member Name */}
                              <span
                                className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-300 transition-colors"
                                title={member.inGameName}
                              >
                                {member.inGameName}
                              </span>
                              {isOwner && (
                                <Crown className="w-3 h-3 text-amber-400 shrink-0" title="Clan Owner" />
                              )}
                              {isAdmin && !isOwner && (
                                <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" title="Admin" />
                              )}
                            </div>

                            {/* Power Level */}
                            <span className="text-[11px] font-mono font-bold text-amber-400 shrink-0 whitespace-nowrap pl-1 text-right">
                              ⚡ {(member.powerLevel || 0).toLocaleString()} <span className="text-[8.5px] text-slate-400 font-normal">PL</span>
                            </span>
                          </div>

                          {/* ROW 2: Clan Badge & Class Badge */}
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/60 min-w-0">
                            {/* Clan Badge */}
                            <span
                              className="text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 border uppercase tracking-wider truncate max-w-[100px]"
                              style={{
                                backgroundColor: `${clanColor}18`,
                                borderColor: `${clanColor}45`,
                                color: clanColor
                              }}
                              title={cleanName}
                            >
                              {cleanName}
                            </span>

                            {/* Class Badge */}
                            {primaryClass && (
                              <div
                                className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-950/40 border border-purple-800/40 shrink-0 min-w-0 max-w-[120px]"
                                title={lang === 'th' ? (meta?.nameTh || primaryClass) : (meta?.nameEn || primaryClass)}
                              >
                                {meta?.icon && (
                                  <img src={meta.icon} alt={meta.nameEn} className="w-3 h-3 object-contain shrink-0" />
                                )}
                                <span className="text-[9.5px] text-purple-300 font-medium truncate">
                                  {lang === 'th' ? (meta?.nameTh || primaryClass) : (meta?.nameEn || primaryClass)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 items-start">
                        {/* Left Column: Ranks 1 to 25 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between px-1.5 pb-0.5 border-b border-slate-800/60 mb-1">
                            <span className="text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]"></span>
                              <span>{lang === 'th' ? `ลำดับ 1 - ${midPoint}` : `Rank 1 - ${midPoint}`}</span>
                            </span>
                            <span className="text-[9.5px] text-slate-500 font-mono">
                              {clanMembers.slice(0, midPoint).length} {lang === 'th' ? 'คน' : 'members'}
                            </span>
                          </div>
                          {leftSlots.map((item) => renderSlotItem(item, 'left'))}
                        </div>

                        {/* Right Column: Ranks 26 to 50 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between px-1.5 pb-0.5 border-b border-slate-800/60 mb-1">
                            <span className="text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]"></span>
                              <span>{lang === 'th' ? `ลำดับ ${midPoint + 1} - ${totalSlots}` : `Rank ${midPoint + 1} - ${totalSlots}`}</span>
                            </span>
                            <span className="text-[9.5px] text-slate-500 font-mono">
                              {clanMembers.slice(midPoint, totalSlots).length} {lang === 'th' ? 'คน' : 'members'}
                            </span>
                          </div>
                          {rightSlots.map((item) => renderSlotItem(item, 'right'))}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          );
        })}

        {/* ─────────────────────────────────────────────────────────────
            4. NO-CLAN / UNASSIGNED BOX (กล่องโนแคลนเหมือนกล่องแคลน)
           ───────────────────────────────────────────────────────────── */}
        {(selectedClanTab === 'all' || selectedClanTab === 'unassigned') && (
          <div
            id="roster-clan-unassigned"
            className="rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border border-slate-800 transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden hover:border-slate-700"
          >
            {/* Clan Header (เหมือนหัวกล่องแคลนทุกประการ) */}
            <div className="p-3.5 sm:p-4 bg-[#0d1422] border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white font-mono text-sm shrink-0 shadow-md border border-white/10"
                  style={{ backgroundColor: '#64748b' }}
                >
                  NC
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold font-cinzel text-slate-100 truncate">
                      {lang === 'th' ? 'ไม่มีแคลน' : 'No Clan'}
                    </h3>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/60 font-semibold shrink-0">
                      {lang === 'th' ? 'รอจัดสรร' : 'Unassigned'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 truncate mt-0.5">
                    <span className="text-slate-300 font-semibold">
                      {unassignedMembers.length} {lang === 'th' ? 'คน' : 'members'}
                    </span>
                    <span>•</span>
                    <span className="text-amber-400 font-mono font-bold">
                      ⚡ {unassignedPower.toLocaleString()} PL
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10px] text-slate-400">{t.avgPower || (lang === 'th' ? 'เฉลี่ย' : 'Avg')}</div>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-200">
                  ⚡ {unassignedMembers.length ? Math.round(unassignedPower / unassignedMembers.length).toLocaleString() : 0}
                </div>
              </div>
            </div>

            {/* Members List - Spacious 2-column unassigned grid */}
            <div className="p-3 sm:p-3.5 flex-1 min-h-[240px]">
              {unassignedMembers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  <UserX className="w-8 h-8 text-slate-600 mb-2 stroke-[1.2]" />
                  <p>{lang === 'th' ? 'ไม่มีสมาชิกที่รอจัดสรร' : 'No unassigned members'}</p>
                </div>
              ) : filteredUnassignedMembers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  <Search className="w-6 h-6 text-slate-600 mb-2" />
                  <p>{lang === 'th' ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'No matching members found'}</p>
                </div>
              ) : (() => {
                  const totalCount = filteredUnassignedMembers.length;
                  const midPoint = Math.ceil(totalCount / 2);
                  const leftMembers = filteredUnassignedMembers.slice(0, midPoint);
                  const rightMembers = filteredUnassignedMembers.slice(midPoint);

                  const renderUnassignedItem = (member: User, slotRank: number) => {
                    const primaryClass = (member.classes && member.classes[0]) || member.characterClass || '';
                    const meta = OFFICIAL_CLASSES.find(
                      (c) =>
                        c.id.toLowerCase() === primaryClass.toLowerCase() ||
                        c.nameEn.toLowerCase() === primaryClass.toLowerCase() ||
                        c.nameTh.toLowerCase().includes(primaryClass.toLowerCase())
                    ) || null;
                    const isOwner = member.role === 'owner';
                    const isAdmin = member.role === 'admin';

                    return (
                      <div
                        key={member.id}
                        className="py-1.5 px-2.5 rounded-xl bg-[#090e1a]/95 border border-slate-800/80 hover:border-amber-500/40 hover:bg-[#0d1527] transition-all flex flex-col gap-1 shadow-sm group min-w-0"
                        title={`${member.inGameName} | ${lang === 'th' ? 'ไม่มีแคลน' : 'No Clan'} | ${primaryClass || 'Class'} | ⚡ ${(member.powerLevel || 0).toLocaleString()} PL`}
                      >
                        {/* ROW 1: Rank, Character In-Game Name (FULL WIDTH, PROMINENT), Role, Power Level */}
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {/* Rank # */}
                            <span className={`text-[10px] font-mono font-bold w-5 text-center shrink-0 ${
                              slotRank === 1
                                ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                                : slotRank === 2
                                ? 'text-slate-200 drop-shadow'
                                : slotRank === 3
                                ? 'text-amber-600 drop-shadow'
                                : 'text-slate-400'
                            }`}>
                              #{slotRank}
                            </span>

                            {/* Member Name */}
                            <span
                              className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-300 transition-colors"
                              title={member.inGameName}
                            >
                              {member.inGameName}
                            </span>
                            {isOwner && (
                              <Crown className="w-3 h-3 text-amber-400 shrink-0" title="Owner" />
                            )}
                            {isAdmin && !isOwner && (
                              <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" title="Admin" />
                            )}
                          </div>

                          {/* Power Level */}
                          <span className="text-[11px] font-mono font-bold text-amber-400 shrink-0 whitespace-nowrap pl-1 text-right">
                            ⚡ {(member.powerLevel || 0).toLocaleString()} <span className="text-[8.5px] text-slate-400 font-normal">PL</span>
                          </span>
                        </div>

                        {/* ROW 2: Clan Badge & Class Badge */}
                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/60 min-w-0">
                          {/* Clan Badge */}
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 border uppercase tracking-wider truncate max-w-[100px]"
                            style={{
                              backgroundColor: '#64748b18',
                              borderColor: '#64748b45',
                              color: '#94a3b8'
                            }}
                            title={lang === 'th' ? 'ไม่มีแคลน' : 'No Clan'}
                          >
                            {lang === 'th' ? 'ไม่มีแคลน' : 'No Clan'}
                          </span>

                          {/* Class Badge */}
                          {primaryClass && (
                            <div
                              className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-950/40 border border-purple-800/40 shrink-0 min-w-0 max-w-[120px]"
                              title={lang === 'th' ? (meta?.nameTh || primaryClass) : (meta?.nameEn || primaryClass)}
                            >
                              {meta?.icon && (
                                <img src={meta.icon} alt={meta.nameEn} className="w-3 h-3 object-contain shrink-0" />
                              )}
                              <span className="text-[9.5px] text-purple-300 font-medium truncate">
                                {lang === 'th' ? (meta?.nameTh || primaryClass) : (meta?.nameEn || primaryClass)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 items-start">
                      {/* Left Column: 1 to midPoint */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1.5 pb-0.5 border-b border-slate-800/60 mb-1">
                          <span className="text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]"></span>
                            <span>{lang === 'th' ? `ลำดับ 1 - ${midPoint}` : `Rank 1 - ${midPoint}`}</span>
                          </span>
                          <span className="text-[9.5px] text-slate-500 font-mono">
                            {leftMembers.length} {lang === 'th' ? 'คน' : 'members'}
                          </span>
                        </div>
                        {leftMembers.map((m, idx) => renderUnassignedItem(m, idx + 1))}
                      </div>

                      {/* Right Column: midPoint + 1 to totalCount */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1.5 pb-0.5 border-b border-slate-800/60 mb-1">
                          <span className="text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]"></span>
                            <span>{lang === 'th' ? `ลำดับ ${midPoint + 1} - ${totalCount}` : `Rank ${midPoint + 1} - ${totalCount}`}</span>
                          </span>
                          <span className="text-[9.5px] text-slate-500 font-mono">
                            {rightMembers.length} {lang === 'th' ? 'คน' : 'members'}
                          </span>
                        </div>
                        {rightMembers.map((m, idx) => renderUnassignedItem(m, midPoint + idx + 1))}
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
