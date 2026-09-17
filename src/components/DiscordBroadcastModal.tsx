import React, { useState } from 'react';
import {
  X,
  Send,
  Sparkles,
  Check,
  Eye,
  AtSign,
  MessageSquare,
  Flame,
  Shield,
  Coins,
  FileText
} from 'lucide-react';
import { VaultItem, DiscordSettings, DiscordMessageTemplate, DiscordMentionType, Language, User } from '../types';
import { DISCORD_TEMPLATES } from '../utils/discord';
import { sounds } from '../utils/sound';

interface DiscordBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: VaultItem | null;
  settings: DiscordSettings | null;
  currentUser: User | null;
  lang: Language;
  onConfirmBroadcast: (
    item: VaultItem,
    template: DiscordMessageTemplate,
    customNote?: string,
    mentionType?: DiscordMentionType,
    saveAsDefault?: boolean
  ) => Promise<void>;
}

export const DiscordBroadcastModal: React.FC<DiscordBroadcastModalProps> = ({
  isOpen,
  onClose,
  item,
  settings,
  lang,
  onConfirmBroadcast
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<DiscordMessageTemplate>(() => {
    return settings?.messageTemplate || 'neon_glow';
  });
  const [customNote, setCustomNote] = useState('');
  const [mentionType, setMentionType] = useState<DiscordMentionType>(() => {
    return settings?.mentionType || 'everyone';
  });
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !item) return null;

  const th = lang === 'th';

  const getRarityGlowClass = (rarity: string) => {
    switch (rarity) {
      case 'MYTHIC':
        return 'border-amber-400/80 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]';
      case 'LAGEND':
        return 'border-[#8500fd]/80 text-[#b55aff] shadow-[0_0_15px_rgba(133,0,253,0.35)]';
      case 'EPIC':
        return 'border-rose-500/80 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]';
      case 'RARE':
      default:
        return 'border-cyan-400/80 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)]';
    }
  };

  const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case 'MYTHIC':
        return 'text-amber-400';
      case 'LAGEND':
        return 'text-[#b55aff]';
      case 'EPIC':
        return 'text-rose-400';
      case 'RARE':
      default:
        return 'text-cyan-400';
    }
  };

  const handleBroadcast = async () => {
    setIsSending(true);
    sounds.playClick();
    try {
      await onConfirmBroadcast(item, selectedTemplate, customNote.trim() || undefined, mentionType, saveAsDefault);
      onClose();
    } catch {
      // Error handled by parent toast
    } finally {
      setIsSending(false);
    }
  };

  const displayRarity = item.rarity === 'LAGEND' ? 'LEGEND' : item.rarity;
  const priceLabel = item.price > 0 ? `${item.price.toLocaleString()} Diamonds` : (th ? 'ฟรี (0 เพชร)' : 'FREE (0 Diamonds)');
  const discordPriceLabel = item.price > 0
    ? `${item.price.toLocaleString()} Diamonds`
    : 'FREE (0 Diamonds)';


  const rarityThai = {
    MYTHIC: 'ตำนานสูงสุด',
    LAGEND: 'ตำนาน',
    EPIC: 'มหากาพย์',
    RARE: 'หายาก'
  }[item.rarity] || item.rarity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0b111e] border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#141d36] to-[#0f172a] border-b border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[#8ea1e1]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{th ? 'เลือกแม่แบบส่งประกาศ Discord' : 'Select Discord Announcement Template'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5865F2]/20 text-[#8ea1e1] border border-[#5865F2]/40 font-mono">
                  Bilingual
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {th ? 'ปรับแต่งรูปแบบการ์ดและสีตัวอักษรก่อนส่งเข้าช่องแชทกิลด์' : 'Customize card layout and font colors before broadcasting'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Item Highlight Banner */}
          <div className={`flex items-center gap-3.5 p-3 rounded-xl bg-[#070c17] border ${getRarityGlowClass(item.rarity)}`}>
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-16 h-16 rounded-xl object-contain bg-black/60 p-1 shrink-0 border border-slate-700 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">
                ⚔️
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide bg-black/50 border border-current ${getRarityTextColor(item.rarity)}`}>
                  {displayRarity} {th ? `(${rarityThai})` : ''}
                </span>
                <span className="text-[11px] font-bold text-emerald-400">
                  💎 {priceLabel}
                </span>
                {item.quantity && item.quantity > 1 && (
                  <span className="text-[11px] font-bold text-cyan-400">
                    x{item.quantity} {th ? 'ชิ้น' : 'pcs'}
                  </span>
                )}
              </div>
              <div className={`text-sm font-bold truncate mt-1 ${getRarityTextColor(item.rarity)}`}>
                {item.name}
              </div>
            </div>
          </div>

          {/* 4 Template Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{th ? 'เลือกแม่แบบข้อความ (มีสีตัวอักษร):' : 'Choose Message Template (With Font Colors):'}</span>
              </label>
              <div className="flex items-center gap-1 text-[9px]">
                <span className="text-amber-400 font-bold">🟨 ทอง</span>
                <span className="text-[#b55aff] font-bold">🟪 ม่วง</span>
                <span className="text-rose-400 font-bold">🟥 แดง</span>
                <span className="text-cyan-400 font-bold">🟦 ฟ้า</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DISCORD_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setSelectedTemplate(tmpl.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#151c33] text-white shadow-md'
                        : 'bg-[#070c16] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                    style={{
                      borderColor: isSelected ? tmpl.accentColor : undefined,
                      boxShadow: isSelected ? `0 0 12px ${tmpl.accentColor}33` : undefined
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        {tmpl.id === 'neon_glow' && <Flame className="w-3.5 h-3.5 text-[#8500fd]" />}
                        {tmpl.id === 'war_horn' && <Shield className="w-3.5 h-3.5 text-red-400" />}
                        {tmpl.id === 'clan_market' && <Coins className="w-3.5 h-3.5 text-emerald-400" />}
                        {tmpl.id === 'crystal_minimal' && <FileText className="w-3.5 h-3.5 text-sky-400" />}
                        <span>{tmpl.name[lang]}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: tmpl.accentColor }} />}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {tmpl.description[lang]}
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${tmpl.accentColor}22`,
                          color: tmpl.accentColor,
                          border: `1px solid ${tmpl.accentColor}44`
                        }}
                      >
                        {tmpl.badge[lang]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-[#1e1f22] border border-slate-700 space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between text-[10px] font-sans text-slate-400 pb-1.5 border-b border-slate-700">
              <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                <Eye className="w-3.5 h-3.5 text-[#5865F2]" />
                <span>{th ? 'ตัวอย่างการแสดงผลจริงใน Discord (English 100%)' : 'Live Preview in Discord (100% English)'}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                {mentionType === 'everyone' ? '@everyone' : mentionType === 'role' ? '@Role' : 'Silent'}
              </span>
            </div>

            {/* Simulated Discord Embed */}
            <div className="space-y-1 pt-1">
              <div className="text-slate-400 font-sans text-[10px]">
                {mentionType === 'everyone' && <span className="text-[#8ea1e1] font-bold">@everyone </span>}
                {mentionType === 'role' && <span className="text-amber-400 font-bold">&lt;@&amp;Role&gt; </span>}
                <span className="text-white font-bold">⚔️ New Boss Item Added to Vault!</span>
              </div>

              {selectedTemplate === 'neon_glow' && (
                <div className="space-y-0.5 pt-1 bg-[#141517] p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-200">
                    <span className={`font-bold ${getRarityTextColor(item.rarity)}`}>
                      [{displayRarity}] {item.name}
                    </span>{' '}
                    <span className="text-slate-300 font-bold">(x{item.quantity || 1})</span>
                  </div>
                  <div className="text-white font-bold">
                    💎 Price: {discordPriceLabel}
                  </div>
                </div>
              )}

              {selectedTemplate === 'war_horn' && (
                <div className="space-y-0.5 pt-1 bg-[#141517] p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-200">
                    <span className="text-red-400 font-bold">⚔️ [WAR VAULT]</span>{' '}
                    <span className={`font-bold ${getRarityTextColor(item.rarity)}`}>
                      [{displayRarity}] {item.name}
                    </span>{' '}
                    <span className="text-slate-300 font-bold">(x{item.quantity || 1})</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-white font-bold">💎 Price: {discordPriceLabel}</span>
                  </div>
                </div>
              )}

              {selectedTemplate === 'clan_market' && (
                <div className="space-y-0.5 pt-1 bg-[#141517] p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-200">
                    <span className="text-cyan-400 font-bold">🏛️ [MARKET]</span>{' '}
                    <span className={`font-bold ${getRarityTextColor(item.rarity)}`}>
                      [{displayRarity}] {item.name}
                    </span>{' '}
                    <span className="text-slate-300 font-bold">(x{item.quantity || 1})</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-white font-bold">💎 Price: {discordPriceLabel}</span>
                  </div>
                </div>
              )}

              {selectedTemplate === 'crystal_minimal' && (
                <div className="space-y-0.5 pt-1 text-slate-300 font-sans border-l-2 border-sky-400 pl-2 bg-[#141517] p-2.5 rounded-r-lg">
                  <div>
                    <span className={`font-bold ${getRarityTextColor(item.rarity)}`}>
                      ⚔️ [{displayRarity}] {item.name}
                    </span>{' '}
                    <span className="text-slate-300 font-bold font-mono">(x{item.quantity || 1})</span>
                  </div>
                  <div>
                    💎 <span className="font-bold text-white">Price:</span> <span className="text-white font-bold font-mono">{discordPriceLabel}</span>
                  </div>
                </div>
              )}

              {customNote.trim() && (
                <div className="text-[10px] text-amber-300 font-sans italic pt-1">
                  💬 <span className="font-bold">Note:</span> {customNote.trim()}
                </div>
              )}

              <div className="text-[10px] font-sans text-sky-400 pt-1">
                👉 <span className="underline cursor-pointer">Open Vault to Claim Item (Direct Link)</span>
              </div>
            </div>
          </div>

          {/* Mention Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-[#5865F2]" />
              <span>{th ? 'การแท็กสมาชิกใน Discord:' : 'Discord Mention:'}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setMentionType('everyone');
                }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  mentionType === 'everyone'
                    ? 'bg-[#5865F2]/20 border-[#5865F2] text-white font-bold'
                    : 'bg-[#070c16] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                @everyone
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setMentionType('role');
                }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  mentionType === 'role'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-[#070c16] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🛡️ Role ID
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setMentionType('none');
                }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  mentionType === 'none'
                    ? 'bg-slate-700/40 border-slate-500 text-slate-200 font-bold'
                    : 'bg-[#070c16] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🔕 {th ? 'เงียบ (None)' : 'Silent'}
              </button>
            </div>
          </div>

          {/* Optional Custom Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              {th ? 'ข้อความประกาศเพิ่มเติม (ถ้ามี):' : 'Custom Announcement Note (Optional):'}
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder={th ? 'เช่น ดรอปจากบอสเบรก้าเมื่อคืนนี้ ใครพร้อมรบกดเคลมได้เลย' : 'e.g. Looted from raid boss last night, claim open for active members'}
              className="w-full px-3.5 py-2 rounded-xl bg-[#070c16] border border-slate-700 focus:border-[#5865F2] text-xs text-slate-200 outline-none transition-all placeholder-slate-600"
            />
          </div>

          {/* Save as default checkbox */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
              className="w-4 h-4 rounded text-[#5865F2] accent-[#5865F2] cursor-pointer"
            />
            <span>{th ? 'จำแม่แบบนี้เป็นค่าเริ่มต้นสำหรับการส่งครั้งต่อไป' : 'Remember this template as default for future broadcasts'}</span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-4 sm:px-5 py-3.5 bg-[#0a0f1c] border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            {th ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={handleBroadcast}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#5865F2] to-[#4752c4] hover:brightness-110 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#5865F2]/25 cursor-pointer disabled:opacity-50 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {isSending
                ? (th ? 'กำลังส่งเข้า Discord...' : 'Broadcasting...')
                : (th ? '🚀 ส่งประกาศเข้า Discord' : '🚀 Broadcast to Discord')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
