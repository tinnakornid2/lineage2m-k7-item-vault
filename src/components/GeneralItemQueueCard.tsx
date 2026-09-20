import React, { useMemo, useState } from 'react';
import { Coins, Edit3, History, ImagePlus, Layers3, Loader2, PackageCheck, ReceiptText, ShieldCheck, Trash2, Users, X, Zap } from 'lucide-react';
import { GeneralItem, ItemRarity, Language, QueueMember, User } from '../types';
import { uploadImageToGoogleDrive } from '../services/googleSheetsBackupService';
import { compressImageFile } from '../utils/imageCompressor';

interface Props {
  lang: Language;
  currentUser: User | null;
  items: GeneralItem[];
  onAdd: (item: Omit<GeneralItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Draft = Pick<GeneralItem, 'name' | 'imageUrl' | 'price' | 'quantity' | 'minPowerLevel' | 'rarity'>;
const emptyDraft: Draft = { name: '', imageUrl: '', price: 0, quantity: 1, minPowerLevel: 0, rarity: 'RARE' };
const rarityStyle: Record<ItemRarity, string> = {
  RARE: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200', EPIC: 'border-rose-500/50 bg-rose-500/10 text-rose-200',
  LAGEND: 'border-violet-500/50 bg-violet-500/10 text-violet-200', MYTHIC: 'border-amber-400/60 bg-amber-400/10 text-amber-200'
};

async function uploadOrEmbed(file: File, prefix: string) {
  const compressed = await compressImageFile(file, { maxWidth: 700, maxHeight: 700, quality: 0.74 });
  try {
    const result = await uploadImageToGoogleDrive(compressed, `${prefix}-${Date.now()}-${file.name}`);
    if (result.success && result.imageUrl) return result.imageUrl;
  } catch { /* A compressed Firestore fallback keeps uploads working when Drive quota is full. */ }
  return compressed;
}

export const GeneralItemQueueCard: React.FC<Props> = ({ lang, currentUser, items, onAdd, onUpdate, onDelete }) => {
  const th = lang === 'th';
  const canManage = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const pendingTotal = useMemo(() => items.reduce((sum, item) => sum + item.queueList.filter((m) => m.status === 'pending').length, 0), [items]);

  const closeEditor = () => { setEditorOpen(false); setEditingId(null); setDraft(emptyDraft); setImageFile(null); setImagePreview(''); setError(''); };
  const openEditor = (item?: GeneralItem) => {
    setEditingId(item?.id || null);
    setDraft(item ? { name: item.name, imageUrl: item.imageUrl, price: item.price || 0, quantity: item.quantity || 1, minPowerLevel: item.minPowerLevel || 0, rarity: item.rarity || 'RARE' } : emptyDraft);
    setImagePreview(item?.imageUrl || ''); setImageFile(null); setError(''); setEditorOpen(true);
  };
  const chooseImage = async (file?: File) => {
    if (!file?.type.startsWith('image/')) return;
    setImageFile(file); setImagePreview(await compressImageFile(file, { maxWidth: 700, maxHeight: 700, quality: 0.74 }));
  };
  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return setError(th ? 'กรุณากรอกชื่อไอเทม' : 'Item name is required');
    setSaving(true); setError('');
    try {
      const payload = { ...draft, name: draft.name.trim(), imageUrl: imageFile ? await uploadOrEmbed(imageFile, 'general-item') : draft.imageUrl, price: Math.max(0, draft.price), quantity: Math.max(1, draft.quantity), minPowerLevel: Math.max(0, draft.minPowerLevel) };
      if (editingId) await onUpdate(editingId, payload); else await onAdd({ ...payload, queueList: [], receiptHistory: [] });
      closeEditor();
    } catch (err) { setError(err instanceof Error ? err.message : (th ? 'บันทึกไม่สำเร็จ' : 'Save failed')); }
    finally { setSaving(false); }
  };
  const toggleQueue = async (item: GeneralItem) => {
    if (!currentUser) return;
    const current = item.queueList.find((m) => m.userId === currentUser.id && m.status === 'pending');
    if (!current && currentUser.powerLevel < item.minPowerLevel) return;
    setBusyId(item.id);
    try {
      const queueList = current ? item.queueList.filter((m) => m.id !== current.id) : [...item.queueList, { id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, userId: currentUser.id, name: currentUser.inGameName || currentUser.username, clan: currentUser.clan, powerLevel: currentUser.powerLevel, status: 'pending' as const }];
      await onUpdate(item.id, { queueList });
    } finally { setBusyId(null); }
  };
  const deliver = async (item: GeneralItem, member: QueueMember, file?: File) => {
    const amountText = window.prompt(th ? `จำนวนที่ส่งให้ ${member.name}` : `Quantity for ${member.name}`, '1');
    if (amountText === null) return;
    const quantity = Math.max(1, Math.min(item.quantity, Number(amountText) || 1));
    const note = window.prompt(th ? 'หมายเหตุ/เลขบิล (เว้นว่างได้)' : 'Note / receipt number (optional)', '') || '';
    setBusyId(member.id);
    try {
      const receiptImages = file ? [await uploadOrEmbed(file, 'general-item-receipt')] : [];
      const queueList = item.queueList.map((m) => m.id === member.id ? { ...m, status: 'received' as const, receivedAt: Date.now() } : m);
      const receiptHistory = [...item.receiptHistory, { id: `receipt_${Date.now()}`, userId: member.userId, name: member.name, clan: member.clan, quantity, receiptImages, note, deliveredAt: Date.now(), deliveredBy: currentUser?.inGameName || currentUser?.username || 'Admin' }];
      await onUpdate(item.id, { queueList, receiptHistory });
    } finally { setBusyId(null); }
  };
  const editReceipt = async (item: GeneralItem, receiptId: string, file?: File) => {
    const old = item.receiptHistory.find((r) => r.id === receiptId); if (!old) return;
    const note = window.prompt(th ? 'แก้ไขหมายเหตุ/เลขบิล' : 'Edit note / receipt number', old.note || '');
    if (note === null && !file) return;
    const receiptImages = file ? [await uploadOrEmbed(file, 'general-item-receipt')] : old.receiptImages;
    await onUpdate(item.id, { receiptHistory: item.receiptHistory.map((r) => r.id === receiptId ? { ...r, note: note ?? r.note, receiptImages, updatedAt: Date.now() } : r) });
  };

  return <section className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-[#101827] to-[#070b12] shadow-2xl">
    <header className="flex flex-col gap-3 border-b border-slate-800 bg-gradient-to-r from-cyan-950/30 via-slate-950/80 to-violet-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="flex items-center gap-2 text-xl font-black text-white"><PackageCheck className="h-6 w-6 text-cyan-300" />{th ? 'คิวไอเทมทั่วไป' : 'General Item Queue'}</h2><p className="mt-1 text-xs text-slate-400">{items.length} {th ? 'รายการ' : 'items'} · {pendingTotal} {th ? 'คนกำลังรอ · ผู้รับแล้วลงชื่อซ้ำได้' : 'waiting · recipients may queue again'}</p></div>
      {canManage ? <button onClick={() => openEditor()} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg hover:brightness-110">+ {th ? 'เพิ่มไอเทมทั่วไป' : 'Add general item'}</button> : null}
    </header>
    <div className="p-4 sm:p-5">{items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center text-sm text-slate-500">{th ? 'ยังไม่มีรายการ' : 'No items yet'}</div> : <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => {
      const pending = item.queueList.filter((m) => m.status === 'pending');
      const joined = !!currentUser && pending.some((m) => m.userId === currentUser.id);
      const eligible = !!currentUser && currentUser.powerLevel >= item.minPowerLevel;
      return <article key={item.id} className={`rounded-2xl border bg-slate-950/70 p-4 ${rarityStyle[item.rarity || 'RARE']}`}>
        <div className="flex gap-3"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" /> : <PackageCheck className="h-8 w-8 text-slate-600" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-white">{item.name}</h3><span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${rarityStyle[item.rarity || 'RARE']}`}>{item.rarity || 'RARE'}</span></div><div className="mt-2 grid grid-cols-3 gap-1 text-[11px]"><span className="rounded-lg bg-slate-900 px-2 py-1 text-amber-300"><Coins className="mr-1 inline h-3 w-3" />{item.price ? item.price.toLocaleString() : (th ? 'ฟรี' : 'Free')}</span><span className="rounded-lg bg-slate-900 px-2 py-1 text-emerald-300"><Layers3 className="mr-1 inline h-3 w-3" />{item.quantity}</span><span className="rounded-lg bg-slate-900 px-2 py-1 text-sky-300"><Zap className="mr-1 inline h-3 w-3" />{item.minPowerLevel.toLocaleString()}</span></div></div>{canManage ? <div className="flex"><button onClick={() => openEditor(item)} className="rounded-lg p-2 text-amber-300 hover:bg-amber-500/10"><Edit3 className="h-4 w-4" /></button><button onClick={() => window.confirm(th ? `ลบ ${item.name}?` : `Delete ${item.name}?`) && onDelete(item.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div> : null}</div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 p-3"><div className="text-xs text-slate-400"><Users className="mr-1 inline h-4 w-4 text-cyan-300" /><b className="text-white">{pending.length}</b> {th ? 'คนรอรับ' : 'waiting'}{!eligible && !joined ? <span className="ml-2 text-rose-300">· PL {item.minPowerLevel.toLocaleString()}+</span> : null}</div><button onClick={() => toggleQueue(item)} disabled={!currentUser || busyId === item.id || (!eligible && !joined)} className={`rounded-lg px-4 py-2 text-xs font-black disabled:opacity-40 ${joined ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{joined ? (th ? 'ยกเลิกชื่อ' : 'Leave') : (th ? 'ลงชื่อรับ' : 'Join')}</button></div>
        {pending.length ? <div className="mt-3 space-y-2">{pending.map((member, index) => <div key={member.id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs text-slate-300"><b className="mr-2 text-cyan-300">#{index + 1}</b><b className="text-white">{member.name}</b><span className="ml-2 text-slate-500">{member.clan} · PL {(member.powerLevel || 0).toLocaleString()}</span></div>{canManage ? <label className="cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1.5 text-center text-xs font-black text-slate-950">{busyId === member.id ? (th ? 'กำลังส่ง...' : 'Delivering...') : (th ? 'ส่งให้คนนี้ / แนบบิล' : 'Deliver / receipt')}<input type="file" accept="image/*" className="hidden" onChange={(e) => { deliver(item, member, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label> : null}</div>)}</div> : null}
        {item.receiptHistory.length ? <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"><summary className="cursor-pointer text-xs font-black text-cyan-300"><History className="mr-1 inline h-4 w-4" />{th ? 'ประวัติผู้ได้รับ' : 'History'} ({item.receiptHistory.length})</summary><div className="mt-3 space-y-2">{item.receiptHistory.slice().reverse().map((r) => <div key={r.id} className="rounded-lg bg-slate-900 p-2.5 text-xs"><div className="flex justify-between"><b className="text-white">{r.name} · {r.quantity} {th ? 'ชิ้น' : 'pcs'}</b><span className="text-slate-500">{new Date(r.deliveredAt).toLocaleString(th ? 'th-TH' : 'en-US')}</span></div>{r.note ? <p className="mt-1 text-slate-400">{r.note}</p> : null}<div className="mt-2 flex gap-3">{r.receiptImages.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="font-bold text-emerald-300"><ReceiptText className="mr-1 inline h-3.5 w-3.5" />{th ? 'ดูบิล' : 'Receipt'}</a>)}{canManage ? <label className="cursor-pointer font-bold text-amber-300">{th ? 'แก้ไข/เปลี่ยนบิล' : 'Edit'}<input type="file" accept="image/*" className="hidden" onChange={(e) => { editReceipt(item, r.id, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label> : null}</div></div>)}</div></details> : null}
      </article>;
    })}</div>}</div>
    {editorOpen ? <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && closeEditor()}><form onSubmit={saveItem} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-500/30 bg-[#080d16] shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h3 className="text-lg font-black text-white">{editingId ? (th ? 'แก้ไขไอเทมทั่วไป' : 'Edit item') : (th ? 'เพิ่มไอเทมทั่วไป' : 'Add item')}</h3><p className="text-xs text-slate-400">{th ? 'ข้อมูลนี้จะแสดงก่อนสมาชิกลงชื่อรับ' : 'Shown before members join'}</p></div><button type="button" onClick={closeEditor} className="p-2 text-slate-400"><X className="h-5 w-5" /></button></div><div className="grid gap-5 p-5 sm:grid-cols-[220px_1fr]"><label className="flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/60 text-center hover:border-cyan-400">{imagePreview ? <img src={imagePreview} alt="Preview" className="h-56 w-full object-contain p-2" /> : <><ImagePlus className="mb-2 h-10 w-10 text-cyan-300" /><b className="text-sm text-white">{th ? 'เพิ่มรูปจากเครื่อง' : 'Upload image'}</b></>}<input type="file" accept="image/*" className="hidden" onChange={(e) => chooseImage(e.target.files?.[0])} /></label><div className="space-y-4"><label className="block"><span className="mb-1 block text-xs font-bold text-slate-300">{th ? 'ชื่อไอเทม' : 'Item name'} *</span><input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-400" /></label><div className="grid grid-cols-2 gap-3">{[['price', th ? 'ราคาต่อชิ้น' : 'Unit price', 0], ['quantity', th ? 'จำนวน' : 'Quantity', 1], ['minPowerLevel', th ? 'ค่าพลังขั้นต่ำ' : 'Minimum power', 0]].map(([key, label, min]) => <label key={String(key)}><span className="mb-1 block text-xs font-bold text-slate-300">{String(label)}</span><input type="number" min={Number(min)} value={draft[key as 'price' | 'quantity' | 'minPowerLevel']} onChange={(e) => setDraft({ ...draft, [key]: Math.max(Number(min), Number(e.target.value) || Number(min)) })} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-400" /></label>)}<label><span className="mb-1 block text-xs font-bold text-slate-300">{th ? 'ระดับไอเทม' : 'Rarity'}</span><select value={draft.rarity} onChange={(e) => setDraft({ ...draft, rarity: e.target.value as ItemRarity })} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"><option value="RARE">RARE</option><option value="EPIC">EPIC</option><option value="LAGEND">LEGEND</option><option value="MYTHIC">MYTHIC</option></select></label></div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200"><ShieldCheck className="mr-1 inline h-4 w-4" />{th ? 'หาก Google เต็ม ระบบจะใช้รูปบีบอัดแทนโดยอัตโนมัติ' : 'Compressed fallback is used if Google quota is full.'}</div>{error ? <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">{error}</div> : null}</div></div><div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4"><button type="button" onClick={closeEditor} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300">{th ? 'ยกเลิก' : 'Cancel'}</button><button type="submit" disabled={saving || !draft.name.trim()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}{saving ? (th ? 'กำลังบันทึก...' : 'Saving...') : (th ? 'บันทึก' : 'Save')}</button></div></form></div> : null}
  </section>;
};
