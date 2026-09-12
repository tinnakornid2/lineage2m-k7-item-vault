import React, { useState, useEffect } from 'react';
import {
  Key,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';
import { saveGeminiAiSettingsDoc } from '../services/firebase';

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onKeySaved?: (key: string) => void;
  isOwner?: boolean;
}

export const GeminiKeyModal: React.FC<GeminiKeyModalProps> = ({
  isOpen,
  onClose,
  lang,
  onKeySaved,
  isOwner = true
}) => {
  const t = translations[lang];

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const [serverStatus, setServerStatus] = useState<{
    configured: boolean;
    maskedKey: string | null;
  }>({ configured: false, maskedKey: null });

  // Load status and local key on modal open
  useEffect(() => {
    if (!isOpen) return;

    // Load from localStorage if present
    const localKey = localStorage.getItem('k7_gemini_api_key') || '';
    if (localKey && !apiKey) {
      setApiKey(localKey);
    }

    // Check server or local status
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocalhost) {
      fetch('/api/gemini-status')
        .then((res) => res.text())
        .then((text) => {
          if (text && !text.trim().startsWith('<')) {
            try {
              const data = JSON.parse(text);
              setServerStatus({
                configured: Boolean(data.configured),
                maskedKey: data.maskedKey || null
              });
              if (data.configured && !status.message) {
                setStatus({
                  type: 'success',
                  message: lang === 'th'
                    ? `ระบบเชื่อมต่อ Gemini AI เรียบร้อยแล้ว (${data.maskedKey})`
                    : `Gemini AI is connected and active (${data.maskedKey})`
                });
              }
            } catch {
              // ignore
            }
          }
        })
        .catch((err) => {
          console.warn('Could not fetch gemini-status:', err);
        });
    } else {
      if (localKey && localKey.length > 10) {
        setServerStatus({
          configured: true,
          maskedKey: `${localKey.slice(0, 6)}...${localKey.slice(-4)}`
        });
        setStatus({
          type: 'success',
          message: lang === 'th'
            ? `ระบบเชื่อมต่อ Gemini AI เรียบร้อยแล้ว (${localKey.slice(0, 6)}...${localKey.slice(-4)})`
            : `Gemini AI is connected and active (${localKey.slice(0, 6)}...${localKey.slice(-4)})`
        });
      }
    }
  }, [isOpen, lang]);

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setStatus({
        type: 'error',
        message: lang === 'th' ? 'กรุณาระบุ Gemini API Key' : 'Please provide a Gemini API Key'
      });
      sounds.playError();
      return;
    }

    setIsTesting(true);
    setStatus({
      type: 'idle',
      message: t.geminiKeyTesting
    });

    try {
      const isLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      let isKeyValid = false;
      let serverMaskedKey: string | null = null;
      let errorMessage = '';

      if (isLocalhost) {
        // Try local Express backend first
        try {
          const res = await fetch('/api/save-gemini-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: cleanKey })
          });

          const resText = await res.text();
          if (resText && !resText.trim().startsWith('<')) {
            const data = JSON.parse(resText);
            if (data.success) {
              isKeyValid = true;
              serverMaskedKey = data.maskedKey;
            } else {
              errorMessage = data.error || (lang === 'th' ? 'API Key ไม่ถูกต้อง' : 'Invalid API Key');
            }
          }
        } catch {
          // Fall through to direct verification below
        }
      }

      // If on deployed site (Vercel) or server returned HTML, test directly with Google Gemini API
      if (!isKeyValid && !errorMessage) {
        try {
          const testRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
          );
          const testData = await testRes.json();
          if (testRes.ok && testData.models) {
            isKeyValid = true;
          } else {
            const googleMsg = testData?.error?.message || '';
            errorMessage = googleMsg || (lang === 'th' ? 'API Key ไม่ถูกต้อง หรือถูกจำกัดการเข้าถึง' : 'Invalid API Key or access restricted');
          }
        } catch (apiErr: any) {
          errorMessage = apiErr?.message || (lang === 'th' ? 'ไม่สามารถเชื่อมต่อกับ Google Gemini API ได้' : 'Failed to connect to Google Gemini API');
        }
      }

      if (isKeyValid) {
        // Save to localStorage as backup
        localStorage.setItem('k7_gemini_api_key', cleanKey);
        // Sync to Firestore for all admins & users
        await saveGeminiAiSettingsDoc(cleanKey, 'Owner').catch((e) => console.warn('Firestore sync notice:', e));
        
        const masked = serverMaskedKey || `${cleanKey.slice(0, 6)}...${cleanKey.slice(-4)}`;
        setServerStatus({
          configured: true,
          maskedKey: masked
        });
        setStatus({
          type: 'success',
          message: lang === 'th'
            ? '✅ ยืนยัน API Key สำเร็จ! ระบบ AI OCR พร้อมใช้งานแล้ว'
            : '✅ Gemini API Key verified & connected successfully!'
        });
        sounds.playClaim();
        if (onKeySaved) onKeySaved(cleanKey);
      } else {
        setStatus({
          type: 'error',
          message: errorMessage || (lang === 'th' ? 'API Key ไม่ถูกต้อง' : 'Invalid API Key')
        });
        sounds.playError();
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err?.message || (lang === 'th' ? 'เกิดข้อผิดพลาดในการตรวจสอบ Key' : 'Error testing API Key')
      });
      sounds.playError();
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearKey = async () => {
    localStorage.removeItem('k7_gemini_api_key');
    saveGeminiAiSettingsDoc('', 'Owner').catch(() => {});
    setApiKey('');
    setServerStatus({ configured: false, maskedKey: null });
    setStatus({
      type: 'idle',
      message: lang === 'th' ? 'ล้างข้อมูล Key เรียบร้อยแล้ว' : 'Key has been cleared'
    });
    sounds.playClick();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0e1626] border border-[#38bdf8]/40 shadow-2xl p-6 space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{t.geminiKeyModalTitle}</span>
                <Sparkles className="w-4 h-4 text-sky-400" />
              </h2>
              <p className="text-xs text-slate-400">Google Gemini 2.5 Flash Engine</p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicator */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border ${
            serverStatus.configured
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {serverStatus.configured ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-semibold">
              {serverStatus.configured
                ? `${t.geminiKeyStatusConnected} (${serverStatus.maskedKey})`
                : t.geminiKeyStatusMissing}
            </span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              serverStatus.configured
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {serverStatus.configured ? 'AI READY' : 'OFFLINE'}
          </span>
        </div>

        {/* Quick Instructions & Free Link */}
        <div className="p-3.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs space-y-2 text-slate-300">
          <div className="flex items-center justify-between font-semibold text-slate-200">
            <span>{lang === 'th' ? '💡 วิธีรับ API Key ฟรี (ไม่มีค่าบริการ):' : '💡 How to get a free API Key:'}</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
            >
              <span>Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
            {lang === 'th' ? (
              <>
                <li>เข้าสู่เว็บไซต์ Google AI Studio ด้วยบัญชี Google ของท่าน</li>
                <li>กดปุ่ม <strong>"Create API key"</strong> เพื่อสร้างคีย์ใหม่</li>
                <li>คัดลอกรหัสคีย์ (ขึ้นต้นด้วย <code>AIzaSy...</code>) มาวางในช่องด้านล่าง</li>
                <li>กดปุ่ม <strong>"ทดสอบและบันทึก Key"</strong> เพื่อเปิดใช้งานระบบสแกน</li>
              </>
            ) : (
              <>
                <li>Visit Google AI Studio with your Google account.</li>
                <li>Click <strong>"Create API key"</strong> to generate a key.</li>
                <li>Copy the key (starts with <code>AIzaSy...</code>) and paste it below.</li>
                <li>Click <strong>"Test & Save Key"</strong> to activate AI OCR scanner.</li>
              </>
            )}
          </ol>
        </div>

        {/* Input Box */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Google Gemini API Key</span>
            </span>
            {serverStatus.configured && isOwner && (
              <button
                type="button"
                onClick={handleClearKey}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>{t.geminiKeyClearBtn}</span>
              </button>
            )}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder={isOwner ? t.geminiKeyInputPlaceholder : t.geminiOwnerOnlyHint}
              disabled={!isOwner}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={`w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#090d16] border text-xs font-mono focus:outline-none transition-colors ${
                !isOwner ? 'border-slate-800 text-slate-500 cursor-not-allowed' : 'border-slate-700 focus:border-[#38bdf8] text-slate-100'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {status.message && (
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
              status.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-600/50 text-emerald-300'
                : status.type === 'error'
                ? 'bg-red-950/50 border-red-600/50 text-red-300'
                : 'bg-sky-950/50 border-sky-600/50 text-sky-300'
            }`}
          >
            {status.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />}
            {status.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />}
            {status.type === 'idle' && <RefreshCw className="w-4 h-4 shrink-0 text-sky-400 animate-spin mt-0.5" />}
            <span className="flex-1">{status.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
          >
            {lang === 'th' ? 'ปิด' : 'Close'}
          </button>
          {isOwner ? (
            <button
              type="button"
              disabled={isTesting || !apiKey.trim()}
              onClick={handleTestAndSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-sky-950 cursor-pointer transition-all"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.geminiKeyTesting}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.geminiKeyTestAndSave}</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-[11px] text-amber-400 font-medium">
              {t.geminiOwnerOnlyHint}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
