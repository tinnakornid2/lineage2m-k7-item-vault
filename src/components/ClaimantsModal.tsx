import React from 'react';
import {
  X,
  Users,
  Gift,
  Trash2,
  Clock,
  Shield,
  Sparkles,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { Language, User, VaultItem, Claimant, OFFICIAL_CLASSES } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface ClaimantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: VaultItem | null;
  lang: Language;
  currentUser: User | null;
  allMembers?: User[];
  onUnclaim: (
    itemId: string,
    targetUserId?: string,
    targetInGameName?: string
  ) => Promise<void>;
  onDistributeToClaimant?: (item: VaultItem, claimant: Claimant) => void;
}

export const ClaimantsModal: React.FC<ClaimantsModalProps> = ({
  isOpen,
  onClose,
  item,
  lang,
  currentUser,
  allMembers = [],
  onUnclaim,
  onDistributeToClaimant
}) => {
  const t = translations[lang];
  const [isProcessing, setIsProcessing] = React.useState(false);

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

  if (!isOpen || !item) return null;

  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

  const claimants = item.claimants || [];
  const userClaimant = currentUser
    ? claimants.find(
        (c) =>
          (c.userId && c.userId === currentUser.id) ||
          (c.inGameName &&
            currentUser.inGameName &&
            c.inGameName.trim().toLowerCase() ===
              currentUser.inGameName.trim().toLowerCase())
      )
    : null;

  const handleCancelClaim = async (
    targetUserId?: string,
    targetInGameName?: string
  ) => {
    try {
      setIsProcessing(true);
      sounds.playClick();
      await onUnclaim(item.id, targetUserId, targetInGameName);
    } catch (err) {
      console.error('Failed to cancel claim:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'MYTHIC':
        return 'bg-amber-500/25 text-amber-200 border-[#ffb800] glow-mythic';
      case 'LAGEND':
        return 'bg-[#8500fd]/25 text-[#e0b0ff] border-[#8500fd] glow-legend';
      case 'EPIC':
        return 'bg-red-500/25 text-red-200 border-[#ff1744] glow-epic';
      case 'RARE':
      default:
        return 'bg-cyan-500/25 text-cyan-200 border-[#00e5ff] glow-rare';
    }
  };

  const getRarityTextGlow = (rarity: string) => {
    switch (rarity) {
      case 'MYTHIC':
        return 'font-glow-mythic';
      case 'LAGEND':
        return 'font-glow-legend';
      case 'EPIC':
        return 'font-glow-epic';
      case 'RARE':
      default:
        return 'font-glow-rare';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-b from-[#162035] via-[#0d1424] to-[#070b14] border border-[#d4af37]/40 shadow-2xl p-5 sm:p-6 text-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Close button */}
        <button
          id="btn-close-claimants-modal"
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4 pb-4 border-b border-slate-800">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-[#090e1a] border border-[#d4af37]/40 shrink-0 shadow-lg">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Shield className="w-6 h-6" />
              </div>
            )}
            <span
              className={`absolute bottom-0 inset-x-0 text-[8px] text-center font-bold uppercase py-0.5 tracking-wider border-t ${getRarityBadge(
                item.rarity
              )}`}
            >
              {item.rarity}
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base sm:text-lg font-bold text-slate-100 truncate ${getRarityTextGlow(item.rarity)}`}>
                {item.name}
              </h2>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 shrink-0">
                x{item.quantity || 1}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${getRarityBadge(item.rarity)}`}>
                {item.rarity}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
              <span className="text-amber-400 font-mono font-medium">
                {item.price > 0 ? `💎 ${item.price.toLocaleString()} ${t.diamonds}` : (lang === 'th' ? '🎁 ฟรี (0 เพชร)' : '🎁 FREE (0 Diamonds)')}
              </span>
              <span>•</span>
              <span>
                {lang === 'th' ? 'เกณฑ์พลังขั้นต่ำ:' : 'Min PL:'}{' '}
                <strong className="text-slate-200 font-mono">
                  ⚡ {item.minPowerLevel.toLocaleString()} PL
                </strong>
              </span>
              <span>•</span>
              <span className="text-sky-300 font-bold flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {claimants.length} {lang === 'th' ? 'คนลงชื่อ' : 'claimants'}
              </span>
            </div>
          </div>
        </div>

        {/* Claim status of current user alert banner */}
        {userClaimant && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                {lang === 'th'
                  ? 'คุณได้ลงชื่อเครมไอเทมนี้ไว้แล้ว'
                  : 'You have registered a claim for this item.'}
              </span>
            </div>
            <button
              id="btn-unclaim-from-modal"
              disabled={isProcessing}
              onClick={() => handleCancelClaim(userClaimant.userId, userClaimant.inGameName)}
              className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 hover:text-white font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              <span>{isProcessing ? t.loading : t.cancelClaimBtn}</span>
            </button>
          </div>
        )}

        {/* Claimants list */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-[160px]">
          {claimants.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#090e1a]/80 border border-dashed border-slate-800 text-slate-400 text-xs">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
              <p>{t.noClaimantsYet}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#080d19]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0e1627] text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">{t.inGameName}</th>
                    <th className="py-2.5 px-3">{lang === 'th' ? 'อาชีพ' : 'Class'}</th>
                    <th className="py-2.5 px-3">{t.clanName}</th>
                    <th className="py-2.5 px-3">{t.powerLevel}</th>
                    <th className="py-2.5 px-3">{lang === 'th' ? 'เวลาลงชื่อ' : 'Claimed At'}</th>
                    <th className="py-2.5 px-3 text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {claimants.map((c, index) => {
                    const isCurrentUser = Boolean(
                      currentUser &&
                      ((c.userId && c.userId === currentUser.id) ||
                        (c.inGameName &&
                          currentUser.inGameName &&
                          c.inGameName.trim().toLowerCase() ===
                            currentUser.inGameName.trim().toLowerCase()))
                    );
                    const dateStr = new Date(c.claimedAt).toLocaleString(
                      lang === 'th' ? 'th-TH' : 'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }
                    );

                    const matchedMember = allMembers.find(
                      (m) =>
                        (c.userId && m.id === c.userId) ||
                        m.inGameName.toLowerCase() === c.inGameName.toLowerCase()
                    );
                    const cClasses = (matchedMember?.classes && matchedMember.classes.length > 0)
                      ? matchedMember.classes
                      : (matchedMember?.characterClass ? [matchedMember.characterClass] : (c.characterClass ? [c.characterClass] : []));

                    return (
                      <tr
                        key={c.userId + index}
                        className={`transition-colors ${
                          isCurrentUser
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : 'hover:bg-[#121c30]'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-bold text-slate-100">
                            <span>{c.inGameName}</span>
                            {isCurrentUser && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#f5d77f] font-semibold">
                                {lang === 'th' ? 'คุณ' : 'You'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {cClasses.length > 0 ? (
                              cClasses.map((clsName, cIdx) => {
                                const meta = getClassMeta(clsName);
                                return (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-200 border border-slate-700/60"
                                    title={meta?.nameTh || clsName}
                                  >
                                    {meta && <img src={meta.icon} alt={meta.nameEn} className="w-3.5 h-3.5 object-contain" />}
                                    <span>{meta?.nameEn || clsName}</span>
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-slate-500 text-[11px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[11px]">
                            {c.clan}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                          ⚡ {(c.powerLevel || 0).toLocaleString()} PL
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdminOrOwner && onDistributeToClaimant && (
                              <button
                                id={`btn-distribute-claimant-${index}`}
                                onClick={() => {
                                  sounds.playClick();
                                  onDistributeToClaimant(item, c);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-[11px] shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                                title={t.distributeToThisClaimant}
                              >
                                <Gift className="w-3 h-3" />
                                <span>{t.distributeToThisClaimant}</span>
                              </button>
                            )}
                            {(isCurrentUser || isAdminOrOwner) && (
                              <button
                                id={`btn-remove-claimant-${index}`}
                                disabled={isProcessing}
                                onClick={() => handleCancelClaim(c.userId, c.inGameName)}
                                className="p-1 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-800/70 text-red-300 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] disabled:opacity-50"
                                title={isCurrentUser ? t.cancelClaimBtn : (lang === 'th' ? 'นำผู้เล่นนี้ออกจากการเครม' : 'Remove claimant')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 text-[11px]">
            {lang === 'th'
              ? '* สิทธิ์การได้รับไอเทมขึ้นอยู่กับการจัดสรรของผู้ดูแลกิลด์'
              : '* Distribution is managed by guild leaders & admins'}
          </span>
          <button
            id="btn-close-claimants-bottom"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all cursor-pointer"
          >
            {t.closeZoom}
          </button>
        </div>

      </div>
    </div>
  );
};
