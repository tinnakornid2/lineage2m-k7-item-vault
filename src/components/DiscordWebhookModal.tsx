import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Send,
  Bell,
  HelpCircle,
  ShieldCheck,
  Globe,
  Radio,
  Sparkles,
  AlertCircle,
  Key,
  Layers,
  AtSign,
  Eye
} from 'lucide-react';
import { DiscordSettings, DiscordMentionType, DiscordMessageTemplate, Language, User } from '../types';
import { sendDiscordNotification, DISCORD_TEMPLATES } from '../utils/discord';
import { sounds } from '../utils/sound';
import { getCurrentUserIdToken } from '../services/firebase';
import { translations } from '../translations';

interface DiscordWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DiscordSettings | null;
  onSaveSettings: (settings: DiscordSettings) => Promise<void>;
  currentUser: User | null;
  lang: Language;
  vaultItemsCount?: number;
  onSyncAllToDiscord?: () => Promise<void>;
}

export const DiscordWebhookModal: React.FC<DiscordWebhookModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  currentUser,
  lang,
  vaultItemsCount = 0,
  onSyncAllToDiscord
}) => {
  const t = translations[lang];
  const isOwner = currentUser?.role === 'owner';

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [notifyOnNewItem, setNotifyOnNewItem] = useState(settings?.notifyOnNewItem ?? true);
  const [notifyOnDistribute, setNotifyOnDistribute] = useState(settings?.notifyOnDistribute ?? true);
  const [messageTemplate, setMessageTemplate] = useState<DiscordMessageTemplate>(
    settings?.messageTemplate || 'neon_glow'
  );
  const [mentionType, setMentionType] = useState<DiscordMentionType>(() => {
    if (settings?.mentionType) return settings.mentionType;
    if (settings?.mentionRoleId?.trim()) return 'role';
    if (settings?.mentionEveryone === false) return 'none';
    return 'everyone';
  });
  const [mentionRoleId, setMentionRoleId] = useState(settings?.mentionRoleId || '');
  const [botName, setBotName] = useState(settings?.botName || 'Lineage 2M Vault');
  const [appBaseUrl, setAppBaseUrl] = useState(
    settings?.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  );
  const [webhookUrlInput, setWebhookUrlInput] = useState('');

  const [serverStatus, setServerStatus] = useState<{
    configured: boolean;
    maskedUrl: string | null;
  }>({ configured: false, maskedUrl: null });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Sync settings when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setEnabled(settings?.enabled ?? false);
      setNotifyOnNewItem(settings?.notifyOnNewItem ?? true);
      setNotifyOnDistribute(settings?.notifyOnDistribute ?? true);
      setMessageTemplate(settings?.messageTemplate || 'neon_glow');
      const initialMentionType: DiscordMentionType =
        settings?.mentionType ||
        (settings?.mentionRoleId?.trim() ? 'role' : settings?.mentionEveryone === false ? 'none' : 'everyone');
      setMentionType(initialMentionType);
      setMentionRoleId(settings?.mentionRoleId || '');
      setBotName(settings?.botName || 'Lineage 2M Vault');
      setAppBaseUrl(settings?.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : ''));
      setTestResult(null);

      // Fetch Discord Webhook status from secure backend
      getCurrentUserIdToken()
        .then((token) =>
          fetch('/api/discord-status', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          })
        )
        .then(async (res) => {
          if (!res.ok) return null;
          try {
            return await res.json();
          } catch {
            return null;
          }
        })
        .then((data) => {
          if (data && typeof data.configured === 'boolean') {
            setServerStatus(data);
          }
        })
        .catch((err) => console.warn('Cannot fetch discord status:', err));
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  // Strict RBAC: Owner only
  if (!isOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-md p-6 rounded-2xl bg-[#0d1424] border border-red-500/50 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-base font-bold text-white font-cinzel">
            {lang === 'th' ? 'เฉพาะ Owner เท่านั้น' : 'Owner Only'}
          </h3>
          <p className="text-xs text-slate-400">
            {lang === 'th'
              ? 'คุณไม่มีสิทธิ์เข้าถึงการตั้งค่า Discord Webhook ส่วนนี้สงวนไว้สำหรับ Owner เท่านั้น'
              : 'Access denied. Only the Clan Owner can configure Discord Webhook settings.'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
          >
            {lang === 'th' ? 'ปิด' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  const handleUseCurrentUrl = () => {
    sounds.playClick();
    if (typeof window !== 'undefined') {
      setAppBaseUrl(window.location.origin);
    }
  };

  const handleTestWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);
    sounds.playClick();

    const cleanRoleId = mentionRoleId.trim().replace(/\D/g, '');
    const candidateUrl =
      webhookUrlInput.trim() ||
      settings?.webhookUrl ||
      (typeof window !== 'undefined' ? localStorage.getItem('vault_discord_webhook_url') || '' : '');

    // Auto-save to backend if user typed a new URL
    if (webhookUrlInput.trim()) {
      getCurrentUserIdToken().then((token) => {
        fetch('/api/save-discord-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ webhookUrl: webhookUrlInput.trim() })
        }).catch(() => undefined);
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('vault_discord_webhook_url', webhookUrlInput.trim());
      }
    }

    const tempSettings: DiscordSettings = {
      webhookUrl: candidateUrl,
      appBaseUrl: appBaseUrl.trim(),
      enabled: true,
      notifyOnNewItem,
      notifyOnDistribute,
      mentionType,
      mentionRoleId: cleanRoleId,
      mentionEveryone: mentionType === 'everyone',
      messageTemplate,
      botName: botName.trim() || 'Lineage 2M Vault'
    };

    const res = await sendDiscordNotification(tempSettings, 'test', {
      actorName: currentUser?.inGameName || 'Owner',
      lang,
      webhookUrl: candidateUrl,
      template: messageTemplate
    });

    setIsTesting(false);
    if (res.success) {
      sounds.playSuccess();
      setTestResult({
        success: true,
        message:
          lang === 'th'
            ? 'ส่งข้อความทดสอบไปยัง Discord สำเร็จแล้ว! ตรวจสอบที่ห้องแชท Discord ได้เลย'
            : 'Test message delivered to Discord successfully!'
      });
    } else {
      sounds.playError();
      setTestResult({
        success: false,
        message:
          res.message ||
          (lang === 'th'
            ? 'ไม่สามารถส่งข้อความได้ กรุณาตรวจสอบ Webhook URL'
            : 'Failed to send test message. Please verify URL')
      });
    }
  };

  const handleBroadcastAllItems = async () => {
    if (!onSyncAllToDiscord) return;
    if (vaultItemsCount === 0) {
      sounds.playError();
      setTestResult({
        success: false,
        message: lang === 'th' ? 'ไม่พบไอเทมในคลังที่จะส่ง' : 'No vault items to broadcast'
      });
      return;
    }

    const confirmMsg =
      lang === 'th'
        ? `คุณต้องการส่งไอเทมที่มีอยู่ในเว็บทั้งหมด ${vaultItemsCount} ชิ้น เข้าห้อง Discord หรือไม่?`
        : `Do you want to broadcast all ${vaultItemsCount} items currently on the website to Discord?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSyncingAll(true);
    sounds.playClick();
    try {
      await onSyncAllToDiscord();
      sounds.playSuccess();
      setTestResult({
        success: true,
        message:
          lang === 'th'
            ? `ส่งไอเทมทั้งหมด ${vaultItemsCount} ชิ้น เข้า Discord เรียบร้อยแล้ว!`
            : `All ${vaultItemsCount} items broadcasted to Discord successfully!`
      });
    } catch (err: any) {
      sounds.playError();
      setTestResult({
        success: false,
        message:
          err?.message ||
          (lang === 'th' ? 'เกิดข้อผิดพลาดในการส่งไอเทมทั้งหมด' : 'Failed to broadcast all items')
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    sounds.playClick();

    try {
      const activeUrl =
        webhookUrlInput.trim() ||
        (typeof window !== 'undefined' ? localStorage.getItem('vault_discord_webhook_url') || '' : '') ||
        settings?.webhookUrl ||
        '';

      // 1. If user entered a new Webhook URL, save it to secure backend
      if (webhookUrlInput.trim()) {
        const token = await getCurrentUserIdToken();
        const res = await fetch('/api/save-discord-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ webhookUrl: webhookUrlInput.trim() })
        });
        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          data = { message: resText || `Server error (${res.status})` };
        }
        if (!res.ok) {
          throw new Error(data.message || (lang === 'th' ? 'บันทึก Webhook URL ไม่สำเร็จ' : 'Failed to save Webhook URL'));
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('vault_discord_webhook_url', webhookUrlInput.trim());
        }
        setServerStatus({
          configured: true,
          maskedUrl:
            webhookUrlInput.length > 35
              ? `${webhookUrlInput.slice(0, 33)}...${webhookUrlInput.slice(-4)}`
              : webhookUrlInput
        });
        setWebhookUrlInput('');
      }

      // 2. Save settings to Firestore
      const cleanRoleId = mentionRoleId.trim().replace(/\D/g, '');
      const updated: DiscordSettings = {
        webhookUrl: activeUrl,
        appBaseUrl: appBaseUrl.trim(),
        enabled,
        notifyOnNewItem,
        notifyOnDistribute,
        mentionType,
        mentionRoleId: cleanRoleId,
        mentionEveryone: mentionType === 'everyone',
        messageTemplate,
        botName: botName.trim() || 'Lineage 2M Vault',
        updatedBy: currentUser?.inGameName || 'Owner',
        updatedAt: Date.now()
      };

      await onSaveSettings(updated);
      sounds.playSuccess();
      onClose();
    } catch (err: any) {
      sounds.playError();
      setTestResult({
        success: false,
        message: err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึก' : 'Failed to save settings')
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="discord-webhook-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="w-full max-w-lg my-8 rounded-2xl bg-[#0d1424] border border-[#5865F2]/40 shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#0d1830] via-[#101738] to-[#0a101d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/50 flex items-center justify-center text-[#5865F2] shadow">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <span>{lang === 'th' ? 'ตั้งค่าการแจ้งเตือน Discord' : 'Discord Webhook Integration'}</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-sans font-bold uppercase tracking-wider">
                  👑 {lang === 'th' ? 'เฉพาะ Owner' : 'Owner Only'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'ส่งแจ้งเตือนไอเทมใหม่และไอเทมในเว็บเข้า Discord เป็นภาษาอังกฤษพร้อมตัวหนังสือสี'
                  : 'Broadcast new and existing vault items to Discord with ANSI color formatting'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Main Master Switch */}
          <div className="p-3.5 rounded-xl bg-[#090f1b] border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'th' ? 'เปิดระบบส่งการแจ้งเตือน Discord' : 'Enable Discord Webhook'}</span>
              </span>
              <p className="text-[11px] text-slate-400">
                {lang === 'th'
                  ? 'เปิด/ปิด ระบบแจ้งเตือนทั้งหมดของกิลด์'
                  : 'Master toggle for all automated Discord alerts'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                enabled ? 'bg-[#5865F2]' : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Webhook URL Input Section (Owner only) */}
          <div className="space-y-1.5 p-3.5 rounded-xl bg-[#080d17] border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'th' ? 'Discord Webhook URL:' : 'Discord Webhook URL:'}</span>
              </label>
              {serverStatus.configured ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-600/50 text-emerald-300">
                  ✓ {lang === 'th' ? 'ตั้งค่าแล้ว' : 'Configured'}
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-600/50 text-amber-300">
                  ! {lang === 'th' ? 'ยังไม่ได้ตั้งค่า' : 'Not configured'}
                </span>
              )}
            </div>

            {serverStatus.maskedUrl && (
              <div className="px-3 py-1.5 rounded-lg bg-[#0d1424] border border-slate-700/60 font-mono text-[11px] text-slate-400 truncate">
                {serverStatus.maskedUrl}
              </div>
            )}

            <input
              type="url"
              value={webhookUrlInput}
              onChange={(e) => setWebhookUrlInput(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#060a12] border border-slate-700 focus:border-[#5865F2] text-xs text-slate-200 outline-none transition-all font-mono"
            />
            <p className="text-[10px] text-slate-500">
              {lang === 'th'
                ? 'วาง Webhook URL ที่คัดลอกจาก Discord (ระบบจะเก็บอย่างปลอดภัยและซ่อน URL เสมอ)'
                : 'Paste the webhook URL copied from Discord. It will be stored securely on the server.'}
            </p>
          </div>

          {/* Webapp Base URL (for Click to Claim direct link) */}
          <div className="space-y-1.5 p-3.5 rounded-xl bg-[#080d17] border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>{lang === 'th' ? 'URL หน้าเว็บสำหรับลิงก์กดเคลม:' : 'Webapp URL for Claim Link:'}</span>
              </label>
              <button
                type="button"
                onClick={handleUseCurrentUrl}
                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
              >
                {lang === 'th' ? 'ใช้ URL ปัจจุบัน' : 'Use Current URL'}
              </button>
            </div>
            <input
              type="url"
              value={appBaseUrl}
              onChange={(e) => setAppBaseUrl(e.target.value)}
              placeholder="https://your-domain.vercel.app"
              className="w-full px-3.5 py-2 rounded-xl bg-[#060a12] border border-slate-700 focus:border-sky-500 text-xs text-slate-200 outline-none transition-all font-mono"
            />
            <p className="text-[10px] text-slate-500">
              {lang === 'th'
                ? 'ใช้สำหรับสร้างลิงก์ "Click here to Claim in Clan Hub" ให้สมาชิกกดแล้ววิ่งมาที่เว็บได้ตรงตัว'
                : 'Used to generate direct "Click here to Claim" links in Discord embeds.'}
            </p>
          </div>

          {/* Bot Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              {lang === 'th' ? 'ชื่อบอทที่แสดงใน Discord:' : 'Bot Display Name:'}
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Lineage 2M Vault"
              className="w-full px-3.5 py-2 rounded-xl bg-[#080d17] border border-slate-700 focus:border-[#5865F2] text-xs text-slate-200 outline-none transition-all"
            />
          </div>

          {/* Notification Triggers */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-slate-300">
              {lang === 'th' ? 'เหตุการณ์ที่ต้องการให้แจ้งเตือนอัตโนมัติ:' : 'Automated Triggers:'}
            </label>

            <div className="space-y-2">
              {/* Trigger 1: New Item */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#090f1b] border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">⚔️</span>
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {lang === 'th' ? 'เมื่อมีไอเทมใหม่เข้าคลัง' : 'When new item is added to vault'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {lang === 'th'
                        ? 'ส่งการ์ดภาษาอังกฤษตัวหนังสือสี ANSI พร้อมราคาและลิงก์เคลม'
                        : 'Post ANSI colored English embed with price and claim link'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnNewItem}
                  onChange={(e) => setNotifyOnNewItem(e.target.checked)}
                  className="w-4 h-4 rounded text-[#5865F2] accent-[#5865F2]"
                />
              </label>

              {/* Trigger 2: Distribute Item */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#090f1b] border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🏆</span>
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {lang === 'th' ? 'เมื่อแจกไอเทมให้สมาชิกสำเร็จ' : 'When item is distributed'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {lang === 'th' ? 'ประกาศชื่อผู้ได้รับ แคลน และแสดงความยินดีในช่องดิสคอร์ด' : 'Post announcement with recipient name and congratulations'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnDistribute}
                  onChange={(e) => setNotifyOnDistribute(e.target.checked)}
                  className="w-4 h-4 rounded text-[#5865F2] accent-[#5865F2]"
                />
              </label>

            </div>
          </div>

          {/* Discord Message Template Selection & Color Preview */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {lang === 'th' ? 'แม่แบบข้อความ & สีตัวอักษร:' : 'Message Template & Font Colors:'}
                </span>
              </label>
              <div className="flex items-center gap-1 text-[9px]">
                <span className="text-amber-400 font-bold">🟨 {lang === 'th' ? 'ทอง' : 'Gold'}</span>
                <span className="text-[#b55aff] font-bold">🟪 {lang === 'th' ? 'ม่วง' : 'Purple'}</span>
                <span className="text-rose-400 font-bold">🟥 {lang === 'th' ? 'แดง' : 'Red'}</span>
                <span className="text-cyan-400 font-bold">🟦 {lang === 'th' ? 'ฟ้า' : 'Cyan'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DISCORD_TEMPLATES.map((tmpl) => {
                const isSelected = messageTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setMessageTemplate(tmpl.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#151c33] text-white shadow-md'
                        : 'bg-[#090f1b] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                    style={{
                      borderColor: isSelected ? tmpl.accentColor : undefined,
                      boxShadow: isSelected ? `0 0 12px ${tmpl.accentColor}33` : undefined
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-100 flex items-center gap-1">
                        {tmpl.name[lang]}
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

            {/* Live Colored Text Preview Card */}
            <div className="p-3 rounded-xl bg-[#1e1f22] border border-slate-700/80 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-[10px] font-sans text-slate-400 pb-1 border-b border-slate-700">
                <span className="flex items-center gap-1 text-slate-300 font-bold">
                  <Eye className="w-3 h-3 text-[#5865F2]" />
                  <span>{lang === 'th' ? 'ตัวอย่างการแสดงผลจริงใน Discord (English 100%)' : 'Discord Live Color Preview (100% English)'}</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  Embed Card Preview
                </span>
              </div>

              {messageTemplate === 'neon_glow' && (
                <div className="space-y-0.5 pt-1 bg-[#141517] p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-200">
                    <span className="text-rose-400 font-bold">[EPIC] Breka&apos;s Soul</span>{' '}
                    <span className="text-slate-300 font-bold">(x1)</span>
                  </div>
                  <div className="text-white font-bold">
                    💎 Price: FREE (0 Diamonds)
                  </div>
                </div>
              )}

              {messageTemplate === 'war_horn' && (
                <div className="space-y-0.5 pt-1 bg-[#141517] p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-200">
                    <span className="text-red-400 font-bold">⚔️ [WAR VAULT]</span>{' '}
                    <span className="text-rose-400 font-bold">[EPIC] Breka&apos;s Soul</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-white font-bold">💎 FREE (0 Diamonds)</span>{' '}
                    <span className="text-slate-300 font-bold">(x1)</span> • <span className="text-amber-400 font-bold">Claim Ready</span>
                  </div>
                </div>
              )}

              {messageTemplate === 'clan_market' && (
                <div className="space-y-0.5 pt-1 bg-[#141517] p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-200">
                    <span className="text-cyan-400 font-bold">🏛️ [MARKET]</span>{' '}
                    <span className="text-rose-400 font-bold">[EPIC] Breka&apos;s Soul</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-white font-bold">💎 Value: FREE (0 Diamonds)</span>{' '}
                    <span className="text-slate-300 font-bold">(x1)</span>
                  </div>
                </div>
              )}

              {messageTemplate === 'crystal_minimal' && (
                <div className="space-y-0.5 pt-1 text-slate-300 font-sans border-l-2 border-sky-400 pl-2 bg-[#141517] p-2.5 rounded-r-lg">
                  <div>
                    <span className="text-rose-400 font-bold font-mono">⚔️ [EPIC] Breka&apos;s Soul</span>{' '}
                    <span className="text-slate-300 font-bold font-mono">(x1)</span>
                  </div>
                  <div>
                    💎 <span className="font-bold text-white">Price:</span> <span className="text-white font-bold font-mono">FREE (0 Diamonds)</span>
                  </div>
                </div>
              )}

              <div className="text-[10px] font-sans text-sky-400 pt-1">
                👉 <span className="underline cursor-pointer">Open Vault to Claim Item (Direct Link)</span>
              </div>
            </div>
          </div>

          {/* Mention Configuration Section */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-[#5865F2]" />
                <span>{t.discordMentionMode}</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {lang === 'th' ? 'เลือกรูปแบบการแท็กเมื่อแจ้งเตือน' : 'Notification tag preferences'}
              </span>
            </div>

            {/* 3 Options: Everyone / Role ID / None */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option 1: @everyone */}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setMentionType('everyone');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  mentionType === 'everyone'
                    ? 'bg-[#5865F2]/15 border-[#5865F2] text-white shadow-sm ring-1 ring-[#5865F2]/50'
                    : 'bg-[#090f1b] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold font-mono text-[#8ea1e1]">@everyone</span>
                  {mentionType === 'everyone' && <Check className="w-3.5 h-3.5 text-[#5865F2]" />}
                </div>
                <div className="text-[11px] font-bold text-slate-200">{t.discordMentionEveryone}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t.discordMentionEveryoneDesc}</div>
              </button>

              {/* Option 2: Specific Role ID */}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setMentionType('role');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  mentionType === 'role'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/50'
                    : 'bg-[#090f1b] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold font-mono text-amber-400">🛡️ Role ID</span>
                  {mentionType === 'role' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="text-[11px] font-bold text-slate-200">{t.discordMentionRole}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t.discordMentionRoleDesc}</div>
              </button>

              {/* Option 3: None (Silent) */}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setMentionType('none');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  mentionType === 'none'
                    ? 'bg-slate-700/30 border-slate-500 text-white shadow-sm ring-1 ring-slate-400/50'
                    : 'bg-[#090f1b] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold font-mono text-slate-400">🔕 None</span>
                  {mentionType === 'none' && <Check className="w-3.5 h-3.5 text-slate-300" />}
                </div>
                <div className="text-[11px] font-bold text-slate-200">{t.discordMentionNone}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t.discordMentionNoneDesc}</div>
              </button>
            </div>

            {/* Role ID Input field (only when Role ID is selected) */}
            {mentionType === 'role' && (
              <div className="p-3 rounded-xl bg-[#070c17] border border-amber-500/40 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>{t.discordRoleIdLabel}</span>
                  </label>
                  {mentionRoleId.trim().replace(/\D/g, '') && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                      {t.discordRolePreview} &lt;@&amp;{mentionRoleId.trim().replace(/\D/g, '')}&gt;
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={mentionRoleId}
                  onChange={(e) => setMentionRoleId(e.target.value)}
                  placeholder={t.discordRoleIdPlaceholder}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#040811] border border-amber-500/40 focus:border-amber-400 text-xs text-amber-100 placeholder-slate-600 outline-none transition-all font-mono"
                />

                <p className="text-[10px] text-slate-400 leading-relaxed bg-black/40 p-2 rounded-lg border border-slate-800">
                  💡 {t.discordRoleIdHelp}
                </p>
              </div>
            )}
          </div>

          {/* Sync All Vault Items to Discord (Owner Special Feature) */}
          {onSyncAllToDiscord && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#171f3a] to-[#11192e] border border-[#5865F2]/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#5865F2]" />
                  <span className="text-xs font-bold text-slate-100">
                    {lang === 'th' ? 'ส่งไอเทมที่มีอยู่ในเว็บเข้า Discord ทั้งหมด' : 'Broadcast All Existing Items'}
                  </span>
                </div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#5865F2]/20 text-[#8ea1e1] border border-[#5865F2]/30">
                  {vaultItemsCount} {lang === 'th' ? 'ชิ้นในคลัง' : 'items'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {lang === 'th'
                  ? 'ส่งไอเทมที่ลงไว้ในเว็บก่อนหน้านี้เข้า Discord ครบทุกชิ้นรอบเดียว ไม่ต้องกดทีละชิ้น'
                  : 'Broadcast all items currently in the web vault to Discord without sending one by one.'}
              </p>
              <button
                type="button"
                onClick={handleBroadcastAllItems}
                disabled={isSyncingAll || vaultItemsCount === 0}
                className="w-full py-2 px-3 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>
                  {isSyncingAll
                    ? (lang === 'th' ? 'กำลังส่งไอเทมทั้งหมดเข้า Discord...' : 'Broadcasting all items...')
                    : (lang === 'th' ? `📢 ส่งไอเทมทั้งหมดในเว็บเข้า Discord (${vaultItemsCount} ชิ้น)` : `📢 Broadcast All Items (${vaultItemsCount})`)}
                </span>
              </button>
            </div>
          )}

          {/* Test Button & Feedback */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={isTesting}
              className="w-full py-2 px-3 rounded-xl bg-[#1e2746] hover:bg-[#28355e] border border-[#5865F2]/50 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5 text-[#5865F2]" />
              <span>
                {isTesting
                  ? (lang === 'th' ? 'กำลังส่งทดสอบ...' : 'Sending...')
                  : (lang === 'th' ? 'ทดสอบส่งข้อความไปยัง Discord' : 'Send Test Notification')}
              </span>
            </button>

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Guide Helper Box */}
          <div className="p-3 rounded-xl bg-[#080d17] border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-300 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-amber-400" />
              <span>{lang === 'th' ? 'วิธีสร้าง Discord Webhook:' : 'How to create Discord Webhook:'}</span>
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
              <li>{lang === 'th' ? 'เปิด Discord > คลิกตั้งค่าห้อง (Edit Channel)' : 'Open Discord > Edit Channel'}</li>
              <li>{lang === 'th' ? 'เลือก Integrations (การรวมเข้าด้วยกัน) > Webhooks' : 'Select Integrations > Webhooks'}</li>
              <li>{lang === 'th' ? 'กด New Webhook แล้วกดปุ่ม Copy Webhook URL มาวางที่นี่' : 'Click "Copy Webhook URL" and paste above'}</li>
            </ol>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#5865F2] to-[#4752c4] hover:brightness-110 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-[#5865F2]/20 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSaving
                  ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                  : (lang === 'th' ? 'บันทึกการตั้งค่า' : 'Save Settings')}
              </span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
