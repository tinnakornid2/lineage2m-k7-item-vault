import React, { useState } from 'react';
import {
  X,
  Gem,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  AlertCircle
} from 'lucide-react';
import { Language, User, DiamondVaultRecord } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface DiamondVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: User | null;
  vaultBalance: number;
  transactions: DiamondVaultRecord[];
  onPerformTransaction: (type: 'deposit' | 'withdraw', amount: number, note: string) => Promise<void>;
}

export const DiamondVaultModal: React.FC<DiamondVaultModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  vaultBalance,
  transactions,
  onPerformTransaction
}) => {
  const t = translations[lang];
  const [activeAction, setActiveAction] = useState<'view' | 'deposit' | 'withdraw'>('view');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isAdminOrOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (amount <= 0) {
      setError(lang === 'th' ? 'กรุณาระบุจำนวนเพชรที่มากกว่า 0' : 'Amount must be greater than 0');
      return;
    }

    if (activeAction === 'withdraw' && amount > vaultBalance) {
      setError(lang === 'th' ? 'เพชรในคลังมีไม่เพียงพอสำหรับการถอน' : 'Insufficient diamonds in vault');
      return;
    }

    setLoading(true);
    try {
      if (activeAction === 'deposit') {
        await onPerformTransaction('deposit', amount, reason || (lang === 'th' ? 'ฝากเพชรเข้าคลัง' : 'Vault deposit'));
        sounds.playClaim();
      } else if (activeAction === 'withdraw') {
        await onPerformTransaction('withdraw', amount, reason || (lang === 'th' ? 'ถอนเพชรออกจากคลัง' : 'Vault withdrawal'));
        sounds.playClick();
      }
      setAmount(0);
      setReason('');
      setActiveAction('view');
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl bg-gradient-to-b from-[#141d2c] via-[#0d1421] to-[#090d16] border border-[#38bdf8]/40 shadow-2xl p-6 text-slate-200">
        
        {/* Close */}
        <button
          id="btn-close-vault-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-[#0284c7]/20 border border-[#38bdf8]/50 text-[#38bdf8] shadow-lg shadow-sky-950">
            <Gem className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-sky-400 to-blue-500">
              {t.diamondVault}
            </h2>
            <p className="text-xs text-slate-400">{t.diamondVaultDesc}</p>
          </div>
        </div>

        {/* Current Balance Display */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[#0d1627] to-[#121c2e] border border-[#38bdf8]/30 flex items-center justify-between shadow-inner">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
              {t.diamonds}
            </span>
            <div className="text-3xl font-extrabold font-mono text-[#38bdf8] drop-shadow-md">
              {vaultBalance.toLocaleString()}
            </div>
          </div>
          
          {/* Admin / Owner Action Buttons */}
          {isAdminOrOwner && (
            <div className="flex items-center gap-2">
              <button
                id="btn-trigger-deposit"
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveAction(activeAction === 'deposit' ? 'view' : 'deposit');
                  setError('');
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeAction === 'deposit'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>{t.deposit}</span>
              </button>

              <button
                id="btn-trigger-withdraw"
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveAction(activeAction === 'withdraw' ? 'view' : 'withdraw');
                  setError('');
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeAction === 'withdraw'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-700/50'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>{t.withdraw}</span>
              </button>
            </div>
          )}
        </div>

        {/* FORM for Deposit or Withdraw */}
        {activeAction !== 'view' && isAdminOrOwner && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl bg-[#090d16] border border-slate-700 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              {activeAction === 'deposit' ? (
                <>
                  <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                  <span>{t.depositTitle}</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4 text-amber-400" />
                  <span>{t.withdrawTitle}</span>
                </>
              )}
            </h3>

            {error && (
              <div className="p-2 rounded bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.amount} *</label>
              <input
                id="input-vault-amount"
                type="number"
                min="1"
                required
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="1000"
                className="w-full px-3 py-2 rounded bg-[#111827] border border-slate-700 focus:border-[#38bdf8] text-slate-100 text-sm font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.note}</label>
              <input
                id="input-vault-note"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น จากการขายอาวุธบอส / เบิกปันผล' : 'e.g. Boss loot sale / member split'}
                className="w-full px-3 py-2 rounded bg-[#111827] border border-slate-700 focus:border-[#38bdf8] text-slate-100 text-sm focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveAction('view')}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                id="btn-confirm-vault-tx"
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {loading ? t.loading : t.confirm}
              </button>
            </div>
          </form>
        )}

        {/* History Log */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <History className="w-3.5 h-3.5" />
            <span>{t.vaultHistory}</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">{t.noTransactions}</p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#0e1422] border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {tx.type === 'deposit' ? (
                      <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-200">
                        {tx.type === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString()} {t.diamonds}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {tx.note || (tx.type === 'deposit' ? t.deposit : t.withdraw)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>{tx.performedBy?.name || 'Admin'}</div>
                    <div>{new Date(tx.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
