import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Sparkles,
  Gift,
  Zap,
  Clock,
  ExternalLink,
  Trash2,
  Users,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  AppNotification,
  ActiveTab,
  Language,
  VaultItem,
  getRarityBorder,
  getRarityBadge,
  cleanClanName
} from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
  onDeleteNotification?: (id: string) => void;
  onOpenDistributeModal?: (item: VaultItem) => void;
  onViewClaimants?: (item: VaultItem) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  onViewImageZoom?: (url: string, title?: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  lang,
  notifications,
  onMarkAllAsRead,
  onClearNotifications,
  onDeleteNotification,
  onOpenDistributeModal,
  onViewClaimants,
  onNavigateTab,
  onViewImageZoom
}) => {
  const [filterType, setFilterType] = useState<'all' | 'claim' | 'stat_request'>('all');
  const t = translations[lang];

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

  const formatTimeAgo = (ts: number): string => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.justNow || (lang === 'th' ? 'เมื่อสักครู่' : 'Just now');
    if (mins < 60) return lang === 'th' ? `${mins} นาทีที่แล้ว` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return lang === 'th' ? `${hours} ชั่วโมงที่แล้ว` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return lang === 'th' ? `${days} วันที่แล้ว` : `${days}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[88vh] rounded-2xl bg-gradient-to-b from-[#131b2e] via-[#0c121e] to-[#070b14] border border-[#d4af37]/40 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow corner decorations */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0 relative z-10 bg-[#090e1a]/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-950/40 border border-amber-500/40 text-amber-300 shadow-sm">
              <Bell className="w-5 h-5 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow ring-2 ring-[#090e1a] animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-cinzel text-slate-100">
                  {t.notificationsTitle}
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                    {t.unreadCountBadge ? t.unreadCountBadge.replace('{count}', String(unreadCount)) : `${unreadCount} new`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.notificationsDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onMarkAllAsRead();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm"
                title={t.markAllAsRead}
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">{t.markAllAsRead}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title={t.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 bg-[#090e1a]/50 border-b border-slate-800/60 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setFilterType('all');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                filterType === 'all'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {lang === 'th' ? 'ทั้งหมด' : 'All'} ({notifications.length})
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setFilterType('claim');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                filterType === 'claim'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>{lang === 'th' ? 'การลงชื่อรับ' : 'Claims'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setFilterType('stat_request');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                filterType === 'stat_request'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3 text-purple-400" />
              <span>{lang === 'th' ? 'สเตตัส' : 'Stats'}</span>
            </button>
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClearNotifications();
              }}
              className="text-[11px] text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
              title={t.clearAllNotifications}
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">{t.clearAllNotifications}</span>
            </button>
          )}
        </div>

        {/* Notifications Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/60 mx-auto flex items-center justify-center text-slate-500">
                <Bell className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-semibold text-slate-300">
                {t.noNotifications}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {lang === 'th'
                  ? 'เมื่อมีสมาชิกมากดเคลมไอเทมหรือส่งคำขอสเตตัส การแจ้งเตือนจะปรากฏขึ้นที่นี่โดยอัตโนมัติ'
                  : 'When members submit item claims or stat verification requests, alerts will appear here.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isClaim = notif.type === 'claim';

              return (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border transition-all relative group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    !notif.read
                      ? 'bg-[#141e33]/90 border-amber-500/40 shadow-md ring-1 ring-amber-500/20'
                      : 'bg-[#0a0f1a]/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!notif.read && (
                    <span className="absolute top-2.5 right-2.5 sm:hidden w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                  )}

                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {isClaim && notif.item ? (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          if (notif.item) {
                            onViewImageZoom?.(notif.item.imageUrl, notif.item.name);
                          }
                        }}
                        className={`w-11 h-11 rounded-lg overflow-hidden border bg-[#060a12] shrink-0 relative cursor-pointer group-hover:scale-105 transition-transform ${getRarityBorder(
                          notif.item.rarity
                        )}`}
                        title={notif.item.name}
                      >
                        <img
                          src={notif.item.imageUrl}
                          alt={notif.item.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Zap className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-100">
                          {notif.title}
                        </span>
                        {isClaim && notif.item && (
                          <span
                            className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border uppercase ${getRarityBadge(
                              notif.item.rarity
                            )}`}
                          >
                            {notif.item.rarity}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        {notif.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatTimeAgo(notif.timestamp)}</span>
                        </span>

                        {notif.claimant && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">
                              ⚡ {Number(notif.claimant.powerLevel || 0).toLocaleString()} PL
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isClaim && notif.item && (
                      <>
                        {onViewClaimants && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              onViewClaimants(notif.item!);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                            title={t.viewClaimantsList}
                          >
                            <Users className="w-3 h-3 text-sky-400" />
                            <span>{t.viewClaimantsList}</span>
                          </button>
                        )}

                        {onOpenDistributeModal && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              onOpenDistributeModal(notif.item!);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs font-bold transition-all flex items-center gap-1 shadow cursor-pointer active:scale-95"
                            title={t.viewAndDistribute}
                          >
                            <Gift className="w-3 h-3" />
                            <span>{t.viewAndDistribute}</span>
                          </button>
                        )}
                      </>
                    )}

                    {!isClaim && onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          onNavigateTab('all_members');
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg btn-l2m-gold text-slate-950 text-xs font-bold transition-all flex items-center gap-1 shadow cursor-pointer active:scale-95"
                      >
                        <Zap className="w-3 h-3" />
                        <span>{lang === 'th' ? 'ตรวจสเตตัส' : 'Review Stats'}</span>
                      </button>
                    )}

                    {onDeleteNotification && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sounds.playClick();
                          onDeleteNotification(notif.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                        title={t.deleteNotification}
                        aria-label={t.deleteNotification}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-3.5 bg-[#080d17] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>
            {lang === 'th'
              ? `ทั้งหมด ${filteredNotifications.length} รายการ`
              : `Total ${filteredNotifications.length} notifications`}
          </span>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
