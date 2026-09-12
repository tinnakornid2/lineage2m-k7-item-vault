import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Swords,
  Shield,
  Crown,
  Flame,
  Star,
  Image as ImageIcon,
  RotateCcw,
  ArrowLeft,
  X,
  User as UserIcon,
  UserCheck,
  HelpCircle,
  Check,
  ChevronDown,
  Lock,
  Eye,
  Maximize2,
  ExternalLink
} from 'lucide-react';
import { User, FormulaSettings, OFFICIAL_CLASSES, ActiveTab, StatHistoryPoint, ClanGroup, UserRole, UserStatus, cleanClanName, OFFICIAL_CLANS } from '../types';
import { getFormulaSettings, calculatePowerLevel } from '../services/powerFormulaService';
import { compressImageFile } from '../utils/imageCompressor';
import { sounds } from '../utils/sound';
import { ScreenshotGuideModal } from './ScreenshotGuideModal';
import { GrowthTimelineChart } from './GrowthTimelineChart';

interface MyStatsViewProps {
  currentUser: User | null;
  lang: 'th' | 'en';
  clans?: ClanGroup[];
  onUpdateMember?: (userId: string, updates: Partial<User>) => Promise<void>;
  onRequestStatUpdate: (
    userId: string,
    newStats: Record<string, number>,
    newSpiritEnhancements: Record<string, number>,
    newPowerLevel: number,
    screenshotUrl?: string,
    profileData?: {
      classes?: string[];
      level?: number;
      legendClasses?: number;
      legendAgathions?: number;
      inGameName?: string;
      role?: UserRole;
      status?: UserStatus;
      clan?: string;
    }
  ) => Promise<void>;
  onCancelPendingRequest?: (userId: string) => Promise<void>;
  onNavigateTab?: (tab: ActiveTab) => void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onViewImageZoom?: (url: string, title?: string) => void;
  onSaveHistory?: (newHistory: StatHistoryPoint[]) => Promise<void>;
}

