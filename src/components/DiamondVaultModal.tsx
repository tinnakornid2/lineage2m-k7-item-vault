import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Gem,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  AlertCircle,
  Camera,
  Check,
  Copy,
  Download,
  Search,
  Upload,
  Trash2,
  Edit2,
  Save,
  Shield,
  Coins,
  Clock,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { Language, User, DiamondVaultRecord, ClanFundTxType, ClanGroup } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface DiamondVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: User | null;
  vaultBalance: number;
  transactions: DiamondVaultRecord[];
  onPerformTransaction: (
    type: ClanFundTxType,
    amount: number,
    note: string,
    details?: {
      grossAmount?: number;
      taxPct?: number;
      taxAmount?: number;
      netAmount?: number;
      clanScope?: string;
      recipientUserId?: string;
      recipientName?: string;
      recipientClan?: string;
      proofImageUrl?: string;
    }
  ) => Promise<void>;
  clans?: ClanGroup[];
  allMembers?: User[];
  onUpdateNote?: (recordId: string, note: string) => Promise<void>;
}

export const DiamondVaultModal: React.FC<DiamondVaultModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  vaultBalance: _rawVaultBalance,
  transactions,
  onPerformTransaction,
  clans = [],
  allMembers = [],
  onUpdateNote
}) => {
  const t = translations[lang];

  // ── State ────────────────────────────────────────────────────────────────
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'view' | 'credit' | 'deduct' | 'adjust' | 'fulfill'>('view');

  // Transaction Inputs
  const [grossAmount, setGrossAmount] = useState<number | ''>('');
  const [taxPct, setTaxPct] = useState<number>(8.0);
  const [deductAmount, setDeductAmount] = useState<number | ''>('');
  const [newTargetBalance, setNewTargetBalance] = useState<number | ''>('');
  const [fulfillAmount, setFulfillAmount] = useState<number | ''>('');
  const [recipientUserId, setRecipientUserId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [proofImage, setProofImage] = useState<string>('');

  // UI / Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // History Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ClanFundTxType>('all');

  // Inline Note Edit
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Snapshot Generator Modal
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotIncludeTx, setSnapshotIncludeTx] = useState(true);
  const [selectedTxForSnapshot, setSelectedTxForSnapshot] = useState<Set<string>>(new Set());
  const [snapshotCopying, setSnapshotCopying] = useState(false);
  const [snapshotToast, setSnapshotToast] = useState('');

  // File input ref for dropzone
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

  // ── Scopes & Clans ───────────────────────────────────────────────────────
  const availableClans = useMemo(() => {
    return clans || [];
  }, [clans]);

  // ── Calculate Balances Per Scope ─────────────────────────────────────────
  const balanceMap = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    availableClans.forEach((c) => {
      map[c.name] = 0;
    });

    // Sort chronologically ascending
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    sorted.forEach((tx) => {
      const netChange =
        tx.type === 'credit' || tx.type === 'deposit'
          ? (tx.netAmount ?? tx.amount)
          : tx.type === 'deduction' || tx.type === 'expenditure' || tx.type === 'withdraw'
          ? -Math.abs(tx.amount)
          : tx.type === 'adjust'
          ? tx.amount // delta
          : 0;

      // Update Global Total
      map['all'] = (map['all'] || 0) + netChange;

      // Update Specific Clan Scope if set
      if (tx.clanScope && tx.clanScope !== 'all') {
        map[tx.clanScope] = (map[tx.clanScope] || 0) + netChange;
      }
    });

    return map;
  }, [transactions, availableClans]);

  const currentDisplayBalance = balanceMap[selectedScope] ?? 0;

  // Recent Credits & Debits (last 24 hours or in current scope)
  const recentStats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const scopeTx = transactions.filter((tx) => {
      if (selectedScope === 'all') return true;
      return tx.clanScope === selectedScope;
    });

    const recentInWindow = scopeTx.filter((t) => t.timestamp >= dayAgo);
    const pool = recentInWindow.length > 0 ? recentInWindow : scopeTx.slice(0, 10);

    const credits = pool.filter((t) => t.type === 'credit' || t.type === 'deposit' || (t.type === 'adjust' && t.amount > 0)).length;
    const debits = pool.filter((t) => t.type === 'deduction' || t.type === 'expenditure' || t.type === 'withdraw' || (t.type === 'adjust' && t.amount < 0)).length;

    return { credits, debits };
  }, [transactions, selectedScope]);

  // Initial snapshot selection when transactions change
  useEffect(() => {
    const initialIds = new Set(transactions.slice(0, 5).map((t) => t.id));
    setSelectedTxForSnapshot(initialIds);
  }, [transactions]);

  // ── Calculations for Forms ───────────────────────────────────────────────
  // Credit calculation
  const grossNum = typeof grossAmount === 'number' ? grossAmount : 0;
  const taxAmount = Math.round((grossNum * (taxPct || 0)) / 100);
  const netCredited = Math.max(0, grossNum - taxAmount);

  // Adjust calculation
  const targetNum = typeof newTargetBalance === 'number' ? newTargetBalance : currentDisplayBalance;
  const deltaAmount = targetNum - currentDisplayBalance;

  // ── Clipboard Paste Image Handler (Ctrl+V) ───────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              const base64 = loadEvent.target?.result as string;
              if (base64) {
                setProofImage(base64);
                sounds.playClick();
                setSuccessToast(lang === 'th' ? 'วางรูปภาพจาก Clipboard แล้ว' : 'Image pasted from clipboard');
                setTimeout(() => setSuccessToast(''), 3000);
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, lang]);

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(lang === 'th' ? 'กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น' : 'Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        setProofImage(base64);
        sounds.playClick();
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Form Submissions ─────────────────────────────────────────────────────
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);

      if (activeTab === 'credit') {
        if (!grossNum || grossNum <= 0) {
          setError(lang === 'th' ? 'กรุณาระบุจำนวนเพชรที่มากกว่า 0' : 'Gross amount must be greater than 0');
          return;
        }

        await onPerformTransaction('credit', netCredited, note || (lang === 'th' ? 'เพิ่มเพชรเข้ากองทุน' : 'Fund credit'), {
          grossAmount: grossNum,
          taxPct,
          taxAmount,
          netAmount: netCredited,
          clanScope: selectedScope,
          proofImageUrl: proofImage || undefined
        });

        sounds.playClaim();
        setSuccessToast(lang === 'th' ? `เพิ่ม ${netCredited.toLocaleString()} 💎 เข้ากองทุนเรียบร้อย` : `Credited ${netCredited.toLocaleString()} diamonds`);
      } else if (activeTab === 'deduct') {
        const amt = typeof deductAmount === 'number' ? deductAmount : 0;
        if (amt <= 0) {
          setError(lang === 'th' ? 'กรุณาระบุจำนวนเพชรที่มากกว่า 0' : 'Amount must be greater than 0');
          return;
        }

        await onPerformTransaction('deduction', amt, note || (lang === 'th' ? 'หักเพชรออกจากกองทุน' : 'Fund deduction'), {
          clanScope: selectedScope,
          proofImageUrl: proofImage || undefined
        });

        sounds.playClick();
        setSuccessToast(lang === 'th' ? `หัก ${amt.toLocaleString()} 💎 เรียบร้อยแล้ว` : `Deducted ${amt.toLocaleString()} diamonds`);
      } else if (activeTab === 'adjust') {
        if (typeof newTargetBalance !== 'number') {
          setError(lang === 'th' ? 'กรุณาระบุยอดเป้าหมาย' : 'Please enter target balance');
          return;
        }

        await onPerformTransaction('adjust', deltaAmount, note || (lang === 'th' ? `ปรับยอดสมดุลเป็น ${newTargetBalance.toLocaleString()}` : `Balance adjustment to ${newTargetBalance.toLocaleString()}`), {
          clanScope: selectedScope,
          balanceAfter: newTargetBalance
        });

        sounds.playClick();
        setSuccessToast(lang === 'th' ? `ปรับยอดคงเหลือเป็น ${newTargetBalance.toLocaleString()} 💎 เรียบร้อย` : `Adjusted balance to ${newTargetBalance.toLocaleString()}`);
      } else if (activeTab === 'fulfill') {
        const amt = typeof fulfillAmount === 'number' ? fulfillAmount : 0;
        if (amt <= 0) {
          setError(lang === 'th' ? 'กรุณาระบุจำนวนเพชร' : 'Amount must be greater than 0');
          return;
        }
        if (!recipientUserId) {
          setError(lang === 'th' ? 'กรุณาเลือกสมาชิกผู้รับเพชร' : 'Please select recipient member');
          return;
        }

        const member = allMembers.find((m) => m.id === recipientUserId);

        await onPerformTransaction('expenditure', amt, note || (lang === 'th' ? `จ่ายเพชรให้ ${member?.inGameName || 'สมาชิก'}` : `Member payout to ${member?.inGameName || 'member'}`), {
          clanScope: selectedScope,
          recipientUserId,
          recipientName: member?.inGameName,
          recipientClan: member?.clan,
          proofImageUrl: proofImage || undefined
        });

        sounds.playClaim();
        setSuccessToast(lang === 'th' ? `จ่าย ${amt.toLocaleString()} 💎 ให้ ${member?.inGameName} เรียบร้อย` : `Paid ${amt.toLocaleString()} diamonds to ${member?.inGameName}`);
      }

      // Reset form fields
      setGrossAmount('');
      setDeductAmount('');
      setNewTargetBalance('');
      setFulfillAmount('');
      setRecipientUserId('');
      setNote('');
      setProofImage('');
      setActiveTab('view');

      setTimeout(() => setSuccessToast(''), 3500);
    } catch (err) {
      console.error(err);
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  // ── Inline Note Editing Handler ──────────────────────────────────────────
  const handleSaveInlineNote = async (recordId: string) => {
    if (!onUpdateNote) return;
    try {
      await onUpdateNote(recordId, editingNoteText);
      setEditingNoteId(null);
      setEditingNoteText('');
      sounds.playClick();
      setSuccessToast(lang === 'th' ? 'อัปเดตหมายเหตุเรียบร้อย' : 'Note updated');
      setTimeout(() => setSuccessToast(''), 2500);
    } catch {
      setError(lang === 'th' ? 'บันทึกหมายเหตุไม่สำเร็จ' : 'Failed to save note');
    }
  };

  // ── Filtered Transactions for Timeline ───────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Scope match
      if (selectedScope !== 'all' && tx.clanScope && tx.clanScope !== selectedScope) {
        return false;
      }

      // Type match
      if (typeFilter !== 'all') {
        if (typeFilter === 'credit' && !(tx.type === 'credit' || tx.type === 'deposit')) return false;
        if (typeFilter === 'deduction' && !(tx.type === 'deduction' || tx.type === 'withdraw')) return false;
        if (typeFilter !== 'credit' && typeFilter !== 'deduction' && tx.type !== typeFilter) return false;
      }

      // Query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noteMatch = tx.note?.toLowerCase().includes(q);
        const actorMatch = tx.performedBy?.name?.toLowerCase().includes(q);
        const recipientMatch = tx.recipientName?.toLowerCase().includes(q);
        const scopeMatch = tx.clanScope?.toLowerCase().includes(q);
        if (!noteMatch && !actorMatch && !recipientMatch && !scopeMatch) return false;
      }

      return true;
    });
  }, [transactions, selectedScope, typeFilter, searchQuery]);

  // ── Balance Snapshot Canvas Drawing (Kain7 High-Res PNG Generator) ───────
  const generateSnapshotCanvas = (): HTMLCanvasElement => {
    const scale = 2;
    const width = 360;
    const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cinzel", sans-serif';

    const headerHeight = 44;
    const balanceSectionHeight = 84;
    const footerHeight = 36;
    const padding = 16;
    const rowHeight = 32;

    const txToRender = snapshotIncludeTx
      ? transactions.filter((t) => selectedTxForSnapshot.has(t.id)).slice(0, 8)
      : [];

    const txSectionHeight = txToRender.length > 0 ? padding + txToRender.length * rowHeight + padding : 0;
    const totalHeight = headerHeight + balanceSectionHeight + txSectionHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.scale(scale, scale);

    // Rounded card helper
    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // 1. Background Card
    drawRoundedRect(0, 0, width, totalHeight, 12);
    ctx.fillStyle = '#0b0f19';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Header Bar
    ctx.save();
    drawRoundedRect(0, 0, width, headerHeight, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.restore();

    // Line under header
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(width, headerHeight);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Header Title
    ctx.font = '700 13px ' + fontFamily;
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔️ LINEAGE 2M • CLAN FUND BALANCE', width / 2, headerHeight / 2);

    // 3. Balance Section
    const scopeLabel =
      selectedScope === 'all'
        ? '🌟 ALLIANCE GLOBAL FUND'
        : `🛡️ CLAN: ${selectedScope.toUpperCase()}`;

    ctx.font = '600 10px ' + fontFamily;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(scopeLabel, width / 2, headerHeight + 20);

    // Big Diamond + Balance
    const balanceStr = currentDisplayBalance.toLocaleString() + ' 💎';
    ctx.font = '800 24px ' + fontFamily;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(balanceStr, width / 2, headerHeight + 46);

    // Recent Activity Indicators
    const creditsTxt = `↑ ${recentStats.credits} credits`;
    const debitsTxt = `↓ ${recentStats.debits} debits`;
    ctx.font = '600 10px ' + fontFamily;
    ctx.fillStyle = '#10b981';
    ctx.fillText(creditsTxt, width / 2 - 45, headerHeight + 68);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(debitsTxt, width / 2 + 45, headerHeight + 68);

    // 4. Transactions List (if any)
    if (txToRender.length > 0) {
      const txStartY = headerHeight + balanceSectionHeight;

      // Divider line
      ctx.beginPath();
      ctx.moveTo(16, txStartY);
      ctx.lineTo(width - 16, txStartY);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();

      txToRender.forEach((tx, idx) => {
        const rowY = txStartY + padding + idx * rowHeight;

        let symbol = '↑';
        let color = '#10b981';
        let prefix = '+';
        if (tx.type === 'deduction' || tx.type === 'withdraw') {
          symbol = '↓';
          color = '#ef4444';
          prefix = '-';
        } else if (tx.type === 'adjust') {
          symbol = '⚖️';
          color = '#f59e0b';
          prefix = tx.amount >= 0 ? '+' : '';
        } else if (tx.type === 'expenditure') {
          symbol = '🎁';
          color = '#8b5cf6';
          prefix = '-';
        }

        ctx.beginPath();
        ctx.arc(28, rowY + 10, 8, 0, Math.PI * 2);
        ctx.fillStyle = color + '22';
        ctx.fill();

        ctx.font = '700 9px ' + fontFamily;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, 28, rowY + 10);

        const title = tx.note || (tx.type === 'credit' ? 'Credit' : 'Deduction');
        ctx.font = '500 10px ' + fontFamily;
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'left';
        const displayTitle = title.length > 22 ? title.slice(0, 22) + '…' : title;
        ctx.fillText(displayTitle, 44, rowY + 10);

        const amtStr = `${prefix}${Math.abs(tx.amount).toLocaleString()}`;
        ctx.font = '700 11px ' + fontFamily;
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(amtStr, width - 20, rowY + 10);
      });
    }

    // 5. Footer Bar
    const footerY = totalHeight - footerHeight;
    ctx.beginPath();
    ctx.moveTo(0, footerY);
    ctx.lineTo(width, footerY);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.stroke();

    const dateStr = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    ctx.font = '500 10px ' + fontFamily;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`As of ${dateStr}`, width / 2, footerY + footerHeight / 2);

    return canvas;
  };

  // Copy Canvas as Image PNG to Clipboard
  const handleCopySnapshotImage = async () => {
    setSnapshotCopying(true);
    try {
      const canvas = generateSnapshotCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          sounds.playClaim();
          setSnapshotToast(lang === 'th' ? 'คัดลอกรูปภาพเข้า Clipboard แล้ว! (วางลง LINE/Discord ได้เลย)' : 'PNG Image copied to clipboard!');
        } catch {
          const link = document.createElement('a');
          link.download = `clan-fund-snapshot-${Date.now()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          setSnapshotToast(lang === 'th' ? 'ดาวน์โหลดรูปภาพ Snapshot แล้ว' : 'Downloaded snapshot image');
        } finally {
          setSnapshotCopying(false);
          setTimeout(() => setSnapshotToast(''), 3500);
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      setSnapshotCopying(false);
    }
  };

  // Download Snapshot PNG directly
  const handleDownloadSnapshotImage = () => {
    const canvas = generateSnapshotCanvas();
    const link = document.createElement('a');
    link.download = `clan-fund-snapshot-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    sounds.playClick();
    setSnapshotToast(lang === 'th' ? 'บันทึกรูปภาพเรียบร้อยแล้ว' : 'Snapshot image saved');
    setTimeout(() => setSnapshotToast(''), 3000);
  };

  // Copy Formatted Text for Discord / LINE
  const handleCopySnapshotText = async () => {
    const scopeName = selectedScope === 'all' ? 'All Clans (Alliance Fund)' : selectedScope;
    let text = `💎 **LINEAGE 2M • CLAN FUND BALANCE**\n`;
    text += `🛡️ **Scope:** ${scopeName}\n`;
    text += `💰 **Balance:** ${currentDisplayBalance.toLocaleString()} Diamonds\n`;
    text += `📊 **Recent:** ↑ ${recentStats.credits} credits | ↓ ${recentStats.debits} debits\n`;
    text += `🕒 **Updated:** ${new Date().toLocaleString()}\n`;

    if (snapshotIncludeTx) {
      const selected = transactions.filter((t) => selectedTxForSnapshot.has(t.id)).slice(0, 6);
      if (selected.length > 0) {
        text += `\n**Recent Transactions:**\n`;
        selected.forEach((t) => {
          const sym = t.type === 'credit' ? '🟢 +' : t.type === 'deduction' ? '🔴 -' : t.type === 'adjust' ? '🟡 ~' : '🟣 🎁';
          text += `${sym} ${t.amount.toLocaleString()} 💎 - ${t.note || t.type} (${new Date(t.timestamp).toLocaleDateString()})\n`;
        });
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      sounds.playClaim();
      setSnapshotToast(lang === 'th' ? 'คัดลอกข้อความสรุปยอดเรียบร้อยแล้ว!' : 'Formatted text copied!');
      setTimeout(() => setSnapshotToast(''), 3000);
    } catch {
      setError(lang === 'th' ? 'คัดลอกไม่สำเร็จ' : 'Failed to copy text');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#111827] via-[#0b0f19] to-[#070a12] border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)] text-slate-200 overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              <Gem className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
                  {t.clanFund}
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 border border-white/20 text-slate-200">
                  Kain7 Vault Standard
                </span>
              </div>
              <p className="text-xs text-slate-400">{t.clanFundDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Snapshot Modal Button */}
            <button
              id="btn-open-clan-fund-snapshot"
              onClick={() => {
                sounds.playClick();
                setShowSnapshotModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-600/30 to-blue-600/30 hover:from-sky-600/50 hover:to-blue-600/50 border border-sky-500/40 hover:border-sky-400 text-sky-300 hover:text-white text-xs font-bold transition-all shadow-sm"
              title="Copy Balance Snapshot Card"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              <span>{t.copySnapshot}</span>
            </button>

            {/* Close Button */}
            <button
              id="btn-close-vault-modal"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Toast Alert */}
        {successToast && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast('')} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body: Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* 1. CLAN FUND SCOPE SELECTOR TABS */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                {t.fundScope}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Active: {selectedScope === 'all' ? 'All Clans' : selectedScope}
              </span>
            </div>

            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900/80 border border-slate-800 overflow-x-auto">
              {/* All Clans / Global Tab */}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedScope('all');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedScope === 'all'
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{t.allClansScope}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedScope === 'all' ? 'bg-sky-950 text-sky-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {(balanceMap['all'] ?? 0).toLocaleString()} 💎
                </span>
              </button>

              {/* Clan specific tabs */}
              {availableClans.map((clan) => {
                const isActive = selectedScope === clan.name;
                const clanBal = balanceMap[clan.name] ?? 0;
                return (
                  <button
                    key={clan.id}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setSelectedScope(clan.name);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: clan.color || '#38bdf8' }}
                    />
                    <span>{clan.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {clanBal.toLocaleString()} 💎
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. MAIN BALANCE & RECENT STATS CARD */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0f172a] via-[#0b1120] to-[#0d1526] border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  {t.currentBalance}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedScope === 'all' ? '🌐 Global Alliance' : `🛡️ ${selectedScope}`}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                  {currentDisplayBalance.toLocaleString()}
                </span>
                <span className="text-base font-bold text-white">💎</span>
              </div>
              <div className="flex items-center gap-3 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-mono font-semibold text-[11px]">
                  ↑ {recentStats.credits} {lang === 'th' ? 'รายการรับ' : 'credits'}
                </span>
                <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 font-mono font-semibold text-[11px]">
                  ↓ {recentStats.debits} {lang === 'th' ? 'รายการจ่าย/หัก' : 'debits'}
                </span>
              </div>
            </div>

            {/* Admin Action Buttons Switcher */}
            {isAdminOrOwner && (
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 self-stretch sm:self-auto justify-end">
                {/* Tab: View */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setActiveTab('view');
                    setError('');
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'view'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <History className="w-4 h-4" />
                </button>

                {/* Tab: Credit (+ Add) */}
                <button
                  id="btn-clan-fund-credit"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setActiveTab(activeTab === 'credit' ? 'view' : 'credit');
                    setError('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'credit'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                      : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>{t.tabCredit}</span>
                </button>

                {/* Tab: Deduct (-) */}
                <button
                  id="btn-clan-fund-deduct"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setActiveTab(activeTab === 'deduct' ? 'view' : 'deduct');
                    setError('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'deduct'
                      ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/30'
                      : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50'
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>{t.tabDeduct}</span>
                </button>

                {/* Tab: Adjust (⚖️) */}
                <button
                  id="btn-clan-fund-adjust"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setActiveTab(activeTab === 'adjust' ? 'view' : 'adjust');
                    setError('');
                    setNewTargetBalance(currentDisplayBalance);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'adjust'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                      : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-700/50'
                  }`}
                >
                  <span>{t.tabAdjust}</span>
                </button>

                {/* Tab: Fulfill (🎁) */}
                <button
                  id="btn-clan-fund-fulfill"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setActiveTab(activeTab === 'fulfill' ? 'view' : 'fulfill');
                    setError('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'fulfill'
                      ? 'bg-violet-500 text-slate-950 shadow-md shadow-violet-500/30'
                      : 'bg-violet-950/40 hover:bg-violet-900/60 text-violet-300 border border-violet-700/50'
                  }`}
                >
                  <span>{t.tabFulfill}</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. TRANSACTION FORMS SECTION */}
          {activeTab !== 'view' && isAdminOrOwner && (
            <form
              onSubmit={handleSubmitTransaction}
              className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl space-y-4 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  {activeTab === 'credit' && <ArrowDownCircle className="w-5 h-5 text-emerald-400" />}
                  {activeTab === 'deduct' && <ArrowUpCircle className="w-5 h-5 text-rose-400" />}
                  {activeTab === 'adjust' && <span className="text-lg">⚖️</span>}
                  {activeTab === 'fulfill' && <span className="text-lg">🎁</span>}
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {activeTab === 'credit' && (lang === 'th' ? 'เพิ่มเพชรเข้ากองทุน (Credit / Add Funds)' : 'Add Funds (Credit)')}
                      {activeTab === 'deduct' && (lang === 'th' ? 'หักเพชรออกจากกองทุน (Deduction)' : 'Record Deduction')}
                      {activeTab === 'adjust' && (lang === 'th' ? 'ปรับยอดสมดุลกองทุน (Balance Adjustment)' : 'Adjust Balance')}
                      {activeTab === 'fulfill' && (lang === 'th' ? 'จ่ายเพชรให้สมาชิก / คำขอ (Fulfill Payout)' : 'Fulfill Member Payout')}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Scope: <strong className="text-sky-300">{selectedScope === 'all' ? 'All Clans (Alliance)' : selectedScope}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  {t.cancel}
                </button>
              </div>

              {/* TAB 1: CREDIT (Add Funds with Live Tax Breakdown) */}
              {activeTab === 'credit' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Gross Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {t.grossAmount} <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="input-clan-fund-gross"
                          type="number"
                          min="1"
                          required
                          value={grossAmount}
                          onChange={(e) => setGrossAmount(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 10000"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white font-mono text-sm focus:outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">💎</span>
                      </div>
                    </div>

                    {/* Tax % Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">
                          {t.marketTax}
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Kain7 Default: 8.00%
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          id="input-clan-fund-tax-pct"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={taxPct}
                          onChange={(e) => setTaxPct(Number(e.target.value))}
                          placeholder="8.0"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 text-white font-mono text-sm focus:outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Tax & Net Amount Calculation Card (Just like Kain7) */}
                  {grossNum > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 grid grid-cols-3 gap-2 text-center animate-in fade-in">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">{t.grossAmount}</span>
                        <span className="text-sm font-bold font-mono text-slate-200">{grossNum.toLocaleString()} 💎</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 block uppercase font-medium">-{taxPct}% {t.taxDeducted}</span>
                        <span className="text-sm font-bold font-mono text-rose-400">-{taxAmount.toLocaleString()} 💎</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 block uppercase font-bold">{t.netCredited}</span>
                        <span className="text-base font-extrabold font-mono text-emerald-300">+{netCredited.toLocaleString()} 💎</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DEDUCTION */}
              {activeTab === 'deduct' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t.amount} <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="input-clan-fund-deduct-amount"
                        type="number"
                        min="1"
                        required
                        value={deductAmount}
                        onChange={(e) => setDeductAmount(e.target.value ? Number(e.target.value) : '')}
                        placeholder="e.g. 5000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white font-mono text-sm focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400">💎</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ADJUSTMENT (Direct New Balance + Delta preview) */}
              {activeTab === 'adjust' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t.targetBalance} <span className="text-amber-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="input-clan-fund-new-balance"
                        type="number"
                        step="1"
                        required
                        value={newTargetBalance}
                        onChange={(e) => setNewTargetBalance(e.target.value ? Number(e.target.value) : '')}
                        placeholder="Target Balance e.g. 160000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-500 text-white font-mono text-sm focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400">💎</span>
                    </div>
                  </div>

                  {/* Delta Preview Box (Kain7 replica) */}
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block">{t.currentBalance}</span>
                      <span className="font-mono font-bold text-white text-sm">{currentDisplayBalance.toLocaleString()} 💎</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-slate-400 block">{t.targetBalance}</span>
                      <span className="font-mono font-bold text-white text-sm">{targetNum.toLocaleString()} 💎</span>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-400 block font-semibold">{t.balanceDelta}</span>
                      <span className={`font-mono font-extrabold text-sm ${deltaAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {deltaAmount >= 0 ? `+${deltaAmount.toLocaleString()}` : deltaAmount.toLocaleString()} 💎
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: FULFILL / MEMBER EXPENDITURE */}
              {activeTab === 'fulfill' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Recipient Member Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {t.recipientMember} <span className="text-violet-400">*</span>
                      </label>
                      <select
                        id="select-clan-fund-recipient"
                        required
                        value={recipientUserId}
                        onChange={(e) => setRecipientUserId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-violet-500 text-white text-sm focus:outline-none"
                      >
                        <option value="">-- {lang === 'th' ? 'เลือกสมาชิก' : 'Select Member'} --</option>
                        {allMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.inGameName} [{m.clan || 'Clan'}] - ⚡ PL: {(m.powerLevel || 0).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {t.amount} <span className="text-violet-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="input-clan-fund-fulfill-amount"
                          type="number"
                          min="1"
                          required
                          value={fulfillAmount}
                          onChange={(e) => setFulfillAmount(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 15000"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-violet-500 text-white font-mono text-sm focus:outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400">💎</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason / Note input (shared across forms) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.note}
                </label>
                <input
                  id="input-clan-fund-note"
                  type="text"
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    activeTab === 'credit'
                      ? (lang === 'th' ? 'เช่น ขายสมุดสกิลบอสได้ / สมาชิกฝากเข้ากองทุน' : 'e.g. Boss loot sale / member contribution')
                      : activeTab === 'deduct'
                      ? (lang === 'th' ? 'เช่น ค่ากล่องวอร์ / ค่าใช้จ่ายพันธมิตร' : 'e.g. War supplies / alliance expense')
                      : activeTab === 'adjust'
                      ? (lang === 'th' ? 'เช่น ปรับยอดให้ตรงกับรายงานในเกม' : 'e.g. Calibration to match in-game vault')
                      : (lang === 'th' ? 'เช่น จ่ายค่าสมุดตำนาน / ส่วนแบ่งบอส' : 'e.g. Skill book payout / boss split')
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-500 text-white text-sm focus:outline-none"
                />
              </div>

              {/* Proof / Slip Image Attachment Dropzone + Ctrl+V */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>{t.attachmentSlip}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Paste Ctrl+V Supported
                  </span>
                </label>

                {proofImage ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-700">
                    <img
                      src={proofImage}
                      alt="Attachment Preview"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-700 cursor-pointer hover:opacity-80 transition"
                      onClick={() => setLightboxImage(proofImage)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-300 font-semibold block truncate">
                        {lang === 'th' ? 'ภาพหลักฐานที่แนบ' : 'Attached Proof Image'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLightboxImage(proofImage)}
                        className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        <Maximize2 className="w-3 h-3" />
                        {lang === 'th' ? 'ดูภาพขนาดเต็ม' : 'View Full Image'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProofImage('')}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950 transition"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-950/50 hover:bg-slate-900/50 transition cursor-pointer text-center group"
                  >
                    <Upload className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition mb-1" />
                    <p className="text-xs text-slate-400 group-hover:text-slate-200">
                      {t.dropImageHere}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  {t.cancel}
                </button>
                <button
                  id="btn-confirm-clan-fund-submit"
                  type="submit"
                  disabled={loading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 shadow-lg ${
                    activeTab === 'credit'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : activeTab === 'deduct'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                      : activeTab === 'adjust'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30'
                  }`}
                >
                  {loading ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {loading
                      ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                      : activeTab === 'credit'
                      ? (lang === 'th' ? `เพิ่มเพชรเข้ากองทุน (+${netCredited.toLocaleString()} 💎)` : `Add Funds (+${netCredited.toLocaleString()})`)
                      : activeTab === 'deduct'
                      ? (lang === 'th' ? `บันทึกการหักเพชร` : 'Record Deduction')
                      : activeTab === 'adjust'
                      ? (lang === 'th' ? `ปรับยอดสมดุล` : 'Confirm Adjustment')
                      : (lang === 'th' ? `ยืนยันการจ่ายเพชร` : 'Confirm Payout')}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* 4. TRANSACTION HISTORY LEDGER */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <History className="w-4 h-4 text-sky-400" />
                <span>{t.vaultHistory}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                  {filteredTransactions.length}
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'th' ? 'ค้นหาบันทึก...' : 'Search logs...'}
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-36 sm:w-44"
                  />
                </div>

                {/* Type Filter */}
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                  >
                    <option value="all">{lang === 'th' ? 'ทุกประเภท' : 'All Types'}</option>
                    <option value="credit">{lang === 'th' ? 'เพิ่ม (+)' : 'Credit'}</option>
                    <option value="deduction">{lang === 'th' ? 'หัก (-)' : 'Deduction'}</option>
                    <option value="adjust">{lang === 'th' ? 'ปรับยอด (⚖️)' : 'Adjustment'}</option>
                    <option value="expenditure">{lang === 'th' ? 'จ่ายสมาชิก (🎁)' : 'Expenditure'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
                  {t.noTransactions}
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.type === 'credit' || tx.type === 'deposit';
                  const isDeduct = tx.type === 'deduction' || tx.type === 'withdraw';
                  const isAdjust = tx.type === 'adjust';
                  const isFulfill = tx.type === 'expenditure';

                  let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
                  let symbol = '↑';
                  let prefix = '+';
                  if (isDeduct) {
                    badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
                    symbol = '↓';
                    prefix = '-';
                  } else if (isAdjust) {
                    badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                    symbol = '⚖️';
                    prefix = tx.amount >= 0 ? '+' : '';
                  } else if (isFulfill) {
                    badgeColor = 'text-violet-400 bg-violet-500/10 border-violet-500/30';
                    symbol = '🎁';
                    prefix = '-';
                  }

                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 transition flex items-center justify-between gap-3 text-xs"
                    >
                      {/* Left: Icon & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border ${badgeColor}`}
                        >
                          {symbol}
                        </div>

                        <div className="min-w-0">
                          {/* Note / Title & Scope Tag */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {editingNoteId === tx.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="px-2 py-0.5 rounded bg-slate-950 border border-sky-500 text-xs text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineNote(tx.id)}
                                  className="p-1 rounded bg-sky-600 hover:bg-sky-500 text-white"
                                  title="Save note"
                                >
                                  <Save className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="p-1 rounded text-slate-400 hover:text-white"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="font-semibold text-slate-200 truncate">
                                {tx.note || (isCredit ? 'Credit' : isDeduct ? 'Deduction' : tx.type)}
                              </span>
                            )}

                            {/* Scope Badge */}
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {tx.clanScope === 'all' || !tx.clanScope ? 'Alliance' : tx.clanScope}
                            </span>

                            {/* Recipient Tag */}
                            {tx.recipientName && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                🎁 To: {tx.recipientName} {tx.recipientClan ? `[${tx.recipientClan}]` : ''}
                              </span>
                            )}

                            {/* Admin inline edit button */}
                            {isAdminOrOwner && onUpdateNote && editingNoteId !== tx.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(tx.id);
                                  setEditingNoteText(tx.note || '');
                                }}
                                className="text-slate-500 hover:text-sky-400 p-0.5"
                                title="Edit note"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Subtext: Tax breakdown, Actor, Timestamp */}
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap mt-0.5">
                            {tx.grossAmount && tx.taxPct ? (
                              <span className="text-slate-400 font-mono">
                                Gross: {tx.grossAmount.toLocaleString()} | Tax ({tx.taxPct}%): -{tx.taxAmount?.toLocaleString()}
                              </span>
                            ) : null}
                            <span>• By: {tx.performedBy?.name || 'Admin'}</span>
                            <span>• {new Date(tx.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Attachment Thumbnail */}
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <div className={`font-mono font-bold text-sm ${badgeColor.split(' ')[0]}`}>
                            {prefix}{Math.abs(tx.amount).toLocaleString()} 💎
                          </div>
                          {tx.balanceAfter !== undefined && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Bal: {tx.balanceAfter.toLocaleString()}
                            </div>
                          )}
                        </div>

                        {/* Thumbnail image if exists */}
                        {tx.proofImageUrl && (
                          <div
                            onClick={() => setLightboxImage(tx.proofImageUrl || null)}
                            className="relative w-9 h-9 rounded-lg border border-slate-700 overflow-hidden cursor-pointer hover:border-sky-400 transition shrink-0 group"
                            title="Click to view slip / proof"
                          >
                            <img
                              src={tx.proofImageUrl}
                              alt="Proof"
                              className="w-full h-full object-cover group-hover:scale-110 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent flex items-center justify-center transition">
                              <Maximize2 className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── 5. SNAPSHOT GENERATOR MODAL (Kain7 Replica) ── */}
      {showSnapshotModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#141c2c] via-[#0d131f] to-[#080d16] border border-sky-500/40 shadow-2xl p-5 text-slate-200 overflow-hidden space-y-4">
            
            {/* Snapshot Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t.snapshotTitle}</h3>
                  <p className="text-[11px] text-slate-400">
                    Ready to share with Discord & LINE Guild Channels
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSnapshotModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {snapshotToast && (
              <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{snapshotToast}</span>
              </div>
            )}

            {/* Live Snapshot Card Preview */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center space-y-2 text-center">
              <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                {selectedScope === 'all' ? '🌟 ALLIANCE GLOBAL FUND' : `🛡️ ${selectedScope.toUpperCase()}`}
              </span>
              <div className="text-3xl font-extrabold font-mono text-white flex items-center gap-1.5">
                <span>{currentDisplayBalance.toLocaleString()}</span>
                <span className="text-sky-400 text-xl">💎</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-400">↑ {recentStats.credits} credits</span>
                <span className="text-slate-600">•</span>
                <span className="text-rose-400">↓ {recentStats.debits} debits</span>
              </div>
            </div>

            {/* Toggle: Include Recent Transactions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapshotIncludeTx}
                    onChange={(e) => setSnapshotIncludeTx(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>{t.snapshotIncludeTx}</span>
                </label>

                {snapshotIncludeTx && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedTxForSnapshot(new Set(transactions.map((t) => t.id)))}
                      className="text-sky-400 hover:underline"
                    >
                      All
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTxForSnapshot(new Set())}
                      className="text-slate-400 hover:underline"
                    >
                      None
                    </button>
                  </div>
                )}
              </div>

              {/* Transactions Checklist */}
              {snapshotIncludeTx && (
                <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                  {transactions.slice(0, 8).map((tx) => {
                    const isSelected = selectedTxForSnapshot.has(tx.id);
                    return (
                      <label
                        key={tx.id}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-xs transition select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedTxForSnapshot);
                            if (next.has(tx.id)) next.delete(tx.id);
                            else next.add(tx.id);
                            setSelectedTxForSnapshot(next);
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="truncate flex-1 text-slate-300 font-medium">
                          {tx.note || tx.type}
                        </span>
                        <span
                          className={`font-mono font-bold text-[11px] ${
                            tx.type === 'credit' || tx.type === 'deposit'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {tx.amount.toLocaleString()} 💎
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons: Copy Image, Save Image, Copy Text */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
              {/* Copy Image Button */}
              <button
                type="button"
                disabled={snapshotCopying}
                onClick={handleCopySnapshotImage}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{snapshotCopying ? 'Copying…' : t.copyImageClip}</span>
              </button>

              {/* Download PNG Button */}
              <button
                type="button"
                onClick={handleDownloadSnapshotImage}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>{t.saveImageFile}</span>
              </button>

              {/* Copy Formatted Text Button */}
              <button
                type="button"
                onClick={handleCopySnapshotText}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.copyTextMessage}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── 6. LIGHTBOX ZOOM MODAL (Click on slip / proof) ── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Full view"
              className="max-w-full max-h-[85vh] rounded-xl object-contain border border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </div>
  );
};
