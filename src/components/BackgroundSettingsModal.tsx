import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Sun,
  Sliders,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Globe,
  Link as LinkIcon
} from 'lucide-react';
import { Language } from '../types';
import { sounds } from '../utils/sound';

export interface BackgroundConfig {
  imageUrl: string;
  brightness: number; // 20 - 100
  blur: number; // 0 - 10
  vignetteOpacity: number; // 0.2 - 0.95
}

export const DEFAULT_BG_CONFIG: BackgroundConfig = {
  imageUrl: '/fantasy-original.png',
  brightness: 70,
  blur: 0,
  vignetteOpacity: 0.65
};

export const PRESET_WALLPAPERS = [
  {
    id: 'preset_classic',
    nameTh: 'ปราสาทคลาสสิก (Classic Castle)',
    nameEn: 'Classic Castle',
    url: '/fantasy-original.png',
  },
  {
    id: 'preset_dragon',
    nameTh: 'หุบเขามังกร (Dragon Lair)',
    nameEn: 'Dragon Valley Lair',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop',
  },
  {
    id: 'preset_citadel',
    nameTh: 'มหาวิหารศักดิ์สิทธิ์ (Holy Citadel)',
    nameEn: 'Holy Citadel Cathedral',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1920&auto=format&fit=crop',
  },
  {
    id: 'preset_night',
    nameTh: 'ป้อมราตรี (Night Fortress)',
    nameEn: 'Moonlit Fortress',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1920&auto=format&fit=crop',
  }
];

// Helper to compress high-res images to safe web size (<350KB)
const compressImage = (file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.82): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface BackgroundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  config: BackgroundConfig;
  onChangeConfig: (newConfig: BackgroundConfig, syncGlobally?: boolean) => void;
  isAdminOrOwner?: boolean;
}

