import React, { useState, useMemo } from 'react';
import {
  X,
  Award,
  Users,
  Shield,
  Gem,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  TrendingUp,
  BarChart3,
  Crosshair,
  Crown
} from 'lucide-react';
import { VaultItem, User, Language, cleanClanName } from '../types';
import { sounds } from '../utils/sound';

interface DistributionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultItems: VaultItem[];
  allMembers: User[];
  lang: Language;
}

export const DistributionStatsModal: React.FC<DistributionStatsModalProps> = ({
  isOpen,
  onClose,
  vaultItems,
  allMembers,
  lang
}) => {
  const [activeTab, setActiveTab] = useState<'receivers' | 'pending' | 'hunters' | 'clans'>('receivers');
  const [copied, setCopied] = useState(false);

  // Filter only distributed items
  const distributedItems = useMemo(
    () => vaultItems.filter((item) => item.status === 'distributed' || Boolean(item.distributedTo?.name || item.distributedTo?.userId)),
    [vaultItems]
  );

  // Total diamonds of distributed items
  const totalDistributedDiamonds = useMemo(
    () => distributedItems.reduce((acc, item) => acc + (item.price || 0), 0),
    [distributedItems]
  );

  // Group by Recipient
  const recipientStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        clan: string;
        itemCount: number;
        totalDiamonds: number;
        items: { name: string; rarity: string; price: number; date?: number }[];
      }
    >();

    distributedItems.forEach((item) => {
      const recName = item.distributedTo?.name || 'Unknown';
      const clan = cleanClanName(item.distributedTo?.clan) || 'No Clan';
      const existing = map.get(recName.toLowerCase()) || {
        name: recName,
        clan,
        itemCount: 0,
        totalDiamonds: 0,
        items: []
      };

      existing.itemCount += 1;
      existing.totalDiamonds += item.price || 0;
      existing.items.push({
        name: item.name,
        rarity: item.rarity,
        price: item.price,
        date: item.distributedTo?.distributedAt
      });

      map.set(recName.toLowerCase(), existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalDiamonds - a.totalDiamonds || b.itemCount - a.itemCount);
  }, [distributedItems]);

  // Members who have received zero items
  const zeroItemMembers = useMemo(() => {
    const receivedNamesSet = new Set(
      distributedItems.map((i) => (i.distributedTo?.name || '').trim().toLowerCase())
    );

    return allMembers
      .filter((m) => m.status === 'approved' && !receivedNamesSet.has(m.inGameName.trim().toLowerCase()))
      .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  }, [distributedItems, allMembers]);

  // Hunter Participation Stats (from all vault items hunters lists)
  const hunterStats = useMemo(() => {
    const map = new Map<string, { name: string; clan: string; huntCount: number }>();

    vaultItems.forEach((item) => {
      if (Array.isArray(item.hunters)) {
        item.hunters.forEach((h) => {
          const hName = (h.name || '').trim();
          if (!hName) return;
          const key = hName.toLowerCase();
          const existing = map.get(key) || {
            name: hName,
            clan: cleanClanName(h.clan) || 'Unknown Clan',
            huntCount: 0
          };
          existing.huntCount += 1;
          map.set(key, existing);
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.huntCount - a.huntCount);
  }, [vaultItems]);

  // Clan distribution share
  const clanShare = useMemo(() => {
    const map = new Map<string, { clan: string; itemCount: number; totalDiamonds: number }>();

    distributedItems.forEach((item) => {
      const clanName = cleanClanName(item.distributedTo?.clan) || 'Alliance';
      const existing = map.get(clanName) || { clan: clanName, itemCount: 0, totalDiamonds: 0 };
      existing.itemCount += 1;
      existing.totalDiamonds += item.price || 0;
      map.set(clanName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalDiamonds - a.totalDiamonds);
  }, [distributedItems]);

  // Copy summary to clipboard
  const handleCopySummary = () => {
    sounds.playClick();
    const isTh = lang === 'th';
    const text = isTh
      ? [
          `📊 **[K7-VAULT] รายงานสถิติการแจกไอเทม & ความยุติธรรม**`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `📦 แจกแล้วทั้งหมด: ${distributedItems.length} ชิ้น`,
          `💎 มูลค่าเพชรรวม: ${totalDistributedDiamonds.toLocaleString()} Diamonds`,
          `👥 สมาชิกที่ได้รับของแล้ว: ${recipientStats.length} คน`,
          `⏳ สมาชิกที่ยังไม่เคยได้รับ: ${zeroItemMembers.length} คน`,
          ``,
          `🏆 **Top 5 สมาชิกที่ได้รับไอเทมมูลค่าสูงสุด:**`,
          ...recipientStats.slice(0, 5).map((r, i) => `${i + 1}. **${r.name}** (${cleanClanName(r.clan)}): ${r.itemCount} ชิ้น | ${r.totalDiamonds.toLocaleString()} 💎`),
          ``,
          `🎯 **Top 5 นักล่าบอสที่ร่วมกิจกรรมมากที่สุด:**`,
          ...hunterStats.slice(0, 5).map((h, i) => `${i + 1}. **${h.name}** (${cleanClanName(h.clan)}): ${h.huntCount} รอบ`),
          `━━━━━━━━━━━━━━━━━━━━`,
          `🔗 อัปเดตล่าสุด: ${new Date().toLocaleDateString('th-TH')}`
        ].join('\n')
      : [
          `📊 **[K7-VAULT] Item Distribution & Fair Play Report**`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `📦 Total Items Distributed: ${distributedItems.length} pcs`,
          `💎 Total Diamond Value: ${totalDistributedDiamonds.toLocaleString()} Diamonds`,
          `👥 Members Received Items: ${recipientStats.length} members`,
          `⏳ Members Yet to Receive: ${zeroItemMembers.length} members`,
          ``,
          `🏆 **Top 5 Members with Highest Item Value:**`,
          ...recipientStats.slice(0, 5).map((r, i) => `${i + 1}. **${r.name}** (${cleanClanName(r.clan)}): ${r.itemCount} items | ${r.totalDiamonds.toLocaleString()} 💎`),
          ``,
          `🎯 **Top 5 Boss Hunters (Most Active):**`,
          ...hunterStats.slice(0, 5).map((h, i) => `${i + 1}. **${h.name}** (${cleanClanName(h.clan)}): ${h.huntCount} runs`),
          `━━━━━━━━━━━━━━━━━━━━`,
          `🔗 Latest Update: ${new Date().toLocaleDateString('en-US')}`
        ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    sounds.playSuccess();
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      id="distribution-stats-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0c1322] border border-slate-700 shadow-2xl overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#0d1627] to-[#0a101d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <span>{lang === 'th' ? 'สถิติความยุติธรรมและการแจกจ่าย' : 'Distribution & Fairness Statistics'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'ตรวจสอบความโปร่งใส สรุปยอดผู้ได้รับ และสมาชิกที่ยังรอคอยการแจก'
                  : 'Transparency audit: items received, diamonds awarded, and awaiting members'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#172338] hover:bg-[#20314f] border border-slate-700 hover:border-amber-400/60 text-slate-200 text-xs font-bold transition-all cursor-pointer shadow"
              title={lang === 'th' ? 'คัดลอกสรุปสถิติลงคลิปบอร์ด' : 'Copy stats to clipboard'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span>{copied ? (lang === 'th' ? 'คัดลอกแล้ว!' : 'Copied!') : (lang === 'th' ? 'คัดลอกสรุป' : 'Copy')}</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Highlights Metric Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 sm:p-5 bg-[#080d17] border-b border-slate-800/80">
          
          <div className="p-3 rounded-xl bg-[#0f172a]/60 border border-slate-800 flex flex-col">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'th' ? 'แจกแล้วทั้งหมด' : 'Items Distributed'}</span>
            </span>
            <span className="text-xl font-bold font-mono text-slate-100 mt-1">
              {distributedItems.length} <span className="text-xs font-normal text-slate-400">{lang === 'th' ? 'ชิ้น' : 'items'}</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0f172a]/60 border border-slate-800 flex flex-col">
            <span className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
              <Gem className="w-3.5 h-3.5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
              <span>{lang === 'th' ? 'มูลค่าเพชรรวม' : 'Total Diamonds'}</span>
            </span>
            <span className="text-xl font-bold font-mono text-white mt-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]">
              {totalDistributedDiamonds.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0f172a]/60 border border-slate-800 flex flex-col">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'th' ? 'สมาชิกที่ได้ของ' : 'Members Awarded'}</span>
            </span>
            <span className="text-xl font-bold font-mono text-emerald-300 mt-1">
              {recipientStats.length} <span className="text-xs font-normal text-slate-400">/ {allMembers.length}</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0f172a]/60 border border-slate-800 flex flex-col">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{lang === 'th' ? 'ยังไม่ได้รับของ' : 'Awaiting Items'}</span>
            </span>
            <span className="text-xl font-bold font-mono text-rose-300 mt-1">
              {zeroItemMembers.length} <span className="text-xs font-normal text-slate-400">{lang === 'th' ? 'คน' : 'members'}</span>
            </span>
          </div>

        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-5 pt-3 border-b border-slate-800 bg-[#0b101c] overflow-x-auto">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('receivers');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'receivers'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'ผู้ได้รับไอเทม (Top Receivers)' : 'Top Receivers'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
              {recipientStats.length}
            </span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('pending');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'border-rose-400 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'ยังไม่เคยได้รับ (ควรพิจารณา)' : 'Awaiting First Item'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950/80 text-rose-300 font-mono border border-rose-800/60">
              {zeroItemMembers.length}
            </span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('hunters');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'hunters'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'สถิตินักล่าบอส (Top Hunters)' : 'Top Hunters'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
              {hunterStats.length}
            </span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('clans');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'clans'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'สัดส่วนตามแคลน (Clan Share)' : 'Clan Share'}</span>
          </button>
        </div>

        {/* Tab Body Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          
          {/* TAB 1: TOP RECEIVERS */}
          {activeTab === 'receivers' && (
            <div className="space-y-2">
              {recipientStats.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {lang === 'th' ? 'ยังไม่มีประวัติการแจกไอเทม' : 'No distributed items yet'}
                </div>
              ) : (
                recipientStats.map((rec, idx) => (
                  <div
                    key={rec.name}
                    className="p-3 rounded-xl bg-[#0f1626]/80 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold font-mono text-xs ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60'
                            : idx === 1
                            ? 'bg-slate-300/20 text-slate-200 border border-slate-400/60'
                            : idx === 2
                            ? 'bg-amber-700/20 text-amber-400 border border-amber-700/60'
                            : 'bg-slate-900 text-slate-500'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                          <span>{rec.name}</span>
                          <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {cleanClanName(rec.clan)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {rec.items.map((it) => it.name).join(' • ')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-200">
                          {rec.itemCount} <span className="text-[10px] text-slate-400 font-normal">{lang === 'th' ? 'ชิ้น' : 'items'}</span>
                        </div>
                        <div className="text-xs font-mono font-bold text-[#38bdf8]">
                          {rec.totalDiamonds.toLocaleString()} 💎
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: AWAITING FIRST ITEM (Fairness priority list) */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {lang === 'th' ? 'รายชื่อสมาชิกที่ยังไม่เคยได้รับไอเทมจากคลัง' : 'Members who have not received any item yet'}
                  </p>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    {lang === 'th'
                      ? 'เรียงตามลำดับค่าพลังรบ (CP) สูงไปต่ำ เพื่อให้หัวหน้ากิลด์พิจารณาความยุติธรรมและจัดสรรให้ในรอบถัดไป'
                      : 'Sorted by Combat Power (CP) descending to help leaders maintain distribution fairness.'}
                  </p>
                </div>
              </div>

              {zeroItemMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-emerald-400 font-bold">
                  {lang === 'th' ? '🎉 ยอดเยี่ยมมาก! สมาชิกทุกคนในกิลด์ได้รับไอเทมครบถ้วนแล้ว' : 'All members have received at least one item!'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {zeroItemMembers.map((m, idx) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-[#0e1524] border border-slate-800/90 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono text-slate-500 w-5 text-right">{idx + 1}.</span>
                        <div>
                          <div className="font-bold text-slate-200 text-xs">{m.inGameName}</div>
                          <div className="text-[10px] text-slate-400">{cleanClanName(m.clan) || 'No Clan'} • {m.characterClass || 'Adventurer'}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-amber-400">
                          ⚡ {m.powerLevel ? m.powerLevel.toLocaleString() : '0'} PL
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/60 font-semibold">
                          {lang === 'th' ? 'ยังไม่ได้ของ' : '0 Items'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TOP BOSS HUNTERS */}
          {activeTab === 'hunters' && (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 text-xs text-sky-200 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  {lang === 'th'
                    ? 'วิเคราะห์ความขยันจากการเข้าร่วมล่าบอส (สแกนจากภาพหลักฐานในคลัง)'
                    : 'Hunter participation frequency parsed from vault item boss hunt screenshots.'}
                </span>
              </div>

              {hunterStats.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {lang === 'th' ? 'ไม่มีข้อมูลผู้ล่าบอส' : 'No hunter records found'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {hunterStats.map((h, idx) => (
                    <div
                      key={h.name}
                      className="p-3 rounded-xl bg-[#0e1524] border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center font-bold font-mono text-[11px] ${
                            idx < 3 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-slate-900 text-slate-500'
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200 text-xs">{h.name}</div>
                          <div className="text-[10px] text-slate-400">{cleanClanName(h.clan)}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          {h.huntCount} <span className="text-[10px] text-slate-400 font-normal">{lang === 'th' ? 'รอบ' : 'hunts'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLAN SHARE */}
          {activeTab === 'clans' && (
            <div className="space-y-3">
              {clanShare.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {lang === 'th' ? 'ไม่มีข้อมูลการแจกจ่าย' : 'No clan distribution data'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clanShare.map((c) => {
                    const percent = totalDistributedDiamonds > 0
                      ? Math.round((c.totalDiamonds / totalDistributedDiamonds) * 100)
                      : 0;
                    return (
                      <div key={c.clan} className="p-3.5 rounded-xl bg-[#0e1524] border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="font-bold text-slate-200 flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-amber-400" />
                            <span>{cleanClanName(c.clan)}</span>
                          </div>
                          <div className="font-mono text-slate-300 font-bold">
                            {c.itemCount} {lang === 'th' ? 'ชิ้น' : 'items'} • {c.totalDiamonds.toLocaleString()} 💎 ({percent}%)
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percent, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#090e18] flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {lang === 'th' ? 'ระบบ Lineage 2M Clan Hub' : 'Lineage 2M Clan Hub System'}
          </span>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors"
          >
            {lang === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
