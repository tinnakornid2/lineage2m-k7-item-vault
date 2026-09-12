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
import { ClanGroup, Language, User, cleanClanName, isNoClan } from '../types';
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
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  const [searchQuery, setSearchQuery] = useState('');

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
              <span>{t.tabBulkSwap || (lang === 'th' ? 'จัดสรรแคลน (Bulk Swap)' : 'Bulk Swap')}</span>
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
          3. CLANS & UNASSIGNED POOL GRID
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
        {/* Render Each Visible Clan */}
        {visibleClans.map((clan, idx) => {
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

          return (
            <div
              key={clan.id || cleanName}
              id={`roster-clan-${cleanName}`}
              className="rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border border-slate-800 transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden hover:border-slate-700"
            >
              {/* Clan Header */}
              <div className="p-3.5 bg-[#0d1422] border-b border-slate-800 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white font-mono text-xs shrink-0 shadow-md border border-white/10"
                    style={{ backgroundColor: clanColor }}
                  >
                    {clanInitial}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold font-cinzel text-slate-100 truncate">
                        {cleanName}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                      <span className="text-emerald-400 font-semibold">
                        {clanMembers.length} {lang === 'th' ? 'คน' : 'members'}
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
                  <div className="text-xs font-mono font-semibold text-slate-200">
                    ⚡ {avgPower.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div className="p-3 flex-1 space-y-2 min-h-[180px] max-h-[580px] overflow-y-auto custom-scrollbar">
                {clanMembers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <Shield className="w-8 h-8 text-slate-600 mb-1.5 stroke-[1.2]" />
                    <p>{lang === 'th' ? 'ไม่มีสมาชิกในแคลนนี้' : 'No members in this clan'}</p>
                  </div>
                ) : filteredClanMembers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    <Search className="w-6 h-6 text-slate-600 mb-1.5" />
                    <p>{lang === 'th' ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'No matching members found'}</p>
                  </div>
                ) : (
                  filteredClanMembers.map((member, memberIdx) => {
                    const primaryClass = (member.classes && member.classes[0]) || member.characterClass || '';
                    const isOwner = member.role === 'owner';
                    const isAdmin = member.role === 'admin';

                    return (
                      <div
                        key={member.id}
                        className="p-2.5 rounded-xl bg-[#090e1a]/90 border border-slate-800/90 hover:border-slate-700 transition-all flex items-center justify-between gap-2 shadow-sm group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] font-mono text-slate-500 w-4 text-center shrink-0">
                            {memberIdx + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                              <span className="truncate">{member.inGameName}</span>
                              {Boolean(member.level && member.level > 0) && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono shrink-0">
                                  Lv.{member.level}
                                </span>
                              )}
                              {isOwner && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5" />
                                  <span>Owner</span>
                                </span>
                              )}
                              {isAdmin && !isOwner && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                  <ShieldCheck className="w-2.5 h-2.5" />
                                  <span>Admin</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                              {primaryClass && (
                                <span className="text-purple-300 truncate font-medium">
                                  {primaryClass}
                                </span>
                              )}
                              {primaryClass && <span>•</span>}
                              <span className="text-amber-400 font-mono font-bold shrink-0">
                                ⚡ {(member.powerLevel || 0).toLocaleString()} PL
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {/* ─────────────────────────────────────────────────────────────
            4. NO-CLAN / UNASSIGNED BOX (กล่องโนแคลนเหมือนกล่องแคลน)
           ───────────────────────────────────────────────────────────── */}
        <div
          id="roster-clan-unassigned"
          className="rounded-2xl bg-gradient-to-b from-[#111726] to-[#0a0f19] border border-slate-800 transition-all duration-200 shadow-xl flex flex-col justify-between overflow-hidden hover:border-slate-700"
        >
          {/* Clan Header (เหมือนหัวกล่องแคลนทุกประการ) */}
          <div className="p-3.5 bg-[#0d1422] border-b border-slate-800 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white font-mono text-xs shrink-0 shadow-md border border-white/10"
                style={{ backgroundColor: '#64748b' }}
              >
                NC
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold font-cinzel text-slate-100 truncate">
                    {lang === 'th' ? 'ไม่มีแคลน' : 'No Clan'}
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/60 font-semibold shrink-0">
                    {lang === 'th' ? 'รอจัดสรร' : 'Unassigned'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
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
              <div className="text-xs font-mono font-semibold text-slate-200">
                ⚡ {unassignedMembers.length ? Math.round(unassignedPower / unassignedMembers.length).toLocaleString() : 0}
              </div>
            </div>
          </div>

          {/* Members List (เหมือนรายการสมาชิกในกล่องแคลนทุกประการ) */}
          <div className="p-3 flex-1 space-y-2 min-h-[180px] max-h-[580px] overflow-y-auto custom-scrollbar">
            {unassignedMembers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <Shield className="w-8 h-8 text-slate-600 mb-1.5 stroke-[1.2]" />
                <p>{lang === 'th' ? 'ไม่มีสมาชิกตกค้าง (ทุกคนมีแคลนแล้ว)' : 'No unassigned members'}</p>
              </div>
            ) : filteredUnassignedMembers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <Search className="w-6 h-6 text-slate-600 mb-1.5" />
                <p>{lang === 'th' ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'No matching members found'}</p>
              </div>
            ) : (
              filteredUnassignedMembers.map((member, memberIdx) => {
                const primaryClass = (member.classes && member.classes[0]) || member.characterClass || '';
                const isOwner = member.role === 'owner';
                const isAdmin = member.role === 'admin';

                return (
                  <div
                    key={member.id}
                    className="p-2.5 rounded-xl bg-[#090e1a]/90 border border-slate-800/90 hover:border-slate-700 transition-all flex items-center justify-between gap-2 shadow-sm group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-slate-500 w-4 text-center shrink-0">
                        {memberIdx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                          <span className="truncate">{member.inGameName}</span>
                          {Boolean(member.level && member.level > 0) && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono shrink-0">
                              Lv.{member.level}
                            </span>
                          )}
                          {isOwner && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0 flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" />
                              <span>Owner</span>
                            </span>
                          )}
                          {isAdmin && !isOwner && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0 flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              <span>Admin</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                          {primaryClass && (
                            <span className="text-purple-300 truncate font-medium">
                              {primaryClass}
                            </span>
                          )}
                          {primaryClass && <span>•</span>}
                          <span className="text-amber-400 font-mono font-bold shrink-0">
                            ⚡ {(member.powerLevel || 0).toLocaleString()} PL
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