export const BackgroundSettingsModal: React.FC<BackgroundSettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  config,
  onChangeConfig,
  isAdminOrOwner = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage(lang === 'th' ? 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' : 'Please choose an image file only');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setUploadSuccess(false);

    try {
      const compressedDataUrl = await compressImage(file);

      // 1. Update UI and sync globally to Firestore if Admin/Owner
      const updatedConfig = {
        ...config,
        imageUrl: compressedDataUrl
      };
      onChangeConfig(updatedConfig, isAdminOrOwner);

      // 2. Also try writing to local server cache
      try {
        const res = await fetch('/api/save-background', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compressedDataUrl })
        });
        const data = await res.json();
        if (data.url) {
          const serverConfig = { ...updatedConfig, imageUrl: data.url };
          onChangeConfig(serverConfig, isAdminOrOwner);
        }
      } catch {
        // base64 in Firestore works seamlessly across all clients
      }

      sounds.playClaim();
      setIsUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3500);
    } catch {
      setIsUploading(false);
      setErrorMessage(lang === 'th' ? 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ' : 'Image processing failed');
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    sounds.playClick();
    const updatedConfig = {
      ...config,
      imageUrl: trimmed
    };
    onChangeConfig(updatedConfig, isAdminOrOwner);
    setUrlInput('');
    setShowUrlInput(false);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3500);
  };

  const handleSelectPreset = (url: string) => {
    sounds.playClick();
    const updatedConfig = {
      ...config,
      imageUrl: url
    };
    onChangeConfig(updatedConfig, isAdminOrOwner);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3500);
  };

  const handleReset = () => {
    sounds.playClick();
    onChangeConfig(DEFAULT_BG_CONFIG, isAdminOrOwner);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg fantasy-modal rounded-2xl p-6 overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-[#d4af37]/40 text-[#f5d77f]">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-lg font-bold text-slate-100">
                  {lang === 'th' ? 'ตั้งค่าภาพพื้นหลัง' : 'Wallpaper & Background Settings'}
                </h3>
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'th'
                  ? 'ปรับแต่งภาพพื้นหลังและบรรยากาศปราสาท Lineage 2M'
                  : 'Customize castle background atmosphere and brightness'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Sync Banner */}
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900/60 to-slate-900/80 border border-[#d4af37]/30 flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-[#d4af37] shrink-0 animate-pulse" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            {lang === 'th' ? (
              <span>
                <strong className="text-[#f5d77f]">ซิงค์ทุกคนในกิลด์: </strong>
                เมื่อ Owner หรือ Admin เปลี่ยนแปลงภาพพื้นหลัง ทุกคนที่เปิดเว็บไซต์จะเห็นภาพและแสงเงาตรงกันทันทีแบบ Real-time
              </span>
            ) : (
              <span>
                <strong className="text-[#f5d77f]">Global Clan Sync: </strong>
                When Owner/Admin updates this wallpaper, all members see the changes instantly in real-time.
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-5">

          {/* Current Preview */}
          <div className="relative h-36 rounded-xl overflow-hidden border border-slate-700/80 shadow-inner group">
            <img
              src={config.imageUrl}
              alt="Wallpaper preview"
              className="w-full h-full object-cover transition-all"
              style={{
                filter: `brightness(${config.brightness}%) blur(${config.blur}px)`
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/fantasy-original.png';
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, rgba(10,18,34,${config.vignetteOpacity * 0.5}) 0%, rgba(4,8,16,${config.vignetteOpacity}) 100%)`
              }}
            />
            {isAdminOrOwner && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-[#d4af37] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg hover:brightness-110 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'อัปโหลดภาพ...' : 'Upload...'}</span>
                </button>
                <button
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 shadow-lg hover:bg-slate-700 cursor-pointer"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>{lang === 'th' ? 'ใส่ลิงก์ URL' : 'Image URL'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Preset Wallpapers */}
          {isAdminOrOwner && (
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block flex items-center justify-between">
                <span>{lang === 'th' ? 'เลือกภาพธีมสำเร็จรูป' : 'Preset Wallpapers'}</span>
                <span className="text-[10px] text-[#d4af37]">{lang === 'th' ? 'คลิกเพื่อเปลี่ยนทันที' : 'Click to apply'}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_WALLPAPERS.map((preset) => {
                  const isSelected = config.imageUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url)}
                      className={`relative p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer overflow-hidden ${
                        isSelected
                          ? 'border-[#d4af37] bg-amber-500/15 ring-1 ring-[#d4af37]'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-850'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-700">
                        <img
                          src={preset.url}
                          alt={preset.nameEn}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/fantasy-original.png';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${isSelected ? 'text-[#f5d77f]' : 'text-slate-300'}`}>
                          {lang === 'th' ? preset.nameTh : preset.nameEn}
                        </p>
                        <span className="text-[10px] text-slate-500 block">
                          {isSelected ? (lang === 'th' ? '✓ ใช้งานอยู่' : '✓ Active') : (lang === 'th' ? 'คลิกเลือก' : 'Select')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Direct URL Input Modal Toggle */}
          {isAdminOrOwner && showUrlInput && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-[#d4af37]/40 space-y-2 animate-in fade-in duration-200">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>{lang === 'th' ? 'วางลิงก์ URL รูปภาพ (Discord, Imgur หรือเว็บภาพ):' : 'Paste Direct Image URL:'}</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3 py-1.5 rounded-lg bg-[#d4af37] text-slate-950 font-bold text-xs hover:brightness-110 cursor-pointer"
                >
                  {lang === 'th' ? 'ใช้รูปนี้' : 'Apply'}
                </button>
              </div>
            </div>
          )}

          {/* Upload New Custom Image (Admin / Owner only) */}
          {isAdminOrOwner && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl border border-dashed border-[#d4af37]/60 bg-amber-500/5 hover:bg-amber-500/10 text-[#f5d77f] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#d4af37]" />
                <span>
                  {isUploading
                    ? (lang === 'th' ? 'กำลังบีบอัดและบันทึกรูปภาพ...' : 'Compressing and uploading image...')
                    : (lang === 'th' ? 'คลิกเพื่ออัปโหลดรูปภาพใหม่จากเครื่องของคุณ (ซิงค์ทุกคน)' : 'Upload custom wallpaper from your device')}
                </span>
              </button>

              {uploadSuccess && (
                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {lang === 'th'
                      ? 'บันทึกและซิงค์ภาพพื้นหลังไปยังสมาชิกทุกคนสำเร็จแล้ว!'
                      : 'Wallpaper synchronized to all members successfully!'}
                  </span>
                </div>
              )}

              {errorMessage && (
                <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Atmosphere Sliders */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{lang === 'th' ? 'ปรับแต่งแสงและบรรยากาศ (Atmosphere Controls)' : 'Atmosphere Controls'}</span>
            </h4>
            
            {/* Brightness */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-[#f5d77f]" />
                  <span>{lang === 'th' ? 'ความสว่างภาพพื้นหลัง' : 'Background Brightness'}</span>
                </span>
                <span className="font-mono text-[#f5d77f]">{config.brightness}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={config.brightness}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const newC = { ...config, brightness: val };
                  onChangeConfig(newC, false);
                }}
                onMouseUp={() => {
                  if (isAdminOrOwner) onChangeConfig(config, true);
                }}
                onTouchEnd={() => {
                  if (isAdminOrOwner) onChangeConfig(config, true);
                }}
                className="w-full accent-[#d4af37] cursor-pointer"
              />
            </div>

            {/* Darkness Vignette / Contrast */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>{lang === 'th' ? 'ระดับโอเวอร์เลย์ความมืดเพื่อความอ่านง่าย' : 'Vignette Darkness Overlay'}</span>
                </span>
                <span className="font-mono text-sky-300">{Math.round(config.vignetteOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="95"
                step="5"
                value={Math.round(config.vignetteOpacity * 100)}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) / 100;
                  const newC = { ...config, vignetteOpacity: val };
                  onChangeConfig(newC, false);
                }}
                onMouseUp={() => {
                  if (isAdminOrOwner) onChangeConfig(config, true);
                }}
                onTouchEnd={() => {
                  if (isAdminOrOwner) onChangeConfig(config, true);
                }}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            {/* Blur */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>{lang === 'th' ? 'ความเบลอภาพพื้นหลัง' : 'Background Soft Blur'}</span>
                </span>
                <span className="font-mono text-purple-300">{config.blur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={config.blur}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const newC = { ...config, blur: val };
                  onChangeConfig(newC, false);
                }}
                onMouseUp={() => {
                  if (isAdminOrOwner) onChangeConfig(config, true);
                }}
                onTouchEnd={() => {
                  if (isAdminOrOwner) onChangeConfig(config, true);
                }}
                className="w-full accent-purple-400 cursor-pointer"
              />
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'th' ? 'คืนค่าเริ่มต้น' : 'Reset to Default'}</span>
          </button>

          <div className="flex items-center gap-2">
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClaim();
                  onChangeConfig(config, true);
                  setUploadSuccess(true);
                  setTimeout(() => setUploadSuccess(false), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-[#d4af37]/40 text-[#f5d77f] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>{lang === 'th' ? 'ซิงค์ทุกคน' : 'Sync to All'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg cursor-pointer"
            >
              {lang === 'th' ? 'เสร็จสิ้น' : 'Done'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

