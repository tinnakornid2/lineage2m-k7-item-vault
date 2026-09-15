import React, { useState, useMemo } from 'react';
import {
  X,
  Gift,
  CheckCircle,
  Search,
  Users,
  UserCheck,
  Crown,
  AlertCircle,
  Shield,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { Language, User, VaultItem, OFFICIAL_CLASSES } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface DistributeItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: VaultItem | null;
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  initialClaimantUserId?: string;
  onDistribute: (
    itemId: string,
    recipient: { name: string; clan: string; userId?: string }
  ) => Promise<void>;
}

interface RecipientInfo {
  name: string;
  clan: string;
  userId?: string;
  powerLevel?: number;
  characterClass?: string;
  classes?: string[];
  isClaimant?: boolean;
}

export const DistributeItemModal: React.FC<DistributeItemModalProps> = ({
  isOpen,
  onClose,
  item,
  lang,
  allMembers,
  initialClaimantUserId,
  onDistribute
}) => {
  const t = translations[lang];

  const claimants = item?.claimants || [];
  const hasClaimants = claimants.length > 0;

  // Active members only for profile selection
  const activeMembers = useMemo(() => {
    return allMembers.filter((m) => m.status === 'active');
  }, [allMembers]);

  // Group active members by clan
  const membersByClan = useMemo(() => {
    const groups: Record<string, User[]> = {};
    activeMembers.forEach((m) => {
      const clan = m.clan || 'No Clan';
      if (!groups[clan]) groups[clan] = [];
      groups[clan].push(m);
    });
    // Sort members in each clan by powerLevel descending
    Object.keys(groups).forEach((clan) => {
      groups[clan].sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
    });
    return groups;
  }, [activeMembers]);

  // Unique clans for filtering
  const availableClans = useMemo(() => {
    return Object.keys(membersByClan);
  }, [membersByClan]);

  const [mode, setMode] = useState<'claimants' | 'profiles' | 'dropdown'>(() => {
    if (initialClaimantUserId && hasClaimants) return 'claimants';
    return hasClaimants ? 'claimants' : 'dropdown';
  });

  // Selected recipient state
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientInfo | null>(() => {
    if (!item) return null;
    if (initialClaimantUserId && item.claimants) {
      const c = item.claimants.find(
        (cl) =>
          cl.userId === initialClaimantUserId ||
          cl.inGameName.toLowerCase() === initialClaimantUserId.toLowerCase()
      );
      if (c) {
        return {
          name: c.inGameName,
          clan: c.clan || 'No Clan',
          userId: c.userId,
          powerLevel: c.powerLevel,
          isClaimant: true
        };
      }
    }
    return null;
  });

  // Dropdown filter states
  const [selectedClanFilter, setSelectedClanFilter] = useState<string>('all');
  const [selectedMemberDropdownId, setSelectedMemberDropdownId] = useState<string>('');

  // Search & filter for profiles mode
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [clanFilter, setClanFilter] = useState<string>('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !item) return null;

  const classMap = useMemo(() => new Map(OFFICIAL_CLASSES.map((c) => [c.nameEn.toLowerCase(), c])), []);

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

  // Filtered members for profile cards
  const filteredMembers = activeMembers.filter((m) => {
    const matchesClan = clanFilter === 'all' || m.clan === clanFilter;
    const q = searchQuery.trim().toLowerCase();
    const classList = (m.classes && m.classes.length > 0) ? m.classes : (m.characterClass ? [m.characterClass] : []);
    const matchesClass = classList.some((c) => c.toLowerCase().includes(q));
    const matchesQuery =
      !q ||
      m.inGameName.toLowerCase().includes(q) ||
      m.username.toLowerCase().includes(q) ||
      m.clan.toLowerCase().includes(q) ||
      matchesClass;
    return matchesClan && matchesQuery;
  });

  // Members filtered for dropdown mode
  const dropdownMembers = activeMembers.filter((m) => {
    return selectedClanFilter === 'all' || m.clan === selectedClanFilter;
  });

  // Master dropdown change handler (unified for claimants + all clan members)
  const handleMasterDropdownChange = (val: string) => {
    if (!val) {
      setSelectedRecipient(null);
      setSelectedMemberDropdownId('');
      return;
    }
    sounds.playClick();
    if (val.startsWith('claimant:')) {
      const idOrName = val.replace('claimant:', '');
      const c = claimants.find(
        (cl) => cl.userId === idOrName || cl.inGameName === idOrName
      );
      if (c) {
        const foundMember = allMembers.find((mem) => (c.userId && mem.id === c.userId) || mem.inGameName.toLowerCase() === c.inGameName.toLowerCase());
        setSelectedRecipient({
          name: c.inGameName,
          clan: c.clan || 'No Clan',
          userId: c.userId,
          powerLevel: c.powerLevel,
          characterClass: foundMember?.characterClass,
          classes: foundMember?.classes || (foundMember?.characterClass ? [foundMember.characterClass] : []),
          isClaimant: true
        });
      }
    } else if (val.startsWith('member:')) {
      const memberId = val.replace('member:', '');
      const m = activeMembers.find((mem) => mem.id === memberId);
      if (m) {
        setSelectedRecipient({
          name: m.inGameName,
          clan: m.clan || 'No Clan',
          userId: m.id,
          powerLevel: m.powerLevel,
          characterClass: m.characterClass,
          classes: m.classes || (m.characterClass ? [m.characterClass] : []),
          isClaimant: claimants.some(
            (c) => c.userId === m.id || c.inGameName.toLowerCase() === m.inGameName.toLowerCase()
          )
        });
        setSelectedMemberDropdownId(m.id);
      }
    }
  };

  // Select from Claimant Card
  const handleSelectClaimant = (c: { userId?: string; inGameName: string; clan?: string; powerLevel?: number }) => {
    sounds.playClick();
    const foundMember = allMembers.find((mem) => (c.userId && mem.id === c.userId) || mem.inGameName.toLowerCase() === c.inGameName.toLowerCase());
    setSelectedRecipient({
      name: c.inGameName,
      clan: c.clan || 'No Clan',
      userId: c.userId,
      powerLevel: c.powerLevel,
      characterClass: foundMember?.characterClass,
      classes: foundMember?.classes || (foundMember?.characterClass ? [foundMember.characterClass] : []),
      isClaimant: true
    });
  };

  // Select from Member Profile Card
  const handleSelectMember = (m: User) => {
    sounds.playClick();
    setSelectedRecipient({
      name: m.inGameName,
      clan: m.clan || 'No Clan',
      userId: m.id,
      powerLevel: m.powerLevel,
      characterClass: m.characterClass,
      classes: m.classes || (m.characterClass ? [m.characterClass] : []),
      isClaimant: claimants.some(
        (c) => c.userId === m.id || c.inGameName.toLowerCase() === m.inGameName.toLowerCase()
      )
    });
    setSelectedMemberDropdownId(m.id);
  };

  // Select from dedicated Dropdown tab
  const handleDropdownMemberSelect = (memberId: string) => {
    setSelectedMemberDropdownId(memberId);
    if (!memberId) {
      setSelectedRecipient(null);
      return;
    }
    sounds.playClick();
    const m = activeMembers.find((mem) => mem.id === memberId);
    if (m) {
      setSelectedRecipient({
        name: m.inGameName,
        clan: m.clan || 'No Clan',
        userId: m.id,
        powerLevel: m.powerLevel,
        characterClass: m.characterClass,
        classes: m.classes || (m.characterClass ? [m.characterClass] : []),
        isClaimant: claimants.some(
          (c) => c.userId === m.id || c.inGameName.toLowerCase() === m.inGameName.toLowerCase()
        )
      });
    }
  };

  // Compute master dropdown value for syncing
  const currentDropdownValue = useMemo(() => {
    if (!selectedRecipient) return '';
    if (selectedRecipient.isClaimant) {
      if (selectedRecipient.userId) return `claimant:${selectedRecipient.userId}`;
      return `claimant:${selectedRecipient.name}`;
    }
    if (selectedRecipient.userId) {
      return `member:${selectedRecipient.userId}`;
    }
    const matched = activeMembers.find(
      (m) => m.inGameName.toLowerCase() === selectedRecipient.name.toLowerCase()
    );
    if (matched) return `member:${matched.id}`;
    return '';
  }, [selectedRecipient, activeMembers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedRecipient || !selectedRecipient.name.trim()) {
      setError(
        lang === 'th'
          ? 'กรุณาเลือกชื่อผู้รับไอเทมจากดรอปดาวน์'
          : 'Please select a recipient from the dropdown'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      sounds.playMythicFanfare();
      const recipientPayload: { name: string; clan: string; userId?: string } = {
        name: selectedRecipient.name.trim(),
        clan: selectedRecipient.clan.trim() || 'No Clan'
      };
      if (selectedRecipient.userId) {
        recipientPayload.userId = selectedRecipient.userId;
      }

      await onDistribute(item.id, recipientPayload);
      onClose();
    } catch (err: any) {
      console.error('Error distributing item:', err);
      setError(
        lang === 'th'
          ? `เกิดข้อผิดพลาดในการแจกไอเทม: ${err?.message || 'โปรดลองอีกครั้ง'}`
          : `Error distributing item: ${err?.message || 'Please try again'}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-gradient-to-b from-[#182338] via-[#0f1728] to-[#080d17] border border-[#d4af37]/50 shadow-2xl p-5 sm:p-6 text-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Close Button */}
        <button
          id="btn-close-distribute-modal"
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-3.5 pb-3 border-b border-slate-800">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#d4af37]/25 to-[#aa841c]/10 border border-[#d4af37]/50 text-[#f5d77f] shrink-0 shadow-md">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#fff2b8] via-[#f5d77f] to-[#d4af37]">
              {t.distributeItemBtn}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-200">{item.name}</span>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                  x{item.quantity || 1}
                </span>
              </div>
              <span>•</span>
              <span className="text-[#f5d77f] font-mono">{item.rarity}</span>
              <span>•</span>
              <span>💎 {item.price.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Master Quick Dropdown Selector (No typing required) */}
        <div className="mb-3 p-3 rounded-xl bg-[#090e1a] border-2 border-amber-500/50 shadow-inner">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>{t.selectRecipientDropdown}</span>
            </label>
            {selectedRecipient && (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {selectedRecipient.name} ({selectedRecipient.clan})
              </span>
            )}
          </div>
          <select
            id="select-distribute-master-dropdown"
            value={currentDropdownValue}
            onChange={(e) => handleMasterDropdownChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[#111726] border border-amber-500/70 hover:border-amber-400 text-xs sm:text-sm text-slate-100 font-medium focus:border-[#d4af37] focus:outline-none cursor-pointer"
          >
            <option value="">
              {lang === 'th'
                ? '-- คลิกเลือกชื่อผู้รับที่นี่ (ดรอปดาวน์ ไม่ต้องพิมพ์) --'
                : '-- Select recipient from dropdown (No typing) --'}
            </option>
            {claimants.length > 0 && (
              <optgroup
                label={
                  lang === 'th'
                    ? `⚡ ผู้ลงชื่อเครม (${claimants.length} คน)`
                    : `⚡ Claimants (${claimants.length})`
                }
              >
                {claimants.map((c, idx) => (
                  <option key={`c-${idx}`} value={`claimant:${c.userId || c.inGameName}`}>
                    ★ [ผู้เครม] {c.inGameName} ({c.clan || 'No Clan'}) - ⚡ {(c.powerLevel || 0).toLocaleString()} PL
                  </option>
                ))}
              </optgroup>
            )}
            {(Object.entries(membersByClan) as [string, User[]][]).map(([clanName, members]) => (
              <optgroup key={clanName} label={`🛡️ ${clanName} (${members.length} คน)`}>
                {members.map((m) => {
                  const mClasses = (m.classes && m.classes.length > 0) ? m.classes : (m.characterClass ? [m.characterClass] : []);
                  return (
                    <option key={m.id} value={`member:${m.id}`}>
                      {m.inGameName} | {m.clan} {m.powerLevel ? `(⚡ ${(m.powerLevel).toLocaleString()} PL)` : ''} {mClasses.length > 0 ? `• ${mClasses.join(', ')}` : ''}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 mb-3 rounded-xl bg-[#090e1a] border border-slate-800 text-xs">
          {/* Tab 1: Dropdown Mode (Pure Dropdown, no typing) */}
          <button
            type="button"
            id="tab-mode-dropdown"
            onClick={() => {
              sounds.playClick();
              setMode('dropdown');
            }}
            className={`py-2 px-1 text-center font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'dropdown'
                ? 'bg-[#1e2c44] text-[#f5d77f] border border-[#d4af37]/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="truncate">{t.selectFromDropdown}</span>
          </button>

          {/* Tab 2: From Claimants */}
          <button
            type="button"
            id="tab-mode-claimants"
            onClick={() => {
              sounds.playClick();
              setMode('claimants');
            }}
            className={`py-2 px-1 text-center font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'claimants'
                ? 'bg-[#1e2c44] text-[#f5d77f] border border-[#d4af37]/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="truncate">{t.chooseFromClaimants}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono">
              {claimants.length}
            </span>
          </button>

          {/* Tab 3: Member Profile Cards */}
          <button
            type="button"
            id="tab-mode-profiles"
            onClick={() => {
              sounds.playClick();
              setMode('profiles');
            }}
            className={`py-2 px-1 text-center font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'profiles'
                ? 'bg-[#1e2c44] text-[#f5d77f] border border-[#d4af37]/50 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="truncate">{t.chooseFromProfiles}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          
          {/* TAB 1: Dropdown Mode (All Clan Members Dropdown, No typing needed) */}
          {mode === 'dropdown' && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[190px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Clan Filter Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? '1. กรองตามแคลน (Clan Filter)' : '1. Filter by Clan'}
                  </label>
                  <select
                    id="select-distribute-clan-filter"
                    value={selectedClanFilter}
                    onChange={(e) => {
                      setSelectedClanFilter(e.target.value);
                      setSelectedMemberDropdownId('');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#090e1a] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="all">{lang === 'th' ? 'ทุกแคลน (All Clans)' : 'All Clans'}</option>
                    {availableClans.map((c) => (
                      <option key={c} value={c}>
                        🛡️ {c} ({membersByClan[c]?.length || 0} คน)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Character Name Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'th' ? '2. เลือกชื่อตัวละครผู้รับ (Character Name)' : '2. Select Character Name'} *
                  </label>
                  <select
                    id="select-distribute-member-dropdown"
                    value={selectedMemberDropdownId}
                    onChange={(e) => handleDropdownMemberSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#090e1a] border border-amber-500/70 focus:border-[#d4af37] text-slate-100 text-xs focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="">
                      {lang === 'th'
                        ? '-- คลิกเลือกตัวละคร (ไม่ต้องพิมพ์) --'
                        : '-- Select character (No typing) --'}
                    </option>
                    {dropdownMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.inGameName} | {m.clan} {m.powerLevel ? `(⚡ ${(m.powerLevel).toLocaleString()} PL)` : ''} {m.characterClass ? `• ${m.characterClass}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Character Details Preview Card */}
              {selectedRecipient ? (() => {
                const recClasses = (selectedRecipient.classes && selectedRecipient.classes.length > 0)
                  ? selectedRecipient.classes
                  : (selectedRecipient.characterClass ? [selectedRecipient.characterClass] : []);
                const firstMeta = recClasses.length > 0 ? getClassMeta(recClasses[0]) : null;

                return (
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#1b273d] to-[#111929] border border-[#d4af37]/60 shadow-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        {lang === 'th' ? 'ข้อมูลตัวละครผู้รับที่เลือก' : 'Selected Recipient Preview'}
                      </span>
                      {selectedRecipient.isClaimant && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          ⚡ {lang === 'th' ? 'ลงชื่อเครมไว้' : 'Claimant'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-800 border border-[#d4af37]/50 p-1 flex items-center justify-center shrink-0 shadow">
                        {firstMeta ? (
                          <img src={firstMeta.icon} alt={firstMeta.nameEn} className="w-full h-full object-contain" />
                        ) : (
                          <span className="font-bold text-sm text-[#d4af37]">L2</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="truncate">{selectedRecipient.name}</span>
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                            {selectedRecipient.clan}
                          </span>
                        </div>
                        <div className="text-xs text-amber-400 font-mono mt-0.5">
                          {selectedRecipient.powerLevel ? `⚡ ${selectedRecipient.powerLevel.toLocaleString()} PL` : ''}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {recClasses.length > 0 ? (
                            recClasses.map((clsName, idx) => {
                              const meta = getClassMeta(clsName);
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-200 border border-slate-700/80"
                                >
                                  {meta && <img src={meta.icon} alt={meta.nameEn} className="w-3.5 h-3.5 object-contain" />}
                                  <span>{meta?.nameEn || clsName}</span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="p-5 rounded-xl bg-[#090e1a]/80 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  <UserCheck className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                  <p>{lang === 'th' ? 'เลือกชื่อตัวละครจากดรอปดาวน์ด้านบน เพื่อเตรียมแจกไอเทม' : 'Select a character from the dropdown above'}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: From Claimants */}
          {mode === 'claimants' && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[190px]">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.selectRecipient} *
              </label>

              {!hasClaimants ? (
                <div className="p-6 rounded-xl bg-[#090e1a]/80 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  <Users className="w-7 h-7 mx-auto mb-2 text-slate-600 opacity-60" />
                  <p>{t.noClaimantsYet}</p>
                  <button
                    type="button"
                    onClick={() => setMode('dropdown')}
                    className="mt-3 text-xs text-[#f5d77f] hover:underline font-bold"
                  >
                    👉 {t.selectFromDropdown}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {claimants.map((c, idx) => {
                    const isSelected =
                      selectedRecipient?.name.toLowerCase() === c.inGameName.toLowerCase();
                    const claimantMember = allMembers.find(
                      (m) =>
                        (c.userId && m.id === c.userId) ||
                        m.inGameName.toLowerCase() === c.inGameName.toLowerCase()
                    );
                    const cClasses = (claimantMember?.classes && claimantMember.classes.length > 0)
                      ? claimantMember.classes
                      : (claimantMember?.characterClass ? [claimantMember.characterClass] : (c.characterClass ? [c.characterClass] : []));
                    const firstMeta = cClasses.length > 0 ? getClassMeta(cClasses[0]) : null;

                    return (
                      <div
                        key={c.userId || `c-${idx}`}
                        onClick={() => handleSelectClaimant(c)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#1e2c46] border-[#d4af37] text-white shadow-lg'
                            : 'bg-[#090e1a] border-slate-800 text-slate-300 hover:bg-[#111929]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center p-1 shrink-0 ${
                              isSelected
                                ? 'bg-[#d4af37]/25 border border-[#d4af37]'
                                : 'bg-slate-800/90 border border-slate-700'
                            }`}
                          >
                            {firstMeta ? (
                              <img src={firstMeta.icon} alt={firstMeta.nameEn} className="w-full h-full object-contain" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold flex items-center gap-2 truncate">
                              <span className="text-slate-100">{c.inGameName}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                                {c.clan}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[11px] text-amber-400 font-mono font-medium">
                                ⚡ {(c.powerLevel || 0).toLocaleString()} PL
                              </span>
                              {cClasses.map((clsName, cIdx) => {
                                const meta = getClassMeta(clsName);
                                return (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60"
                                  >
                                    {meta && <img src={meta.icon} alt={meta.nameEn} className="w-3 h-3 object-contain" />}
                                    <span>{meta?.nameEn || clsName}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle className="w-5 h-5 text-[#d4af37] shrink-0 ml-2" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Member Profile Cards */}
          {mode === 'profiles' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
              {/* Search & Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t.searchMemberPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[#090e1a] border border-slate-700 text-slate-200 focus:outline-none focus:border-[#d4af37]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Clan Filter Dropdown */}
                {availableClans.length > 1 && (
                  <select
                    value={clanFilter}
                    onChange={(e) => setClanFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-[#090e1a] border border-slate-700 text-slate-300 focus:outline-none focus:border-[#d4af37] cursor-pointer"
                  >
                    <option value="all">{lang === 'th' ? 'ทุกแคลน' : 'All Clans'}</option>
                    {availableClans.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Members List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[170px] max-h-[220px]">
                {filteredMembers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-[#090e1a] border border-slate-800">
                    {lang === 'th' ? 'ไม่พบสมาชิกตามคำค้นหา' : 'No members found'}
                  </div>
                ) : (
                  filteredMembers.map((m) => {
                    const isSelected =
                      selectedRecipient?.name.toLowerCase() === m.inGameName.toLowerCase();
                    const memberClasses = (m.classes && m.classes.length > 0)
                      ? m.classes
                      : (m.characterClass ? [m.characterClass] : []);
                    const firstMeta = memberClasses.length > 0 ? getClassMeta(memberClasses[0]) : null;

                    return (
                      <div
                        key={m.id}
                        id={`member-select-${m.id}`}
                        onClick={() => handleSelectMember(m)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#1e2c46] border-[#d4af37] text-white shadow-md'
                            : 'bg-[#090e1a] border-slate-800/80 text-slate-300 hover:bg-[#121927]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center p-1 shrink-0 ${
                              isSelected
                                ? 'bg-[#d4af37]/20 border border-[#d4af37]'
                                : 'bg-[#141d2e] border border-slate-800'
                            }`}
                          >
                            {firstMeta ? (
                              <img src={firstMeta.icon} alt={firstMeta.nameEn} className="w-full h-full object-contain" />
                            ) : (
                              <span className="font-bold text-xs text-slate-400">L2</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                              <span className="text-slate-100">{m.inGameName}</span>
                              {m.role === 'owner' && (
                                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 truncate">
                                {m.clan}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-amber-400 font-mono text-[11px] font-medium">
                                ⚡ {(m.powerLevel || 0).toLocaleString()} PL
                              </span>
                              {memberClasses.map((clsName, cIdx) => {
                                const meta = getClassMeta(clsName);
                                return (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60"
                                  >
                                    {meta && <img src={meta.icon} alt={meta.nameEn} className="w-3 h-3 object-contain" />}
                                    <span>{meta?.nameEn || clsName}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <CheckCircle className="w-5 h-5 text-[#d4af37] shrink-0 ml-2" />
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded bg-[#162235] text-slate-400 hover:text-white border border-slate-700 shrink-0 ml-2">
                            {lang === 'th' ? 'เลือก' : 'Select'}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Selected Recipient Confirmation Bar */}
          {selectedRecipient && (
            <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-[#142032] to-[#0e1726] border border-[#d4af37]/60 flex items-center justify-between text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#d4af37] shrink-0" />
                <span>
                  {lang === 'th' ? 'ผู้รับที่เลือก:' : 'Selected recipient:'}{' '}
                  <strong className="text-[#f5d77f] font-bold">
                    {selectedRecipient.name}
                  </strong>{' '}
                  <span className="text-slate-400">({selectedRecipient.clan})</span>
                </span>
              </div>
              {selectedRecipient.powerLevel ? (
                <span className="text-amber-400 font-mono font-bold">
                  ⚡ {selectedRecipient.powerLevel.toLocaleString()} PL
                </span>
              ) : null}
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="flex justify-end gap-2.5 pt-3 mt-3 border-t border-slate-800">
            <button
              type="button"
              id="btn-cancel-distribute"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              id="btn-confirm-distribute"
              type="submit"
              disabled={isSubmitting || !selectedRecipient}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#e6be44] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? t.loading
                  : selectedRecipient
                  ? `${t.distributeItemBtn} (${selectedRecipient.name})`
                  : t.distributeItemBtn}
              </span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