export const MyStatsView: React.FC<MyStatsViewProps> = ({
  currentUser,
  lang,
  clans,
  onUpdateMember,
  onRequestStatUpdate,
  onCancelPendingRequest,
  onNavigateTab,
  showToast,
  onViewImageZoom,
  onSaveHistory
}) => {
  const [formulaSettings, setFormulaSettings] = useState<FormulaSettings>(getFormulaSettings());

  useEffect(() => {
    const handleFormulaUpdated = (e: any) => {
      if (e?.detail) setFormulaSettings(e.detail);
      else setFormulaSettings(getFormulaSettings());
    };
    window.addEventListener('l2m_formula_settings_updated', handleFormulaUpdated);
    return () => window.removeEventListener('l2m_formula_settings_updated', handleFormulaUpdated);
  }, []);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [spiritEnhancements, setSpiritEnhancements] = useState<Record<string, number>>({});
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProofPinned, setIsProofPinned] = useState(false);
  const [pinnedProofSize, setPinnedProofSize] = useState<'normal' | 'large' | 'split'>('normal');
  const [pinnedProofZoom, setPinnedProofZoom] = useState<number>(1);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [charLevel, setCharLevel] = useState<number>(0);
  const [charLegendClasses, setCharLegendClasses] = useState<number>(0);
  const [charLegendAgathions, setCharLegendAgathions] = useState<number>(0);

  // Security & Permissions: Only Owner and Admin can edit Role, Status, and Clan
  const isOwner = currentUser?.role === 'owner' || currentUser?.id === 'user_owner_eloni' || currentUser?.username?.toLowerCase() === 'eloni' || currentUser?.inGameName?.toLowerCase() === 'eloni';
  const isAdmin = currentUser?.role === 'admin';
  const canEditAdminFields = isOwner || isAdmin;

  // Profile Identity & Placement State (matching user image)
  const [inGameName, setInGameName] = useState<string>(currentUser?.inGameName || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(isOwner ? 'owner' : (currentUser?.role || 'member'));
  const [isActiveStatus, setIsActiveStatus] = useState<boolean>(currentUser?.status === 'active');
  const [selectedClan, setSelectedClan] = useState<string>(currentUser?.clan || 'VoltZ');

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Available Clan Options
  const clanOptions = useMemo(() => {
    const list: string[] = [];
    if (clans && clans.length > 0) {
      clans.forEach((c) => {
        const name = cleanClanName(c.name);
        if (name && !list.includes(name)) list.push(name);
      });
    } else {
      OFFICIAL_CLANS.forEach((c) => {
        const name = cleanClanName(c.name);
        if (name && !list.includes(name)) list.push(name);
      });
    }
    if (currentUser?.clan) {
      const cur = cleanClanName(currentUser.clan);
      if (cur && !list.includes(cur)) list.push(cur);
    }
    return list;
  }, [clans, currentUser?.clan]);

  // Synchronize stats and profile from currentUser
  useEffect(() => {
    if (currentUser) {
      const config = getFormulaSettings();
      setFormulaSettings(config);

      const currentStats = currentUser.pendingStats || currentUser.stats || {};
      const currentSpirits = currentUser.pendingSpiritEnhancements || currentUser.spiritEnhancements || {};

      const initialStats: Record<string, number> = {};
      const initialSpirits: Record<string, number> = {};

      config.stats.forEach((stat) => {
        initialStats[stat.id] = currentStats[stat.id] ?? 0;
        if (stat.inputType === 'spirit_card') {
          initialSpirits[stat.id] = currentSpirits[stat.id] ?? 0;
        }
      });

      setStats(initialStats);
      setSpiritEnhancements(initialSpirits);
      setScreenshotUrl(currentUser.pendingStatScreenshotUrl || currentUser.statScreenshotUrl || '');

      // Profile fields
      const isOwnerAcc = currentUser.role === 'owner' || currentUser.id === 'user_owner_eloni' || currentUser.username?.toLowerCase() === 'eloni' || currentUser.inGameName?.toLowerCase() === 'eloni';
      setInGameName(currentUser.inGameName || '');
      setSelectedRole(isOwnerAcc ? 'owner' : (currentUser.role || 'member'));
      setIsActiveStatus(currentUser.status === 'active');
      setSelectedClan(currentUser.clan || 'VoltZ');

      // Character Profile (classes, level, legends)
      const initialClasses = currentUser.pendingClasses !== undefined && currentUser.pendingClasses !== null
        ? currentUser.pendingClasses
        : (currentUser.classes || (currentUser.characterClass ? [currentUser.characterClass] : []));
      setSelectedClasses(initialClasses);

      const initialLevel = currentUser.pendingLevel !== undefined && currentUser.pendingLevel !== null
        ? currentUser.pendingLevel
        : (currentUser.level || 0);
      setCharLevel(initialLevel);

      const initialLegendClasses = currentUser.pendingLegendClasses !== undefined && currentUser.pendingLegendClasses !== null
        ? currentUser.pendingLegendClasses
        : (currentUser.legendClasses || 0);
      setCharLegendClasses(initialLegendClasses);

      const initialLegendAgathions = currentUser.pendingLegendAgathions !== undefined && currentUser.pendingLegendAgathions !== null
        ? currentUser.pendingLegendAgathions
        : (currentUser.legendAgathions || 0);
      setCharLegendAgathions(initialLegendAgathions);

      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(false);
    }
  }, [currentUser]);

  // Global Ctrl + V paste listener on the page
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processScreenshotFile(file, true);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  if (!currentUser) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="size-12 mx-auto text-amber-400" />
        <h2 className="text-xl font-bold text-white">
          {lang === 'th' ? 'กรุณาเข้าสู่ระบบก่อนจัดการสเตตัส' : 'Please log in to view your stats'}
        </h2>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('dashboard')}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
          >
            {lang === 'th' ? 'กลับหน้าหลัก' : 'Back to Dashboard'}
          </button>
        )}
      </div>
    );
  }

  const processScreenshotFile = async (file: File, isPaste = false) => {
    try {
      sounds.playClick();
      const compressed = await compressImageFile(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 });
      setScreenshotUrl(compressed);
      if (showToast) {
        showToast(
          lang === 'th' ? 'แนบภาพสกรีนช็อตสำเร็จ (Ctrl + V) 📋' : 'Screenshot attached from clipboard 📋',
          'success'
        );
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshotUrl(reader.result as string);
        sounds.playClick();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processScreenshotFile(file, false);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          await processScreenshotFile(files[i], false);
          break;
        }
      }
    }
  };

  const handleStatNumberChange = (statId: string, val: string) => {
    const num = val === '' ? 0 : parseFloat(val);
    setStats((prev) => ({
      ...prev,
      [statId]: isNaN(num) ? 0 : Math.max(0, num)
    }));
  };

  const handleSpiritEnhancementSelect = (statId: string, tier: number) => {
    sounds.playClick();
    setSpiritEnhancements((prev) => ({
      ...prev,
      [statId]: tier
    }));
  };

  const handleToggleClass = (classNameEn: string) => {
    sounds.playClick();
    setSelectedClasses((prev) =>
      prev.includes(classNameEn)
        ? prev.filter((c) => c !== classNameEn)
        : [...prev, classNameEn]
    );
  };

  const isLeader = isOwner || selectedRole === 'party_leader' || selectedRole === 'manager' || selectedRole === 'admin' || selectedRole === 'owner';

  const handleRoleChange = async (type: 'member' | 'leader') => {
    sounds.playClick();
    if (!canEditAdminFields) {
      if (showToast) {
        showToast(
          lang === 'th'
            ? '🔒 สิทธิ์นี้เฉพาะ Owner และ Admin เท่านั้น'
            : '🔒 Only Owner and Admin can change roles',
          'warning'
        );
      }
      return;
    }

    if (isOwner) {
      if (type === 'member') {
        if (showToast) {
          showToast(
            lang === 'th'
              ? '👑 บัญชี Owner เป็นหัวหน้ากิลด์สูงสุด ไม่สามารถเปลี่ยนเป็น Member ได้'
              : '👑 Owner is the supreme leader and cannot be changed to Member',
            'warning'
          );
        }
        return;
      }
      setSelectedRole('owner');
      return;
    }

    let newRole: UserRole = 'member';
    if (type === 'leader') {
      newRole = (currentUser.role === 'admin' || currentUser.role === 'manager')
        ? currentUser.role
        : 'party_leader';
    }
    setSelectedRole(newRole);
    if (onUpdateMember) {
      try {
        await onUpdateMember(currentUser.id, { role: newRole });
        if (showToast) {
          showToast(
            type === 'leader'
              ? (lang === 'th' ? 'เปลี่ยนบทบาทเป็น 👑 Leader เรียบร้อยแล้ว' : 'Role set to 👑 Leader')
              : (lang === 'th' ? 'เปลี่ยนบทบาทเป็น Member เรียบร้อยแล้ว' : 'Role set to Member'),
            'info'
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleStatus = async () => {
    sounds.playClick();
    if (!canEditAdminFields) {
      if (showToast) {
        showToast(
          lang === 'th'
            ? '🔒 สิทธิ์นี้เฉพาะ Owner และ Admin เท่านั้น'
            : '🔒 Only Owner and Admin can change status',
          'warning'
        );
      }
      return;
    }
    const nextStatus = !isActiveStatus;
    setIsActiveStatus(nextStatus);
    if (onUpdateMember) {
      try {
        await onUpdateMember(currentUser.id, { status: nextStatus ? 'active' : 'pending_approval' });
        if (showToast) {
          showToast(
            nextStatus
              ? (lang === 'th' ? 'สถานะ: Active (เปิดใช้งาน)' : 'Status: Active')
              : (lang === 'th' ? 'สถานะ: Inactive (ระงับชั่วคราว)' : 'Status: Inactive'),
            'info'
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleClanChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    sounds.playClick();
    if (!canEditAdminFields) {
      if (showToast) {
        showToast(
          lang === 'th'
            ? '🔒 สิทธิ์นี้เฉพาะ Owner และ Admin เท่านั้น'
            : '🔒 Only Owner and Admin can change clan',
          'warning'
        );
      }
      return;
    }
    const newClan = e.target.value;
    setSelectedClan(newClan);
    if (onUpdateMember) {
      try {
        await onUpdateMember(currentUser.id, { clan: newClan });
        if (showToast) {
          showToast(lang === 'th' ? `เปลี่ยนสังกัดแคลนเป็น ${newClan} แล้ว` : `Clan set to ${newClan}`, 'success');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleIgnBlur = async () => {
    const trimmed = inGameName.trim();
    if (!trimmed || trimmed === currentUser.inGameName) return;
    if (onUpdateMember) {
      try {
        await onUpdateMember(currentUser.id, { inGameName: trimmed });
        if (showToast) {
          showToast(lang === 'th' ? `เปลี่ยนชื่อตัวละครเป็น ${trimmed} แล้ว` : `In-Game Name updated to ${trimmed}`, 'success');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Live Real-Time Power Level Calculation
  const currentVerifiedPL = currentUser.powerLevel || 0;
  const calculatedNewPL = calculatePowerLevel(stats, spiritEnhancements, formulaSettings, false);
  const plDiff = calculatedNewPL - currentVerifiedPL;

  const hasPending = Boolean(currentUser.pendingPowerLevel && currentUser.pendingPowerLevel > 0);
  const isRejected = Boolean(currentUser.statRejectionReason);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Determine effective Power Level: calculate from entered stats or retain existing verified PL
    const finalPL = calculatedNewPL > 0 ? calculatedNewPL : (currentUser.powerLevel || 0);

    // Only block if literally no stats, no PL, no level, and no classes entered
    if (finalPL <= 0 && (!charLevel || charLevel <= 0) && selectedClasses.length === 0) {
      setErrorMessage(
        lang === 'th'
          ? 'กรุณากรอกข้อมูลสเตตัส เลเวล หรือเลือกคลาสตัวละครก่อนกดบันทึก'
          : 'Please enter stats, character level, or select classes before saving'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      sounds.playClaim();
      await onRequestStatUpdate(
        currentUser.id,
        stats,
        spiritEnhancements,
        finalPL,
        screenshotUrl || undefined,
        {
          inGameName: inGameName.trim() || currentUser.inGameName,
          role: isOwner ? 'owner' : (canEditAdminFields ? selectedRole : currentUser.role),
          status: canEditAdminFields ? (isActiveStatus ? 'active' : 'pending_approval') : currentUser.status,
          clan: canEditAdminFields ? selectedClan : currentUser.clan,
          classes: selectedClasses,
          level: charLevel,
          legendClasses: charLegendClasses,
          legendAgathions: charLegendAgathions
        }
      );
      setSuccessMessage(
        lang === 'th'
          ? 'ส่งคำขออัปเดตสเตตัสเรียบร้อยแล้ว! รอแอดมินหรือโอเนอร์ตรวจสอบและอนุมัติ ⚡'
          : 'Stat update request submitted! Waiting for Admin/Owner approval ⚡'
      );
      if (showToast) {
        showToast(
          lang === 'th' ? 'ส่งคำขออัปเดตสเตตัสสำเร็จ (รออนุมัติ) ⚡' : 'Stat update request submitted (Pending approval) ⚡',
          'success'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPending = async () => {
    if (!onCancelPendingRequest) return;
    setIsSubmitting(true);
    try {
      sounds.playClick();
      await onCancelPendingRequest(currentUser.id);
      setSuccessMessage(lang === 'th' ? 'ยกเลิกคำขอเรียบร้อยแล้ว' : 'Pending request cancelled');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group stats by categories
  const activeStats = formulaSettings.stats.filter((s) => s.isActive);
  const combatAndDefenseStats = activeStats.filter(
    (s) => (s.category === 'combat' || s.category === 'defense') && s.inputType !== 'spirit_card'
  );
  const spiritStats = activeStats.filter((s) => s.inputType === 'spirit_card');
  const otherStats = activeStats.filter(
    (s) => s.category === 'special' || s.category === 'custom'
  );

  // Spirit Color Schemes matching Kain7 reference
  const getSpiritColorConfig = (statId: string) => {
    if (statId.includes('soulshot')) {
      return {
        name: 'Soulshot',
        icon: '✨',
        activeClass: 'border-blue-500 bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/30'
      };
    }
    if (statId.includes('valor')) {
      return {
        name: 'Valor',
        icon: '⚔️',
        activeClass: 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/30'
      };
    }
    if (statId.includes('guardian')) {
      return {
        name: 'Guardian',
        icon: '🛡️',
        activeClass: 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-500/30'
      };
    }
    if (statId.includes('conquer')) {
      return {
        name: 'Conquer',
        icon: '👑',
        activeClass: 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-sm shadow-purple-500/30'
      };
    }
    // Duel or default
    return {
      name: 'Duel',
      icon: '⚡',
      activeClass: 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-sm shadow-rose-500/30'
    };
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-16">
      {/* ── TOP NAV / RETURN BAR ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onNavigateTab('dashboard');
              }}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition border border-zinc-700"
              title={lang === 'th' ? 'กลับแดชบอร์ด' : 'Dashboard'}
            >
              <ArrowLeft className="size-4" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white">
                {lang === 'th' ? 'สเตตัสและความก้าวหน้าของฉัน' : 'My Stats & Progression'}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                {formulaSettings.name || 'Kain7 Formula'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {currentUser.inGameName} • {currentUser.clan || 'No Clan'} • {currentUser.characterClass || 'No Class'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Current Verified Power Badge */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-zinc-850 border border-zinc-700 shadow-md">
            <div className="size-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Zap className="size-4" />
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase font-bold text-zinc-400">
                {lang === 'th' ? 'ค่าพลังยืนยันแล้ว' : 'Verified Power'}
              </div>
              <div className="text-sm sm:text-base font-black text-amber-400 font-mono leading-none">
                ⚡ {currentVerifiedPL.toLocaleString()} PL
              </div>
            </div>
          </div>

          {/* Quick Screenshot Indicator & Scroll Trigger */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('screenshot-upload-card');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer shadow-md ${
              screenshotUrl
                ? 'bg-zinc-850 border-emerald-500/50 text-emerald-300 hover:border-emerald-400'
                : 'bg-zinc-850 border-zinc-700 text-zinc-400 hover:border-amber-500/60 hover:text-amber-300'
            }`}
            title={screenshotUrl ? (lang === 'th' ? 'มีรูปแนบแล้ว คลิกดูหรือแก้ไข' : 'Screenshot attached') : (lang === 'th' ? 'ยังไม่ได้แนบรูป คลิกเพื่อไปที่กล่องแนบรูป' : 'No screenshot attached')}
          >
            {screenshotUrl ? (
              <>
                <img
                  src={screenshotUrl}
                  alt="Proof thumbnail"
                  className="size-6 rounded object-cover border border-emerald-500/40 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewImageZoom?.(screenshotUrl, 'Stat Proof');
                  }}
                />
                <span className="font-semibold hidden sm:inline">
                  {currentUser.pendingStatScreenshotUrl && screenshotUrl === currentUser.pendingStatScreenshotUrl
                    ? (lang === 'th' ? 'รูปแนบ (รอตรวจ)' : 'Proof (Pending)')
                    : currentUser.statScreenshotUrl && screenshotUrl === currentUser.statScreenshotUrl
                    ? (lang === 'th' ? 'รูปหลักฐานยืนยันแล้ว' : 'Proof (Verified)')
                    : (lang === 'th' ? 'รูปที่เลือก' : 'Proof Selected')}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">✓</span>
              </>
            ) : (
              <>
                <ImageIcon className="size-4 text-zinc-400 shrink-0" />
                <span className="font-semibold hidden sm:inline">
                  {lang === 'th' ? 'แนบสกรีนช็อต' : 'Screenshot'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-750 text-zinc-400 font-mono">0</span>
              </>
            )}
          </button>

          {/* Quick Header Save Button */}
          <button
            type="submit"
            form="mystats-form"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs tracking-wide shadow-md shadow-amber-500/20 transition active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? (
              <RotateCcw className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5 fill-slate-950" />
            )}
            <span>{lang === 'th' ? 'บันทึก (Save)' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Admin Rejection Alert Banner */}
      {isRejected && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs flex items-center justify-between gap-3 text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4 text-rose-400 shrink-0" />
            <span>
              <strong className="text-rose-300">{lang === 'th' ? 'คำขอไม่ผ่าน: ' : 'Rejected: '}</strong>
              "{currentUser.statRejectionReason}"
            </span>
          </div>
          <span className="text-[10px] text-rose-400 shrink-0">
            {lang === 'th' ? 'กรุณาแก้ไขและส่งคำขอใหม่' : 'Please adjust & resubmit'}
          </span>
        </div>
      )}

      {/* Pending Request Banner */}
      {hasPending && (
        <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/50 text-xs flex items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 text-amber-400 animate-spin shrink-0" />
            <span>
              {lang === 'th'
                ? `มีคำขออัปเดต (${currentUser.pendingPowerLevel?.toLocaleString()} PL) รอแอดมินตรวจ`
                : `Update request (${currentUser.pendingPowerLevel?.toLocaleString()} PL) pending`}
            </span>
          </div>
          {onCancelPendingRequest && (
            <button
              type="button"
              onClick={handleCancelPending}
              disabled={isSubmitting}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold border border-zinc-700 shrink-0"
            >
              {lang === 'th' ? 'ยกเลิกคำขอ' : 'Cancel'}
            </button>
          )}
        </div>
      )}

      {/* ── 2-COLUMN AUTHENTIC KAIN7 DASHBOARD GRID ────────────────── */}
      <form id="mystats-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ══════════════════════════════════════════════════════════
              LEFT SIDEBAR (4 COLS): INFO, SCREENSHOTS, LIVE PL, PROGRESSION
             ══════════════════════════════════════════════════════════ */}
          <div className="order-1 lg:order-1 lg:col-span-4 space-y-4">
            
            {/* 1. MEMBER INFORMATION CARD (Matching Kain7 Design) */}
            <div className="rounded-2xl bg-zinc-850/95 border border-zinc-700/80 p-5 space-y-4 shadow-xl">
              <div className="flex items-start gap-3.5 pb-3.5 border-b border-zinc-700/70">
                <span className="size-12 rounded-2xl bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-300 shrink-0 shadow-inner">
                  <UserIcon className="size-5 text-zinc-300 fill-zinc-300" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {lang === 'th' ? 'ข้อมูลสมาชิก' : 'Member Information'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    {lang === 'th'
                      ? 'ตัวตน บทบาท สังกัดแคลน และสถานะของตัวละคร'
                      : 'Identity, role, clan placement, and profile-level settings.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* 1. In-Game Name */}
                <div>
                  <label className="block mb-1.5 font-semibold text-zinc-200 text-xs sm:text-sm">
                    {lang === 'th' ? 'ชื่อในเกม' : 'In-Game Name'} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={inGameName}
                    onChange={(e) => setInGameName(e.target.value)}
                    onBlur={handleIgnBlur}
                    placeholder={currentUser?.inGameName || 'IGN'}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-750/70 border border-zinc-700 text-white font-bold text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-500 shadow-inner"
                  />
                </div>

                {/* 2. Role Selector (Member vs 👑 Leader) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-zinc-200 text-xs sm:text-sm">
                      {lang === 'th' ? 'บทบาท' : 'Role'} <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className={`text-[10px] flex items-center gap-1 font-medium ${canEditAdminFields ? 'text-amber-400/90' : 'text-zinc-400'}`}>
                      <Lock className="size-2.5" />
                      {lang === 'th' ? 'เฉพาะ Owner / Admin' : 'Owner / Admin only'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={!canEditAdminFields || isOwner}
                      onClick={() => handleRoleChange('member')}
                      title={
                        !canEditAdminFields
                          ? (lang === 'th' ? 'เฉพาะ Owner และ Admin เท่านั้นที่สามารถเปลี่ยนบทบาทได้' : 'Only Owner and Admin can change roles')
                          : (isOwner ? (lang === 'th' ? 'บัญชี Owner เป็นหัวหน้ากิลด์สูงสุด ไม่สามารถเปลี่ยนเป็น Member ได้' : 'Owner cannot be Member') : undefined)
                      }
                      className={`py-2.5 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center shadow-sm ${
                        !canEditAdminFields || isOwner
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer'
                      } ${
                        !isLeader
                          ? 'border-2 border-zinc-300 bg-zinc-750 text-white'
                          : 'border border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:bg-zinc-750 hover:text-white'
                      }`}
                    >
                      Member
                    </button>
                    <button
                      type="button"
                      disabled={!canEditAdminFields}
                      onClick={() => handleRoleChange('leader')}
                      title={
                        !canEditAdminFields
                          ? (lang === 'th' ? 'เฉพาะ Owner และ Admin เท่านั้นที่สามารถเปลี่ยนบทบาทได้' : 'Only Owner and Admin can change roles')
                          : undefined
                      }
                      className={`py-2.5 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                        !canEditAdminFields
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer'
                      } ${
                        isLeader
                          ? 'border-2 border-[#eab308] bg-zinc-800/90 text-white shadow-[0_0_12px_rgba(234,179,8,0.25)]'
                          : 'border border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:bg-zinc-750 hover:text-amber-300'
                      }`}
                    >
                      <span>👑</span> Leader
                    </button>
                  </div>
                </div>

                {/* 3. Status Switch */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-zinc-200 text-xs sm:text-sm">
                      {lang === 'th' ? 'สถานะ' : 'Status'}
                    </label>
                    <span className={`text-[10px] flex items-center gap-1 font-medium ${canEditAdminFields ? 'text-amber-400/90' : 'text-zinc-400'}`}>
                      <Lock className="size-2.5" />
                      {lang === 'th' ? 'เฉพาะ Owner / Admin' : 'Owner / Admin only'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      type="button"
                      role="switch"
                      disabled={!canEditAdminFields}
                      aria-checked={isActiveStatus}
                      onClick={handleToggleStatus}
                      title={
                        !canEditAdminFields
                          ? (lang === 'th' ? 'เฉพาะ Owner และ Admin เท่านั้นที่สามารถเปลี่ยนสถานะได้' : 'Only Owner and Admin can change status')
                          : undefined
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        !canEditAdminFields ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      } ${
                        isActiveStatus ? 'bg-emerald-500' : 'bg-zinc-650'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isActiveStatus ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span
                      onClick={canEditAdminFields ? handleToggleStatus : undefined}
                      className={`text-sm font-bold text-white select-none ${
                        canEditAdminFields ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                      }`}
                    >
                      {isActiveStatus
                        ? (lang === 'th' ? 'Active' : 'Active')
                        : (lang === 'th' ? 'Inactive' : 'Inactive')}
                    </span>
                  </div>
                </div>

                {/* 4. Clan Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-zinc-200 text-xs sm:text-sm">
                      {lang === 'th' ? 'สังกัดแคลน' : 'Clan'}
                    </label>
                    <span className={`text-[10px] flex items-center gap-1 font-medium ${canEditAdminFields ? 'text-amber-400/90' : 'text-zinc-400'}`}>
                      <Lock className="size-2.5" />
                      {lang === 'th' ? 'เฉพาะ Owner / Admin' : 'Owner / Admin only'}
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedClan}
                      disabled={!canEditAdminFields}
                      onChange={handleClanChange}
                      title={
                        !canEditAdminFields
                          ? (lang === 'th' ? 'เฉพาะ Owner และ Admin เท่านั้นที่สามารถเปลี่ยนสังกัดแคลนได้' : 'Only Owner and Admin can change clan')
                          : undefined
                      }
                      className={`w-full appearance-none rounded-xl bg-zinc-750/70 border border-zinc-700 px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all pr-10 shadow-inner ${
                        !canEditAdminFields ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      }`}
                    >
                      {clanOptions.map((cName) => (
                        <option key={cName} value={cName} className="bg-zinc-800 text-white font-medium">
                          {cName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SCREENSHOTS CARD */}
            <div id="screenshot-upload-card" className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-5 space-y-3.5 shadow-lg scroll-mt-20">
              <div className="flex items-start gap-3 pb-3 border-b border-zinc-700">
                <span className="size-10 rounded-xl bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                  <ImageIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {lang === 'th' ? 'ภาพสกรีนช็อตหลักฐาน' : 'Screenshots Proof'}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      screenshotUrl ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-750 text-zinc-400 border border-zinc-700'
                    }`}>
                      {screenshotUrl ? (lang === 'th' ? '1 รูปแนบอยู่' : '1 Attached') : (lang === 'th' ? '0 รูป (ไม่บังคับ)' : '0 Attached')}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                    {lang === 'th'
                      ? 'อัปโหลดภาพสเตตัสในเกมเพื่อเป็นหลักฐานยืนยันความถูกต้อง (ช่วยให้แอดมินตรวจเร็วขึ้น)'
                      : 'Upload and manage screenshots used for stat verification (optional).'}
                  </p>
                </div>
              </div>

              {/* Guide trigger banner matching media_1789151129523.png */}
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="w-full group px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-750 hover:bg-zinc-700 hover:border-zinc-600 flex items-center justify-between gap-3 transition text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-8 rounded-lg bg-zinc-800 border border-zinc-600/80 flex items-center justify-center text-zinc-300 shrink-0">
                    <HelpCircle className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {lang === 'th' ? 'วิธีแคปรูปสเตตัสให้ถูกต้อง' : 'How to submit correct screenshot'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-400">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{lang === 'th' ? 'ดูตัวอย่างรูปภาพ' : 'View examples'}</span>
                    </div>
                  </div>
                </div>
                <span className="text-zinc-400 group-hover:text-white transition">›</span>
              </button>

              {/* Thumbnail Gallery Preview or Dropzone */}
              {screenshotUrl ? (
                <div className="space-y-2">
                  <div className="relative border-2 border-zinc-700 hover:border-amber-400/80 rounded-xl overflow-hidden bg-black/95 p-2 min-h-[260px] max-h-[500px] flex items-center justify-center group shadow-md transition">
                    <img
                      src={screenshotUrl}
                      alt="Proof Screenshot"
                      className="w-full h-auto max-h-[480px] object-contain rounded-lg group-hover:scale-[1.01] transition-transform duration-200 cursor-zoom-in"
                      onClick={() => onViewImageZoom?.(screenshotUrl, 'Stat Proof')}
                    />
                    
                    {/* Status Badge */}
                    <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full font-bold text-[10px] shadow backdrop-blur-sm ${
                      currentUser.pendingStatScreenshotUrl && screenshotUrl === currentUser.pendingStatScreenshotUrl
                        ? 'bg-amber-500 text-slate-950'
                        : currentUser.statScreenshotUrl && screenshotUrl === currentUser.statScreenshotUrl
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-blue-500 text-white'
                    }`}>
                      {currentUser.pendingStatScreenshotUrl && screenshotUrl === currentUser.pendingStatScreenshotUrl
                        ? (lang === 'th' ? 'รอแอดมินตรวจ' : 'Pending Review')
                        : currentUser.statScreenshotUrl && screenshotUrl === currentUser.statScreenshotUrl
                        ? (lang === 'th' ? '✓ ผ่านการตรวจแล้ว' : 'Verified Proof')
                        : (lang === 'th' ? 'รูปใหม่ที่เลือก' : 'New Image')}
                    </span>

                    {/* Action Buttons Top Right */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsProofPinned(prev => !prev)}
                        className={`size-7 rounded-lg text-xs shadow-lg transition backdrop-blur-sm cursor-pointer flex items-center justify-center ${
                          isProofPinned
                            ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-300'
                            : 'bg-black/70 hover:bg-black/90 text-zinc-200 hover:text-white'
                        }`}
                        title={lang === 'th' ? 'ตรึงรูปดูเทียบขณะกรอกสเตตัส' : 'Pin Proof beside form'}
                      >
                        📌
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewImageZoom?.(screenshotUrl, 'Stat Proof')}
                        className="size-7 rounded-lg bg-black/70 hover:bg-black/90 text-zinc-200 hover:text-white flex items-center justify-center text-xs shadow-lg transition backdrop-blur-sm cursor-pointer"
                        title={lang === 'th' ? 'คลิกขยายภาพ' : 'Zoom In'}
                      >
                        🔍
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="size-7 rounded-lg bg-black/70 hover:bg-blue-600 text-zinc-200 hover:text-white flex items-center justify-center text-xs shadow-lg transition backdrop-blur-sm cursor-pointer"
                        title={lang === 'th' ? 'เปลี่ยนรูปใหม่' : 'Change Image'}
                      >
                        🔄
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshotUrl('');
                          setIsProofPinned(false);
                        }}
                        className="size-7 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center text-xs shadow-lg transition backdrop-blur-sm cursor-pointer"
                        title={lang === 'th' ? 'ลบรูปภาพ' : 'Remove image'}
                      >
                        ✕
                      </button>
                    </div>

                    <div
                      onClick={() => onViewImageZoom?.(screenshotUrl, 'Stat Proof')}
                      className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition backdrop-blur-[1px] pointer-events-none"
                    >
                      🔍 {lang === 'th' ? 'คลิกเพื่อดูภาพขนาดเต็ม (Zoom & Pan)' : 'Click to inspect full size'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsProofPinned(prev => !prev)}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>
                        {isProofPinned
                          ? (lang === 'th' ? '📌 ซ่อนหน้าต่างตรึงรูป' : '📌 Hide Pinned Proof')
                          : (lang === 'th' ? '📌 ตรึงรูปดูเทียบขณะกรอกสเตตัส' : '📌 Pin Proof Reference')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-zinc-400 hover:text-zinc-200 hover:underline cursor-pointer"
                    >
                      {lang === 'th' ? '🔄 เปลี่ยนรูปภาพ' : 'Change Image'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Dropzone with full drag and drop */}
                  <div
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-xl transition cursor-pointer text-center select-none ${
                      isDraggingOver
                        ? 'border-blue-500 bg-blue-500/15 text-blue-300 scale-[1.01]'
                        : 'border-zinc-600 hover:border-blue-400 text-zinc-400 hover:text-blue-300 bg-zinc-800/50 hover:bg-zinc-800'
                    }`}
                  >
                    <Upload className={`size-6 ${isDraggingOver ? 'text-blue-400 scale-110' : 'text-zinc-400'} transition-transform`} />
                    <div>
                      <p className="text-xs font-bold text-white">
                        {lang === 'th' ? 'คลิกเลือกไฟล์ หรือลากรูปภาพมาวางที่นี่' : 'Click to browse or drag & drop screenshot'}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        JPG, PNG, WEBP ({lang === 'th' ? 'ไม่บังคับ' : 'Optional'})
                      </p>
                    </div>
                  </div>

                  {/* Paste Zone */}
                  <div
                    tabIndex={0}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs cursor-text select-none outline-none focus:border-blue-500 focus:text-blue-400 transition bg-zinc-850/50"
                    title={lang === 'th' ? 'คลิกที่นี่แล้วกด Ctrl + V เพื่อวางภาพ' : 'Click here, then paste an image (Ctrl+V / ⌘V)'}
                  >
                    <span>📋 {lang === 'th' ? 'หรือคลิกที่นี่แล้วกด Ctrl + V เพื่อวางภาพทันที' : 'or click here & paste (Ctrl+V / ⌘V)'}</span>
                  </div>
                </div>
              )}

              {/* Hidden file input for reliable triggers */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* 3. LIVE POWER BANNER CARD */}
            <div className="rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-800 via-zinc-850 to-zinc-950 p-5 rounded-xl text-white shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-xs sm:text-sm text-zinc-200">
                    Live Power Level
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Updates instantly as you adjust fields.
                  </p>
                </div>
                <span className="rounded-xl bg-white/10 p-2.5 text-amber-400">
                  <Zap className="size-5" />
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <p className="font-bold tabular-nums text-3xl sm:text-4xl font-mono text-white">
                  ⚡ {calculatedNewPL.toLocaleString()}
                </p>
                {plDiff !== 0 && (
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                    plDiff > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {plDiff > 0 ? `+${plDiff.toLocaleString()}` : plDiff.toLocaleString()} PL
                  </span>
                )}
              </div>

              <p className="text-zinc-400 text-[11px] leading-relaxed border-t border-zinc-700/60 pt-2.5">
                Use this as a quick confidence check before saving your latest stat update.
              </p>
            </div>

            {/* 4. LATEST VERIFICATION STATUS CARD */}
            <div className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-5 space-y-3 shadow-lg">
              <div className="flex justify-between items-start gap-3 pb-2.5 border-b border-zinc-700">
                <div className="flex items-center gap-2.5">
                  <span className="size-8 rounded-lg bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-300">
                    <Shield className="size-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      Latest Verification
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Current review status and latest note.
                    </p>
                  </div>
                </div>

                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                  currentUser.verified
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : hasPending
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : isRejected
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {currentUser.verified
                    ? 'Verified'
                    : hasPending
                    ? 'Pending'
                    : isRejected
                    ? 'Rejected'
                    : 'Unverified'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="text-zinc-400">Power Level</span>
                  <span className="font-bold font-mono text-amber-400">
                    ⚡ {currentVerifiedPL.toLocaleString()} PL
                  </span>
                </div>

                {currentUser.statRejectionReason ? (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
                    <div className="font-semibold text-[10px] uppercase text-rose-400 mb-0.5">
                      Admin Note
                    </div>
                    <div>"{currentUser.statRejectionReason}"</div>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-500 pt-1">
                    No admin notes attached.
                  </div>
                )}
              </div>
            </div>

            {/* 5. POWER PROGRESSION CARD (Compact Sparkline & Delete Log Widget) */}
            <div className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-5 space-y-3 shadow-lg">
              <div className="flex items-start gap-3 pb-2.5 border-b border-zinc-700">
                <span className="size-8 rounded-lg bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Power Progression
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Compare recent updates and verify your growth over time.
                  </p>
                </div>
              </div>

              <GrowthTimelineChart
                user={currentUser}
                lang={lang}
                onSaveHistory={onSaveHistory}
                showToast={showToast}
              />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              RIGHT MAIN FORM (8 COLS): CHARACTER, COMBAT, OTHER, SPIRITS
             ══════════════════════════════════════════════════════════ */}
          <div className="order-2 lg:order-2 lg:col-span-8 space-y-5">
            
            {/* 1. CHARACTER STATS CARD (Exact media_1789154890036.png match) */}
            <div className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-6 space-y-4 shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-700">
                <div className="flex items-start gap-3">
                  <span className="size-10 rounded-xl bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                    <UserCheck className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Character Stats
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed max-w-xl">
                      Core profile inputs used to identify the character and calculate the main progression baseline.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-700/60 text-zinc-300 border border-zinc-600/60">
                  PROFILE
                </span>
              </div>

              {/* Grid: Multi-Class Box + 3 Stat inputs */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Left: Class (multi) scrollable list */}
                <div className="md:col-span-5 space-y-1.5">
                  <label className="block font-semibold text-zinc-200 text-xs">
                    Class <span className="font-normal text-zinc-400">(multi)</span>
                  </label>
                  <div className="space-y-1.5 bg-zinc-900/70 p-2 border border-zinc-700 rounded-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {OFFICIAL_CLASSES.map((cls) => {
                      const isChecked = selectedClasses.includes(cls.nameEn);
                      return (
                        <label
                          key={cls.id}
                          onClick={() => handleToggleClass(cls.nameEn)}
                          className={`cursor-pointer flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition border select-none ${
                            isChecked
                              ? 'bg-purple-900/30 border-purple-500 text-white'
                              : 'border-transparent hover:bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          <div className={`size-4 rounded flex items-center justify-center shrink-0 border ${
                            isChecked
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'border-zinc-600 bg-zinc-800'
                          }`}>
                            {isChecked && <Check className="size-3 stroke-[3]" />}
                          </div>
                          <img
                            src={cls.icon}
                            alt={cls.nameEn}
                            className="size-4 object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className="text-xs font-semibold truncate">
                            {cls.nameEn}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Level, Legend Classes, Legend Agathions */}
                <div className="md:col-span-7 grid grid-cols-3 gap-2.5 self-start pt-6">
                  {/* Level */}
                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-700 flex flex-col justify-between">
                    <label className="block mb-2 font-semibold text-zinc-300 text-xs">
                      Level
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={charLevel === 0 ? '' : charLevel}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setCharLevel(isNaN(v) ? 0 : Math.max(0, Math.min(99, v)));
                      }}
                      placeholder="79"
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-2 text-center font-bold text-white text-base focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  {/* Legend Classes */}
                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-700 flex flex-col justify-between">
                    <label className="block mb-2 font-semibold text-zinc-300 text-xs">
                      Legend Classes
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={charLegendClasses === 0 ? '' : charLegendClasses}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setCharLegendClasses(isNaN(v) ? 0 : Math.max(0, v));
                      }}
                      placeholder="3"
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-2 text-center font-bold text-white text-base focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  {/* Legend Agathions */}
                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-700 flex flex-col justify-between">
                    <label className="block mb-2 font-semibold text-zinc-300 text-xs">
                      Legend Agathions
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={charLegendAgathions === 0 ? '' : charLegendAgathions}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setCharLegendAgathions(isNaN(v) ? 0 : Math.max(0, v));
                      }}
                      placeholder="0"
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-2 text-center font-bold text-white text-base focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. COMBAT STATS CARD (All offensive & defensive stats visible at once, NO tabs!) */}
            <div className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-6 space-y-4 shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-700">
                <div className="flex items-start gap-3">
                  <span className="size-10 rounded-xl bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                    <Swords className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Combat Stats
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed max-w-xl">
                      Offensive and defensive values that feed the power formula. Keep these aligned with your latest verified in-game screenshot.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {screenshotUrl && (
                    <button
                      type="button"
                      onClick={() => setIsProofPinned((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                        isProofPinned
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-zinc-750 hover:bg-zinc-700 text-amber-300 border-zinc-600'
                      }`}
                      title={isProofPinned ? (lang === 'th' ? 'ซ่อนรูปเทียบ' : 'Hide Proof') : (lang === 'th' ? 'ตรึงรูปดูเทียบขณะกรอกสเตตัส' : 'Pin Proof beside form')}
                    >
                      <Eye className="size-3.5" />
                      <span>{isProofPinned ? (lang === 'th' ? 'ซ่อนรูปเทียบ' : 'Hide Proof') : (lang === 'th' ? '📌 ดูรูปเทียบสเตตัส' : 'Compare Proof')}</span>
                    </button>
                  )}
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-700/60 text-zinc-300 border border-zinc-600/60">
                    CORE FORMULA
                  </span>
                </div>
              </div>

              {/* All Combat & Defense Stats Grid (3 columns on desktop, 2 on mobile) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {combatAndDefenseStats.map((stat) => (
                  <div
                    key={stat.id}
                    className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-750 hover:border-zinc-600 space-y-1.5 transition"
                  >
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-zinc-200 text-xs truncate" title={stat.labelEn}>
                        {stat.labelEn}
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                        onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                        placeholder="0"
                        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm font-bold font-mono text-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      {stat.inputType === 'percentage' && (
                        <span className="absolute right-2.5 top-2 text-xs text-zinc-400 font-bold pointer-events-none">
                          %
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. OTHER STATS CARD (Extended stats: Stun, Aster, Triple) */}
            {otherStats.length > 0 && (
              <div className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-6 space-y-4 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-700">
                  <div className="flex items-start gap-3">
                    <span className="size-10 rounded-xl bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                      <Sparkles className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        Other Stats
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed max-w-xl">
                        Additional configurable stats included in the active power-level setup for this server.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-700/60 text-zinc-300 border border-zinc-600/60">
                    EXTENDED STATS
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {otherStats.map((stat) => (
                    <div
                      key={stat.id}
                      className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-750 hover:border-zinc-600 space-y-1.5 transition"
                    >
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-zinc-200 text-xs truncate" title={stat.labelEn}>
                          {stat.labelEn}
                        </label>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                          onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                          placeholder="0"
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm font-bold font-mono text-white focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        {stat.inputType === 'percentage' && (
                          <span className="absolute right-2.5 top-2 text-xs text-zinc-400 font-bold pointer-events-none">
                            %
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. SPIRITS CARD (Exact media_1789148700062.png match) */}
            {spiritStats.length > 0 && (
              <div className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-6 space-y-4 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-700">
                  <div className="flex items-start gap-3">
                    <span className="size-10 rounded-xl bg-zinc-750 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                      <Flame className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        Spirits
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed max-w-xl">
                        Track spirit levels and enhancement tiers with a more visual, at-a-glance layout.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-700/60 text-zinc-300 border border-zinc-600/60">
                    PROGRESSION
                  </span>
                </div>

                {/* 5 Spirit Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {spiritStats.map((stat) => {
                    const colorCfg = getSpiritColorConfig(stat.id);
                    const currentTier = spiritEnhancements[stat.id] ?? 0;

                    return (
                      <div
                        key={stat.id}
                        className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/70 border border-zinc-700/80 space-y-3"
                      >
                        {/* Spirit Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{colorCfg.icon}</span>
                            <span className="font-bold text-sm text-white">
                              {colorCfg.name}
                            </span>
                          </div>
                        </div>

                        {/* Level + Enhancement Controls */}
                        <div className="grid grid-cols-12 gap-3 items-end">
                          {/* Level input */}
                          <div className="col-span-4 space-y-1">
                            <label className="block text-[11px] font-semibold text-zinc-400">
                              Level
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={stats[stat.id] === 0 ? '' : stats[stat.id]}
                              onChange={(e) => handleStatNumberChange(stat.id, e.target.value)}
                              placeholder="10"
                              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-2 text-center font-bold text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>

                          {/* Enhancement Buttons [0] [+1] [+2] [+3] */}
                          <div className="col-span-8 space-y-1">
                            <label className="block text-[11px] font-semibold text-zinc-400">
                              Enhancement
                            </label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[0, 1, 2, 3].map((tier) => {
                                const isSelected = currentTier === tier;
                                return (
                                  <button
                                    key={tier}
                                    type="button"
                                    onClick={() => handleSpiritEnhancementSelect(stat.id, tier)}
                                    className={`py-2 rounded-lg text-xs font-bold transition select-none border ${
                                      isSelected
                                        ? colorCfg.activeClass
                                        : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
                                    }`}
                                  >
                                    {tier === 0 ? '0' : `+${tier}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. SUBMIT ACTIONS & ERROR BANNER */}
            <div className="rounded-2xl bg-zinc-800/90 border border-zinc-700 p-4 sm:p-5 space-y-3 shadow-lg">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-xs text-zinc-400">
                  {lang === 'th'
                    ? 'กรุณาตรวจสอบข้อมูลสเตตัสก่อนกดบันทึก (ภาพสกรีนช็อตไม่บังคับ แต่ช่วยให้ตรวจสอบเร็วขึ้น)'
                    : 'Verify stats before saving. Screenshots are optional but speed up verification.'}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/25 transition active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 ml-auto cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="size-4 animate-spin" />
                      <span>{lang === 'th' ? 'กำลังส่งข้อมูล...' : 'Saving Changes...'}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="size-4 fill-slate-950" />
                      <span>{lang === 'th' ? 'บันทึกข้อมูลสเตตัส (Save Changes)' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      </form>

      {/* Floating Pinned Proof Inspector for Side-by-Side Comparison while Filling Stats */}
      {isProofPinned && screenshotUrl && (
        <div
          className={`fixed z-40 bg-zinc-900/95 border-2 border-amber-400/80 rounded-2xl shadow-2xl p-3.5 space-y-2.5 backdrop-blur-md transition-all ${
            pinnedProofSize === 'split'
              ? 'bottom-4 right-4 w-[95vw] sm:w-[48vw] h-[85vh] max-h-[85vh] flex flex-col'
              : pinnedProofSize === 'large'
              ? 'bottom-5 right-5 w-[92vw] sm:w-[720px] max-w-[92vw]'
              : 'bottom-5 right-5 w-80 sm:w-[480px] max-w-[92vw]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>{lang === 'th' ? '📌 รูปหลักฐานเทียบกรอกสเตตัส' : '📌 Proof Reference'}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* Size toggles */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-800 text-[10px] mr-1">
                <button
                  type="button"
                  onClick={() => setPinnedProofSize('normal')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${pinnedProofSize === 'normal' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
                  title={lang === 'th' ? 'ขนาดปกติ' : 'Normal'}
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => setPinnedProofSize('large')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${pinnedProofSize === 'large' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
                  title={lang === 'th' ? 'ขนาดใหญ่' : 'Large'}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => setPinnedProofSize('split')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${pinnedProofSize === 'split' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
                  title={lang === 'th' ? 'แบ่งครึ่งจอ' : 'Split View'}
                >
                  L
                </button>
              </div>

              {/* In-dock zoom */}
              <button
                type="button"
                onClick={() => setPinnedProofZoom(prev => Math.max(0.6, Math.round((prev - 0.2) * 10) / 10))}
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                title={lang === 'th' ? 'ซูมออก' : 'Zoom Out'}
              >
                -
              </button>
              <span className="text-[10px] font-mono text-amber-300 font-bold px-1">
                {Math.round(pinnedProofZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setPinnedProofZoom(prev => Math.min(3, Math.round((prev + 0.2) * 10) / 10))}
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                title={lang === 'th' ? 'ซูมเข้า' : 'Zoom In'}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setPinnedProofZoom(1)}
                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] cursor-pointer"
                title={lang === 'th' ? 'รีเซ็ต' : 'Reset'}
              >
                100%
              </button>

              <button
                type="button"
                onClick={() => onViewImageZoom?.(screenshotUrl, 'Stat Proof')}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                title={lang === 'th' ? 'ขยายเต็มจอ' : 'Zoom In'}
              >
                <ExternalLink className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsProofPinned(false)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500 text-zinc-300 hover:text-white transition cursor-pointer"
                title={lang === 'th' ? 'ปิดหน้าต่างลอย' : 'Close'}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div
            className={`relative rounded-xl overflow-auto bg-black/95 flex items-center justify-center p-2 border border-zinc-800 ${
              pinnedProofSize === 'split'
                ? 'flex-1 min-h-0'
                : pinnedProofSize === 'large'
                ? 'max-h-[500px]'
                : 'max-h-[340px]'
            }`}
          >
            <div
              style={{
                transform: `scale(${pinnedProofZoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
              className="w-full flex items-center justify-center"
            >
              <img
                src={screenshotUrl}
                alt="Proof Reference"
                className={`w-full h-auto object-contain rounded-lg ${
                  pinnedProofSize === 'split'
                    ? 'max-h-[72vh]'
                    : pinnedProofSize === 'large'
                    ? 'max-h-[480px]'
                    : 'max-h-[320px]'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 shrink-0">
            <span>{lang === 'th' ? '✓ รูปเต็มไม่ถูกตัดขอบ (กด +/- เพื่อซูมตัวเลขชัดๆ)' : '✓ Uncropped full image'}</span>
            <span className="text-amber-400 font-semibold">{lang === 'th' ? 'ตรึงหน้าจอขณะกรอกสเตตัส' : 'Pinned Reference'}</span>
          </div>
        </div>
      )}

      {/* Screenshot Guide Modal */}
      <ScreenshotGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
      />
    </div>
  );
};
