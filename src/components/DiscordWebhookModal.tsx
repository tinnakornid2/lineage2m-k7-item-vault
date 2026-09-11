import React, { useState } from 'react';
import {
  X,
  Check,
  Send,
  Bell,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { DiscordSettings, Language, User } from '../types';
import { sendDiscordNotification } from '../utils/discord';
import { sounds } from '../utils/sound';

interface DiscordWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DiscordSettings | null;
  onSaveSettings: (settings: DiscordSettings) => Promise<void>;
  currentUser: User | null;
  lang: Language;
}

export const DiscordWebhookModal: React.FC<DiscordWebhookModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  currentUser,
  lang
}) => {
  const [webhookUrl, setWebhookUrl] = useState(settings?.webhookUrl || '');
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [notifyOnNewItem, setNotifyOnNewItem] = useState(settings?.notifyOnNewItem ?? true);
  const [notifyOnDistribute, setNotifyOnDistribute] = useState(settings?.notifyOnDistribute ?? true);
  const [botName, setBotName] = useState(settings?.botName || 'K7-Vault Alert');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({
        success: false,
        message: lang === 'th' ? 'กรุณากรอก Discord Webhook URL ก่อนทดสอบ' : 'Please enter Discord Webhook URL first'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    sounds.playClick();

    const tempSettings: DiscordSettings = {
      webhookUrl: webhookUrl.trim(),
      enabled: true,
      notifyOnNewItem,
      notifyOnDistribute,
      botName: botName.trim() || 'K7-Vault Alert'
    };

    const res = await sendDiscordNotification(tempSettings, 'test', {
      actorName: currentUser?.inGameName || 'Admin'
    });

    setIsTesting(false);
    if (res.success) {
      sounds.playSuccess();
      setTestResult({
        success: true,
        message:
          lang === 'th'
            ? 'ส่งข้อความทดสอบไปยัง Discord สำเร็จแล้ว! ตรวจสอบที่ช่องแชท Discord ของคุณได้เลย'
            : 'Test message delivered to Discord successfully!'
      });
    } else {
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    sounds.playClick();

    try {
      const updated: DiscordSettings = {
        webhookUrl: webhookUrl.trim(),
        enabled: enabled && webhookUrl.trim().length > 0,
        notifyOnNewItem,
        notifyOnDistribute,
        botName: botName.trim() || 'K7-Vault Alert',
        updatedBy: currentUser?.inGameName || 'Admin',
        updatedAt: Date.now()
      };

      await onSaveSettings(updated);
      sounds.playSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save discord settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="discord-webhook-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0d1424] border border-slate-700 shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#0d1830] to-[#0a101d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] shadow">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cinzel text-slate-100 flex items-center gap-2">
                <span>{lang === 'th' ? 'ตั้งค่าการแจ้งเตือน Discord' : 'Discord Webhook Integration'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'แจ้งเตือนอัตโนมัติเข้าดิสคอร์ดกิลด์เมื่อมีของใหม่หรือแจกของ'
                  : 'Automated Discord notifications on item creation and distribution'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          
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
                  : 'Toggle all automated Discord alerts'}
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

          {/* Webhook URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>{lang === 'th' ? 'Discord Webhook URL:' : 'Discord Webhook URL:'}</span>
              <span className="text-[10px] text-slate-500 font-normal">
                https://discord.com/api/webhooks/...
              </span>
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/123456789/xxxxxx..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080d17] border border-slate-700 focus:border-[#5865F2] text-xs font-mono text-slate-200 outline-none transition-all placeholder:text-slate-600"
            />
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
              placeholder="K7-Vault Alert"
              className="w-full px-3.5 py-2 rounded-xl bg-[#080d17] border border-slate-700 focus:border-[#5865F2] text-xs text-slate-200 outline-none transition-all"
            />
          </div>

          {/* Notification Triggers */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-slate-300">
              {lang === 'th' ? 'เหตุการณ์ที่ต้องการให้แจ้งเตือน:' : 'Notification Triggers:'}
            </label>

            <div className="space-y-2">
              {/* Trigger 1: New Item */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#090f1b] border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">⚔️</span>
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {lang === 'th' ? 'เมื่อมีไอเทมบอสใหม่เข้าคลัง' : 'When new boss item is registered'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {lang === 'th' ? 'ส่งการ์ดรูปภาพไอเทม ราคาเพชร และเกณฑ์พลังให้สมาชิกลงชื่อเครม' : 'Post embed with price, PL requirement and claim alert'}
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

          {/* Test Button & Feedback */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={isTesting || !webhookUrl.trim()}
              className="w-full py-2 px-3 rounded-xl bg-[#1e2746] hover:bg-[#28355e] border border-[#5865F2]/50 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5 text-[#5865F2]" />
              <span>{isTesting ? (lang === 'th' ? 'กำลังส่งทดสอบ...' : 'Sending...') : (lang === 'th' ? 'ทดสอบส่งข้อความไปยัง Discord' : 'Send Test Notification')}</span>
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
              <li>{lang === 'th' ? 'เปิด Discord เซิร์ฟเวอร์กิลด์ > คลิกการตั้งค่าห้อง (Edit Channel)' : 'Open Discord Server Settings > Integrations'}</li>
              <li>{lang === 'th' ? 'เลือกหัวข้อ Integrations (การผสานการทำงาน) > Webhooks' : 'Click Webhooks > New Webhook'}</li>
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
              <span>{isSaving ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึกการตั้งค่า' : 'Save Settings')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
