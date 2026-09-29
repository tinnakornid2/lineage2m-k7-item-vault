import React, { useMemo, useState } from 'react';
import {
  Crown,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  Sparkles,
  Upload,
  UserPlus,
  AlertCircle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Users,
  PackageCheck,
  Coins,
  Zap,
  Edit3,
  History,
  ReceiptText,
  ImagePlus,
  X,
  Loader2,
  Eye,
  ShieldCheck,
  Layers3,
  Filter,
  Gift,
  Pin,
  PinOff,
  ArrowUp,
  ArrowDown,
  GripVertical
} from 'lucide-react';
import {
  GeneralItem,
  GeneralItemReceipt,
  ItemRarity,
  Language,
  QueueMember,
  QuickItem,
  User,
  DiamondVaultRecord,
  cleanClanName,
  getRarityBadge,
  getRarityBorder,
  getRarityTextGlow
} from '../types';
import { addDiamondTransactionDoc, markQueueMemberAsRemoved, unmarkQueueMemberAsRemoved } from '../services/firebase';
import { uploadImageToGoogleDrive } from '../services/googleSheetsBackupService';
import { compressImageFile } from '../utils/imageCompressor';
import { sounds } from '../utils/sound';

interface Props {
  lang: Language;
  currentUser: User | null;
  items: GeneralItem[];
  quickItems?: QuickItem[];
  allMembers?: User[];
  onAdd: (item: Omit<GeneralItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) => Promise<void>;
  onReorder?: (items: GeneralItem[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRecordDiamondLog?: (record: Omit<DiamondVaultRecord, 'id' | 'timestamp'>) => Promise<void>;
  onAddDistributedVaultItem?: (
    itemData: any,
    directDistribution?: any
  ) => Promise<void>;
  onViewImageZoom?: (url: string, title?: string) => void;
  initialBoxFilter?: 'two_boxes' | 'all' | 'open' | 'admin_pick';
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

type Draft = {
  name: string;
  imageUrl: string;
  price: number | '';
  minPowerLevel: number | '';
  maxRequestQuantity: number | '';
  isCraftGoal: boolean;
  receiptPolicy: 'per_delivery' | 'on_complete' | 'optional';
  allowMemberQueue: boolean;
  isPinned: boolean;
  rarity: ItemRarity;
};
const emptyDraft: Draft = {
  name: '',
  imageUrl: '',
  price: 0,
  minPowerLevel: 0,
  maxRequestQuantity: 1,
  isCraftGoal: false,
  receiptPolicy: 'optional',
  allowMemberQueue: true,
  isPinned: false,
  rarity: 'RARE'
};

async function uploadOrEmbed(file: File, _prefix: string) {
  const compressed = await compressImageFile(file, { maxWidth: 700, maxHeight: 700, quality: 0.74 });
  return compressed;
}

export const GeneralItemQueueCard: React.FC<Props> = ({
  lang,
  currentUser,
  items,
  quickItems = [],
  allMembers = [],
  onAdd,
  onUpdate,
  onReorder,
  onDelete,
  onRecordDiamondLog,
  onAddDistributedVaultItem,
  onViewImageZoom,
  initialBoxFilter,
  showToast
}) => {
  const th = lang === 'th';
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';


  // View Mode: 'grid' (2 items per row) vs 'table' (horizontal detailed rows)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('l2m_general_queue_view_mode_v2');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  // Add/Edit Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Item deletion state
  const [itemToDelete, setItemToDelete] = useState<GeneralItem | null>(null);

  // Add Member to Queue dropdown state
  const [activeQueueIdForAdd, setActiveQueueIdForAdd] = useState<string | null>(null);
  const [selectedMemberIdForQueue, setSelectedMemberIdForQueue] = useState<string>('');
  const [manualMemberQuantity, setManualMemberQuantity] = useState<number>(1);

  // Edit Member Queue Order Modal State
  const [editingQueueMember, setEditingQueueMember] = useState<{
    item: GeneralItem;
    member: QueueMember;
    requestedQuantity: number;
    receivedQuantity: number;
  } | null>(null);
  const [isUpdatingQueueMember, setIsUpdatingQueueMember] = useState(false);

  // Member Request with Quantity Modal
  const [requestModalData, setRequestModalData] = useState<{
    item: GeneralItem;
    quantity: number;
  } | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Deliver / Distribute Item Modal State (replaces window.prompt)
  const [deliveryModalData, setDeliveryModalData] = useState<{
    item: GeneralItem;
    member: QueueMember;
    quantity: number | '';
    price: number | '';
    billingType: 'immediate' | 'on_complete';
    sendDiscordNotification: boolean;
    note: string;
    receiptFile: File | null;
    receiptPreview: string;
    recordToDiamondVaultLog: boolean;
    keepInQueue: boolean;
  } | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);

  // Edit Receipt Modal State
  const [editingReceiptData, setEditingReceiptData] = useState<{
    item: GeneralItem;
    receipt: GeneralItemReceipt;
    note: string;
    newReceiptFile: File | null;
    newReceiptPreview: string;
  } | null>(null);
  const [isUpdatingReceipt, setIsUpdatingReceipt] = useState(false);

  // Receipt History Expand Map
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});

  // View Requesters Modal state ("กดดูรายชื่อได้")
  const [viewingRequestersItem, setViewingRequestersItem] = useState<GeneralItem | null>(null);

  // Busy action tracker
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // Drag and drop member state
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);

  // Drag and drop item card state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Keep viewingRequestersItem up to date with props
  const activeRequestersItem = useMemo(() => {
    if (!viewingRequestersItem) return null;
    return items.find((i) => i.id === viewingRequestersItem.id) || viewingRequestersItem;
  }, [items, viewingRequestersItem]);

  // Metrics (Count all members waiting or partially received)
  const pendingTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received').length, 0),
    [items]
  );

  // Sorted items: Pinned first, then sortOrder descending, then createdAt descending
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
        return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [items]);


  // Active members sorted by power level descending
  const sortedAllMembers = useMemo(() => {
    return allMembers
      .filter((m) => m.status === 'active')
      .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));
  }, [allMembers]);

  // Group clan members for add-to-queue dropdown, sorted by power level descending
  const membersByClan = useMemo(() => {
    const groups: Record<string, User[]> = {};
    sortedAllMembers.forEach((m) => {
      const clan = cleanClanName(m.clan) || (th ? 'ไม่มีแคลน' : 'No Clan');
      if (!groups[clan]) groups[clan] = [];
      groups[clan].push(m);
    });
    return groups;
  }, [sortedAllMembers, th]);

  // Dynamically resolve member name, clan and powerLevel against current profile (allMembers)
  const resolveMemberProfile = React.useCallback(
    (member: { userId?: string; name?: string; clan?: string; powerLevel?: number }) => {
      const profile = allMembers.find(
        (u) =>
          (member.userId && u.id === member.userId) ||
          (member.name && u.inGameName && u.inGameName.trim().toLowerCase() === member.name.trim().toLowerCase())
      );
      return {
        name: profile?.inGameName || member.name || '',
        clan: cleanClanName(profile?.clan || member.clan || ''),
        powerLevel: profile?.powerLevel ?? member.powerLevel ?? 0,
        profile
      };
    },
    [allMembers]
  );

  // Form Reset / Open / Close
  const closeForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setImageFile(null);
    setImagePreview('');
    setFormError('');
  };

  const openAddForm = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setImageFile(null);
    setImagePreview('');
    setFormError('');
    setShowAddForm(true);
    sounds.playClick();
  };

  const openEditForm = (item: GeneralItem) => {
    setEditingId(item.id);
    const isCraft = item.isCraftGoal === true || item.maxRequestQuantity === 0;
    setDraft({
      name: item.name,
      imageUrl: item.imageUrl || '',
      price: item.price || 0,
      minPowerLevel: item.minPowerLevel || 0,
      maxRequestQuantity: typeof item.maxRequestQuantity === 'number'
        ? item.maxRequestQuantity
        : (typeof item.quantity === 'number' ? item.quantity : 1),
      isCraftGoal: isCraft,
      receiptPolicy: item.receiptPolicy || 'optional',
      allowMemberQueue: item.allowMemberQueue !== false,
      isPinned: !!item.isPinned,
      rarity: item.rarity || 'RARE'
    });
    setImagePreview(item.imageUrl || '');
    setImageFile(null);
    setFormError('');
    setShowAddForm(true);
    sounds.playClick();
  };

  // Image Upload / Paste Handler
  const handleImageFile = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    const preview = await compressImageFile(file, { maxWidth: 700, maxHeight: 700, quality: 0.74 });
    setImagePreview(preview);
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageFile(file);
          sounds.playSuccess();
          break;
        }
      }
    }
  };

  // 1-Click Apply Quick Item Preset
  const handleApplyQuickItem = (qi: QuickItem) => {
    sounds.playClick();
    setDraft((prev) => ({
      ...prev,
      name: qi.name,
      rarity: qi.rarity || 'RARE',
      imageUrl: qi.imageUrl || ''
    }));
    setImagePreview(qi.imageUrl || '');
    setImageFile(null);
  };

  // Save Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      setFormError(th ? 'กรุณากรอกชื่อไอเทม' : 'Item name is required');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      let finalImageUrl = draft.imageUrl;
      if (imageFile) {
        finalImageUrl = await uploadOrEmbed(imageFile, 'general-item');
      }

      const isCraft = !!draft.isCraftGoal || draft.maxRequestQuantity === 0;
      const finalMaxRequest = isCraft
        ? 0
        : (typeof draft.maxRequestQuantity === 'number'
            ? Math.max(0, draft.maxRequestQuantity)
            : (draft.maxRequestQuantity === '' ? 1 : (parseInt(String(draft.maxRequestQuantity), 10) || 0)));
      const payload = {
        name: draft.name.trim(),
        imageUrl: finalImageUrl,
        price: typeof draft.price === 'number' ? Math.max(0, draft.price) : (parseInt(String(draft.price), 10) || 0),
        quantity: finalMaxRequest,
        minPowerLevel: typeof draft.minPowerLevel === 'number' ? Math.max(0, draft.minPowerLevel) : (parseInt(String(draft.minPowerLevel), 10) || 0),
        maxRequestQuantity: finalMaxRequest,
        isCraftGoal: isCraft,
        receiptPolicy: draft.receiptPolicy || 'optional',
        allowMemberQueue: draft.allowMemberQueue !== false,
        isPinned: !!draft.isPinned,
        rarity: draft.rarity || 'RARE'
      };

      if (editingId) {
        await onUpdate(editingId, payload);
        if (showToast) showToast(th ? 'แก้ไขรายการไอเทมสำเร็จ' : 'Item updated', 'success');
      } else {
        await onAdd({
          ...payload,
          queueList: [],
          receiptHistory: []
        });
        if (showToast) showToast(th ? 'เพิ่มไอเทมลงคิวสำเร็จ' : 'Item added to queue', 'success');
      }
      closeForm();
    } catch (err: any) {
      setFormError(err?.message || (th ? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'Failed to save, please retry'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Member Queue Actions: Join / Leave
  const handleToggleQueue = async (item: GeneralItem, requestedQty?: number) => {
    if (!currentUser) return;
    const pendingList = (item.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received');
    const isAlreadyInQueue = pendingList.some(
      (m) =>
        (m.userId && m.userId === currentUser.id) ||
        (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
    );

    if (!isAlreadyInQueue && currentUser.powerLevel < (item.minPowerLevel || 0)) {
      if (showToast) {
        showToast(
          th
            ? `พลังของคุณ (${currentUser.powerLevel.toLocaleString()}) ยังไม่ถึงเกณฑ์ขั้นต่ำ (${item.minPowerLevel.toLocaleString()})`
            : `Your power level (${currentUser.powerLevel.toLocaleString()}) is below requirement (${item.minPowerLevel.toLocaleString()})`,
          'warning'
        );
      }
      return;
    }

    if (!isAlreadyInQueue && item.allowMemberQueue === false && !isAdminOrOwner) {
      if (showToast) showToast(th ? 'ไอเทมนี้แอดมินเลือกแจกเท่านั้น' : 'This item is admin pick only', 'info');
      return;
    }

    setBusyItemId(item.id);
    sounds.playClick();
    try {
      let updatedQueueList: QueueMember[];
      if (isAlreadyInQueue) {
        // Record removal tombstone so no background sync or relay resurrects the cancelled queue
        markQueueMemberAsRemoved(item.id, undefined, currentUser.id, currentUser.inGameName || currentUser.username);
        // Remove user's pending/partially_received entry
        updatedQueueList = (item.queueList || []).filter(
          (m) =>
            !(
              (m.status === 'pending' || m.status === 'partially_received') &&
              ((m.userId && m.userId === currentUser.id) ||
                (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase()))
            )
        );
      } else {
        const isCraftGoal = item.isCraftGoal === true || item.maxRequestQuantity === 0 || requestedQty === 0;
        const targetQty = isCraftGoal ? 0 : Math.max(1, requestedQty || 1);
        // Add user to queue
        const newMember: QueueMember = {
          id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: currentUser.id,
          name: currentUser.inGameName || currentUser.username,
          clan: cleanClanName(currentUser.clan) || 'VoltZ',
          powerLevel: currentUser.powerLevel || 0,
          characterClass: currentUser.characterClass,
          requestedQuantity: targetQty,
          receivedQuantity: 0,
          status: 'pending',
          joinedAt: Date.now()
        };
        unmarkQueueMemberAsRemoved(item.id, newMember.id, newMember.userId, newMember.name);
        updatedQueueList = [...(item.queueList || []), newMember];
      }
      await onUpdate(item.id, { queueList: updatedQueueList });
      if (showToast) {
        showToast(
          isAlreadyInQueue
            ? (th ? 'ยกเลิกการต่อคิวเรียบร้อย' : 'Left queue successfully')
            : (th ? 'ลงชื่อขอรับไอเทมสำเร็จ!' : 'Requested item successfully!'),
          isAlreadyInQueue ? 'info' : 'success'
        );
      }
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'เกิดข้อผิดพลาด' : 'An error occurred'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Member initiate request (checks max request quantity modal vs direct request)
  const handleInitiateRequest = (item: GeneralItem) => {
    if (!currentUser) return;
    const pendingList = (item.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received');
    const isAlreadyInQueue = pendingList.some(
      (m) =>
        (m.userId && m.userId === currentUser.id) ||
        (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
    );

    if (isAlreadyInQueue) {
      if (window.confirm(th ? `ต้องการยกเลิกคิวขอรับไอเทม "${item.name}" ใช่หรือไม่?` : `Cancel queue request for "${item.name}"?`)) {
        handleToggleQueue(item);
      }
      return;
    }

    if (currentUser.powerLevel < (item.minPowerLevel || 0)) {
      if (showToast) {
        showToast(
          th
            ? `พลังของคุณ (${currentUser.powerLevel.toLocaleString()}) ยังไม่ถึงเกณฑ์ขั้นต่ำ (${item.minPowerLevel.toLocaleString()})`
            : `Your power level (${currentUser.powerLevel.toLocaleString()}) is below requirement (${item.minPowerLevel.toLocaleString()})`,
          'warning'
        );
      }
      return;
    }

    if (item.allowMemberQueue === false && !isAdminOrOwner) {
      if (showToast) showToast(th ? 'ไอเทมนี้แอดมินเลือกแจกเท่านั้น' : 'This item is admin pick only', 'info');
      return;
    }

    setRequestModalData({
      item,
      quantity: 1
    });
  };

  // Member Confirm Request from Modal
  const handleConfirmRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestModalData || !currentUser) return;
    const { item, quantity } = requestModalData;
    const isCraftGoal = item.isCraftGoal === true || item.maxRequestQuantity === 0;
    const reqQty = isCraftGoal ? 0 : Math.max(1, typeof quantity === 'number' ? quantity : (parseInt(String(quantity), 10) || 1));
    setIsSubmittingRequest(true);
    try {
      await handleToggleQueue(item, reqQty);
      setRequestModalData(null);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Admin/Owner: Pin / Unpin Item
  const handleTogglePin = async (item: GeneralItem) => {
    sounds.playClick();
    setBusyItemId(item.id);
    try {
      const nextPin = !item.isPinned;
      await onUpdate(item.id, { isPinned: nextPin });
      if (showToast) {
        showToast(
          nextPin
            ? (th ? `ปักหมุดไอเทม "${item.name}" ไว้ด้านบนสุดแล้ว` : `Pinned "${item.name}" to top`)
            : (th ? `ยกเลิกการปักหมุด "${item.name}" แล้ว` : `Unpinned "${item.name}"`),
          'info'
        );
      }
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'เกิดข้อผิดพลาด' : 'Failed to update pin'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Admin/Owner: Drag and drop item box to reorder freely
  const handleDropItemOnTarget = async (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const fromIdx = sortedItems.findIndex((i) => i.id === sourceId);
    const toIdx = sortedItems.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...sortedItems];
    const [movedItem] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, movedItem);

    // Determine pinning based on neighbors in target position
    const prevItem = toIdx > 0 ? reordered[toIdx - 1] : null;
    const nextItem = toIdx < reordered.length - 1 ? reordered[toIdx + 1] : null;

    let targetIsPinned = movedItem.isPinned;
    if (prevItem?.isPinned && nextItem?.isPinned) {
      targetIsPinned = true;
    } else if (toIdx === 0 && nextItem?.isPinned) {
      targetIsPinned = true;
    } else if (!prevItem?.isPinned && !nextItem?.isPinned) {
      targetIsPinned = false;
    }

    // Assign spaced descending sortOrder so visual order matches 100%
    const total = reordered.length;
    const updatedItems = reordered.map((item, index) => {
      const isPinned = item.id === sourceId ? targetIsPinned : item.isPinned;
      const sortOrder = (total - index) * 1000;
      return {
        ...item,
        isPinned,
        sortOrder
      };
    });

    setDraggedItemId(null);
    setDragOverItemId(null);
    setBusyItemId(sourceId);
    sounds.playSuccess();

    try {
      if (onReorder) {
        await onReorder(updatedItems);
      } else {
        await onUpdate(sourceId, {
          sortOrder: updatedItems[toIdx].sortOrder,
          isPinned: targetIsPinned
        });
      }
      if (showToast) {
        showToast(
          th ? `สลับตำแหน่งไอเทม "${movedItem.name}" เรียบร้อย` : `Reordered "${movedItem.name}" successfully`,
          'success'
        );
      }
    } catch (err: any) {
      if (showToast) {
        showToast(err?.message || (th ? 'ไม่สามารถสลับตำแหน่งได้' : 'Failed to reorder'), 'error');
      }
    } finally {
      setBusyItemId(null);
    }
  };

  // Admin/Owner: Move Item Order Up / Down (uses handleDropItemOnTarget for unified logic)
  const handleMoveItemOrder = async (item: GeneralItem, direction: 'up' | 'down', listScope?: GeneralItem[]) => {
    sounds.playClick();
    const list = listScope && listScope.length > 0 ? listScope : sortedItems;
    const currentIndex = list.findIndex((i) => i.id === item.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const targetItem = list[targetIndex];
    await handleDropItemOnTarget(item.id, targetItem.id);
  };

  // Admin: Reorder Member in Queue
  const handleMoveMemberInQueue = async (item: GeneralItem, memberId: string, direction: 'up' | 'down') => {
    sounds.playClick();
    const list = [...(item.queueList || [])];
    const index = list.findIndex((m) => m.id === memberId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);
    setBusyItemId(item.id);
    try {
      await onUpdate(item.id, { queueList: list });
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'ไม่สามารถจัดลำดับได้' : 'Failed to reorder'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Admin: Drag and drop member to reorder
  const handleDropMemberOnTarget = async (item: GeneralItem, targetMemberId: string) => {
    if (!draggedMemberId || draggedMemberId === targetMemberId) return;
    const list = [...(item.queueList || [])];
    const fromIndex = list.findIndex((m) => m.id === draggedMemberId);
    const toIndex = list.findIndex((m) => m.id === targetMemberId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    setDraggedMemberId(null);
    setBusyItemId(item.id);
    sounds.playClick();
    try {
      await onUpdate(item.id, { queueList: list });
      if (showToast) showToast(th ? 'สลับลำดับคิวเรียบร้อย' : 'Reordered queue', 'success');
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'ไม่สามารถสลับลำดับได้' : 'Failed to reorder'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Admin or Member: Remove specific member from queue
  const handleRemoveMemberFromQueue = async (item: GeneralItem, memberId: string) => {
    sounds.playClick();
    setBusyItemId(item.id);
    try {
      const targetMember = (item.queueList || []).find((m) => m.id === memberId);
      markQueueMemberAsRemoved(item.id, memberId, targetMember?.userId, targetMember?.name);
      const updatedQueueList = (item.queueList || []).filter((m) => m.id !== memberId);
      await onUpdate(item.id, { queueList: updatedQueueList });
      if (showToast) showToast(th ? 'นำออกจากคิวเรียบร้อย' : 'Removed from queue', 'info');
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'เกิดข้อผิดพลาด' : 'An error occurred'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Admin: Add specific member to queue
  const handleAdminAddMember = async (itemId: string) => {
    if (!selectedMemberIdForQueue) return;
    const mem = allMembers.find((m) => m.id === selectedMemberIdForQueue);
    if (!mem) return;

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    sounds.playClick();
    setBusyItemId(itemId);
    try {
      const isCraftGoal = item.isCraftGoal === true || item.maxRequestQuantity === 0;
      const finalReq = isCraftGoal ? 0 : Math.max(1, manualMemberQuantity || 1);
      const newMember: QueueMember = {
        id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: mem.id,
        name: mem.inGameName || mem.username,
        clan: cleanClanName(mem.clan) || 'VoltZ',
        powerLevel: mem.powerLevel || 0,
        requestedQuantity: finalReq,
        receivedQuantity: 0,
        status: 'pending',
        joinedAt: Date.now()
      };
      unmarkQueueMemberAsRemoved(itemId, newMember.id, newMember.userId, newMember.name);
      const updatedQueue = [...(item.queueList || []), newMember];
      await onUpdate(itemId, { queueList: updatedQueue });
      setActiveQueueIdForAdd(null);
      setSelectedMemberIdForQueue('');
      setManualMemberQuantity(1);
      if (showToast) {
        showToast(
          th
            ? (isCraftGoal
                ? `เพิ่ม ${mem.inGameName} ลงคิวสำเร็จ (🎯 จนกว่าจะคราฟสำเร็จ)`
                : `เพิ่ม ${mem.inGameName} ลงคิวสำเร็จ (x${finalReq} ชิ้น)`)
            : (isCraftGoal
                ? `Added ${mem.inGameName} to queue (🎯 Until crafted)`
                : `Added ${mem.inGameName} to queue (x${finalReq} pcs)`),
          'success'
        );
      }
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'เพิ่มไม่สำเร็จ' : 'Failed to add member'), 'error');
    } finally {
      setBusyItemId(null);
    }
  };

  // Owner/Admin: Save Edited Queue Member Order (Requested & Received Quantity)
  const handleSaveEditedQueueMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQueueMember) return;
    const { item, member, requestedQuantity, receivedQuantity } = editingQueueMember;
    const finalReq = typeof requestedQuantity === 'number'
      ? Math.max(0, requestedQuantity)
      : (requestedQuantity === '' ? 0 : (parseInt(String(requestedQuantity), 10) || 0));
    const finalRec = Math.max(0, receivedQuantity || 0);
    const isCraftGoal = item.isCraftGoal === true || item.maxRequestQuantity === 0 || finalReq === 0;
    const isCompleted = isCraftGoal ? false : finalRec >= finalReq;
    const status = isCompleted ? 'received' : finalRec > 0 ? 'partially_received' : 'pending';

    setIsUpdatingQueueMember(true);
    sounds.playClick();
    try {
      const updatedList = (item.queueList || []).map((m) => {
        if (m.id === member.id) {
          return {
            ...m,
            requestedQuantity: finalReq,
            receivedQuantity: finalRec,
            status: status as any,
            receivedAt: isCompleted ? Date.now() : m.receivedAt
          };
        }
        return m;
      });
      await onUpdate(item.id, { queueList: updatedList });
      sounds.playSuccess();
      if (showToast) showToast(th ? `อัปเดตออเดอร์ของ ${member.name} เรียบร้อย` : `Updated order for ${member.name}`, 'success');
      setEditingQueueMember(null);
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'อัปเดตไม่สำเร็จ' : 'Failed to update order'), 'error');
    } finally {
      setIsUpdatingQueueMember(false);
    }
  };

  // Open In-App Delivery / Distribute Modal (replaces window.prompt)
  const openDeliverModal = (item: GeneralItem, member?: QueueMember | null) => {
    sounds.playClick();
    const pendingMembers = (item.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received');
    let targetMember: QueueMember;

    if (member) {
      targetMember = member;
    } else if (pendingMembers.length > 0) {
      targetMember = pendingMembers[0];
    } else if (allMembers.length > 0) {
      const firstActive = allMembers.find((m) => m.status === 'active') || allMembers[0];
      targetMember = {
        id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: firstActive.id,
        name: firstActive.inGameName || firstActive.username,
        clan: cleanClanName(firstActive.clan) || 'VoltZ',
        powerLevel: firstActive.powerLevel || 0,
        status: 'pending',
        joinedAt: Date.now()
      };
    } else {
      targetMember = {
        id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: currentUser?.id || '',
        name: currentUser?.inGameName || currentUser?.username || 'Member',
        clan: cleanClanName(currentUser?.clan) || 'VoltZ',
        powerLevel: currentUser?.powerLevel || 0,
        status: 'pending',
        joinedAt: Date.now()
      };
    }

    const isCraftGoal = item.isCraftGoal || item.maxRequestQuantity === 0 || targetMember.requestedQuantity === 0;
    const remainingNeeded = isCraftGoal
      ? 1
      : Math.max(1, (targetMember.requestedQuantity || 1) - (targetMember.receivedQuantity || 0));
    const deliverQty = item.quantity > 0 ? Math.min(item.quantity, remainingNeeded) : remainingNeeded;
    const willComplete = isCraftGoal ? false : deliverQty >= remainingNeeded;
    setDeliveryModalData({
      item,
      member: targetMember,
      quantity: deliverQty,
      price: item.price || 0,
      billingType: item.receiptPolicy === 'on_complete' ? 'on_complete' : 'immediate',
      sendDiscordNotification: willComplete,
      note: '',
      receiptFile: null,
      receiptPreview: '',
      recordToDiamondVaultLog: false,
      keepInQueue: isCraftGoal
    });
  };

  // Confirm Delivery Submit
  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalData) return;
    const { item, member, quantity, price, billingType, sendDiscordNotification, note, receiptFile, keepInQueue } = deliveryModalData;
    if (!member.name) {
      if (showToast) showToast(th ? 'กรุณาระบุหรือเลือกผู้รับไอเทม' : 'Please select a recipient', 'warning');
      return;
    }

    setIsDelivering(true);
    try {
      const deliveredQty = Math.max(1, typeof quantity === 'number' ? quantity : (parseInt(String(quantity), 10) || 1));
      const finalDeliveryPrice = typeof price === 'number' ? Math.max(0, price) : (parseInt(String(price), 10) || 0);
      const isFree = finalDeliveryPrice === 0;
      const totalDiamonds = finalDeliveryPrice * deliveredQty;

      // Free items do not require receipt attachment ("ถ้าเป็นไอเทมฟรี ไม่ต้องแนบ")
      let receiptImages: string[] = [];
      if (!isFree && receiptFile) {
        const uploaded = await uploadOrEmbed(receiptFile, 'general-item-receipt');
        receiptImages = [uploaded];
      }

      const prevReceived = Number(member.receivedQuantity || 0);
      const newReceived = prevReceived + deliveredQty;
      const isCraftGoal = item.isCraftGoal || item.maxRequestQuantity === 0 || member.requestedQuantity === 0;
      const targetReq = isCraftGoal ? 0 : Math.max(1, Number(member.requestedQuantity || 1));
      
      // If keepInQueue is true, member remains in queue for crafting!
      // If keepInQueue is false, it completes the delivery / craft!
      const isCompleted = !keepInQueue || (!isCraftGoal && newReceived >= targetReq);

      const queueList = (item.queueList || []).map((m) => {
        if (m.id === member.id || (member.userId && m.userId === member.userId)) {
          return {
            ...m,
            requestedQuantity: isCraftGoal ? 0 : (m.requestedQuantity || targetReq),
            receivedQuantity: newReceived,
            status: (isCompleted ? 'received' : 'partially_received') as 'received' | 'partially_received',
            receivedAt: isCompleted ? Date.now() : m.receivedAt
          };
        }
        return m;
      });

      const newReceipt: GeneralItemReceipt = {
        id: `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: member.userId,
        name: member.name,
        clan: member.clan,
        quantity: deliveredQty,
        requestedQuantity: isCraftGoal ? 0 : (member.requestedQuantity || 1),
        diamondPrice: finalDeliveryPrice,
        totalDiamonds,
        receiptImages: isFree ? [] : receiptImages,
        hunterScreenshots: [], // Item Queue items have no hunters
        billingType: isFree ? 'immediate' : (billingType || 'immediate'),
        note: note.trim(),
        deliveredAt: Date.now(),
        deliveredBy: currentUser?.inGameName || currentUser?.username || 'Admin',
        itemId: item.id,
        itemName: item.name,
        itemRarity: item.rarity,
        itemImageUrl: item.imageUrl
      };

      const receiptHistory = [...(item.receiptHistory || []), newReceipt];
      await onUpdate(item.id, { queueList, receiptHistory });

      // Unify with "ไอเทมที่แจกแล้ว" (Centralized Distributed Archive)
      // Free items are immediately marked as 'paid' with zero receipt required ("ถ้าเป็นไอเทมฟรี ไม่ต้องแนบและไม่ต้องยืนยันชำระ แจกฟรี")
      if (onAddDistributedVaultItem) {
        try {
          await onAddDistributedVaultItem(
            {
              name: item.name,
              imageUrl: item.imageUrl,
              price: finalDeliveryPrice,
              minPowerLevel: item.minPowerLevel || 0,
              rarity: item.rarity,
              quantity: deliveredQty,
              hunters: [],
              hunterScreenshots: [],
              source: 'item_queue'
            },
            {
              recipient: {
                name: member.name,
                inGameName: member.name,
                clan: member.clan,
                userId: member.userId
              },
              receiptImages: isFree ? [] : receiptImages,
              paymentStatus: isFree ? 'paid' : 'pending',
              skipDiscordNotification: !sendDiscordNotification
            }
          );
        } catch (distErr) {
          console.warn('Failed to mirror to distributed archive:', distErr);
        }
      }

      // NOTE: Per requirement, diamonds are strictly NOT added to Clan Diamond Vault Fund ("เพชรไม่คิดเข้ากองกลาง")

      sounds.playSuccess();
      if (showToast) {
        showToast(
          th
            ? (keepInQueue
                ? `แจกไอเทม ${item.name} ให้ ${member.name} (x${deliveredQty} ชิ้น) เรียบร้อย! (ยังคงอยู่ในคิวเพื่อคราฟต่อ: รับไปแล้วรวม ${newReceived} ชิ้น)`
                : isCompleted
                  ? `แจกไอเทม ${item.name} ให้ ${member.name} (x${deliveredQty} ชิ้น) ครบถ้วน/คราฟสำเร็จแล้ว!`
                  : `แจกไอเทม ${item.name} ให้ ${member.name} (x${deliveredQty} ชิ้น) เรียบร้อย! (ยังคงอยู่ในคิว ${newReceived}/${targetReq} ชิ้น)`)
            : (keepInQueue
                ? `Delivered ${item.name} to ${member.name} (x${deliveredQty} pcs)! (Kept in queue for crafting: ${newReceived} pcs total received)`
                : isCompleted
                  ? `Delivered ${item.name} to ${member.name} (x${deliveredQty} pcs) fully completed!`
                  : `Delivered ${item.name} to ${member.name} (x${deliveredQty} pcs)! (Still in queue ${newReceived}/${targetReq} pcs)`),
          'success'
        );
      }
      setDeliveryModalData(null);
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'การส่งมอบขัดข้อง' : 'Delivery failed'), 'error');
    } finally {
      setIsDelivering(false);
    }
  };

  // Confirm Edit Receipt
  const handleConfirmEditReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceiptData) return;
    const { item, receipt, note, newReceiptFile } = editingReceiptData;

    setIsUpdatingReceipt(true);
    try {
      let receiptImages = receipt.receiptImages || [];
      if (newReceiptFile) {
        const uploaded = await uploadOrEmbed(newReceiptFile, 'general-item-receipt');
        receiptImages = [uploaded];
      }

      const updatedHistory = (item.receiptHistory || []).map((r) =>
        r.id === receipt.id
          ? {
              ...r,
              note: note.trim(),
              receiptImages,
              updatedAt: Date.now()
            }
          : r
      );

      await onUpdate(item.id, { receiptHistory: updatedHistory });
      sounds.playSuccess();
      if (showToast) showToast(th ? 'อัปเดตบันทึกบิลสำเร็จ' : 'Receipt note updated', 'success');
      setEditingReceiptData(null);
    } catch (err: any) {
      if (showToast) showToast(err?.message || (th ? 'อัปเดตไม่สำเร็จ' : 'Update failed'), 'error');
    } finally {
      setIsUpdatingReceipt(false);
    }
  };

  // Render Individual Item Card for Grid View
  const renderItemCard = (item: GeneralItem, itemIdx: number, totalInList?: number, listScope?: GeneralItem[]) => {
    const pendingList = (item.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received');
    const userIndex = currentUser
      ? pendingList.findIndex(
          (m) =>
            (m.userId && m.userId === currentUser.id) ||
            (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
        )
      : -1;
    const isUserInQueue = userIndex !== -1;
    const meetsPowerReq = !currentUser || currentUser.powerLevel >= (item.minPowerLevel || 0);
    const countInList = totalInList ?? sortedItems.length;

    return (
      <div
        key={item.id}
        draggable={isAdminOrOwner}
        onDragStart={(e) => {
          if (draggedMemberId) return;
          setDraggedItemId(item.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', item.id);
        }}
        onDragEnd={() => {
          setDraggedItemId(null);
          setDragOverItemId(null);
        }}
        onDragOver={(e) => {
          if (isAdminOrOwner && draggedItemId && draggedItemId !== item.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverItemId !== item.id) {
              setDragOverItemId(item.id);
            }
          }
        }}
        onDragLeave={(e) => {
          if (dragOverItemId === item.id && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverItemId(null);
          }
        }}
        onDrop={(e) => {
          if (isAdminOrOwner && draggedItemId && draggedItemId !== item.id) {
            e.preventDefault();
            e.stopPropagation();
            handleDropItemOnTarget(draggedItemId, item.id);
          }
        }}
        className={`rounded-2xl border bg-gradient-to-b from-[#0e1422] via-[#090d16] to-[#070a12] p-3 sm:p-3.5 shadow-xl transition-all flex flex-col justify-start gap-2.5 group relative overflow-hidden ${
          isAdminOrOwner ? 'cursor-grab active:cursor-grabbing' : ''
        } ${
          draggedItemId === item.id
            ? 'opacity-40 scale-[0.98] border-cyan-400 border-dashed ring-2 ring-cyan-500/50'
            : dragOverItemId === item.id
            ? 'border-amber-400 ring-2 ring-amber-500/60 scale-[1.01] bg-amber-950/20'
            : item.isPinned
            ? 'border-amber-500/50 ring-1 ring-amber-500/20 shadow-amber-500/10'
            : 'border-slate-800/90 hover:border-slate-700'
        }`}
      >
        {/* Item Top Bar: Pinned Badge + Admin Pin / Order Controls */}
        <div className="flex items-center justify-between gap-1.5 border-b border-slate-800/60 pb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {item.isPinned && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-sm shrink-0">
                <Pin className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{th ? 'ปักหมุด' : 'Pinned'}</span>
              </span>
            )}
            {item.allowMemberQueue === false ? (
              <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 shrink-0">
                🔒 {th ? 'แอดมินแจก' : 'Admin Pick'}
              </span>
            ) : (
              <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1 shrink-0">
                👥 {th ? 'กดรับเอง' : 'Open'}
              </span>
            )}

            {/* Requesters button: moved to top bar beside badge */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setViewingRequestersItem(item);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-400 text-blue-200 transition-all cursor-pointer font-semibold text-[10px] shadow-sm group shrink-0"
              title={th ? 'คลิกเพื่อดูรายชื่อคนขอรับทั้งหมด' : 'Click to view all requesters'}
            >
              <Users className="w-3 h-3 text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-mono font-bold text-[10.5px]">{pendingList.length}</span>
              <span className="text-[9.5px] text-sky-400 underline">{th ? 'ดูรายชื่อ' : 'View'}</span>
            </button>
          </div>

          {/* Admin Controls: Pin & Reorder Item */}
          {isAdminOrOwner && (
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <div
                className="p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors"
                title={th ? 'ลากเพื่อปรับตำแหน่งกล่องไอเทม' : 'Drag to reorder item card'}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <button
                type="button"
                onClick={() => handleTogglePin(item)}
                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                  item.isPinned
                    ? 'bg-amber-500/25 border-amber-500/70 text-amber-300 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-amber-300'
                }`}
                title={item.isPinned ? (th ? 'ยกเลิกการปักหมุด' : 'Unpin') : (th ? 'ปักหมุดไอเทมนี้ไว้บนสุด' : 'Pin to top')}
              >
                <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                disabled={itemIdx === 0}
                onClick={() => handleMoveItemOrder(item, 'up', listScope)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                title={th ? 'เลื่อนขึ้น / ซ้าย' : 'Move up / left'}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={itemIdx === countInList - 1}
                onClick={() => handleMoveItemOrder(item, 'down', listScope)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                title={th ? 'เลื่อนลง / ขวา' : 'Move down / right'}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Row 1: Image, Name, and Key Badges */}
        <div className="flex items-center gap-3 min-w-0">
          {item.imageUrl ? (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                if (onViewImageZoom) onViewImageZoom(item.imageUrl, item.name);
              }}
              className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 hover:border-[#d4af37] shrink-0 cursor-pointer shadow group-hover:scale-105 transition-transform"
              title={th ? 'คลิกเพื่อดูรูปขยาย' : 'Click to zoom image'}
            >
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            </button>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center shrink-0">
              <PackageCheck className="w-6 h-6 text-slate-500" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border uppercase shrink-0 ${getRarityBadge(item.rarity || 'RARE')}`}>
                {item.rarity || 'RARE'}
              </span>
              <span className={`font-bold text-sm truncate ${getRarityTextGlow(item.rarity || 'RARE')}`}>
                {item.name}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
              {/* Diamond Price */}
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-[11px] shrink-0">
                {item.price ? `${item.price.toLocaleString()} 💎` : (th ? 'แจกฟรี' : 'Free')}
              </span>
              {/* Min PL */}
              <span className={`px-2 py-0.5 rounded border font-mono font-bold text-[11px] shrink-0 ${
                item.minPowerLevel > 0
                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                  : 'bg-slate-800/40 border-slate-800 text-slate-400'
              }`}>
                {item.minPowerLevel > 0 ? `⚡ ${item.minPowerLevel.toLocaleString()}+ PL` : (th ? 'ไม่จำกัด' : 'None')}
              </span>
              {/* Max Request Qty: Craft Goal (0) or > 1 */}
              {item.isCraftGoal || item.maxRequestQuantity === 0 ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-[11px] shrink-0" title={th ? 'แจกจนกว่าจะคราฟสำเร็จ' : 'Distribute until craft succeeds'}>
                  {th ? '🎯 จนกว่าจะคราฟสำเร็จ' : '🎯 Until crafted'}
                </span>
              ) : (item.maxRequestQuantity || 1) > 1 ? (
                <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono font-bold text-[11px] shrink-0" title={th ? `ขอรับได้สูงสุดคนละ ${item.maxRequestQuantity} ชิ้น` : `Max ${item.maxRequestQuantity} pcs per member`}>
                  {th ? `สูงสุด ${item.maxRequestQuantity} ชิ้น/คน` : `Max ${item.maxRequestQuantity} pcs/p`}
                </span>
              ) : null}
              {/* Receipts count */}
              <span className="text-[10px] text-slate-500 shrink-0">
                {(item.receiptHistory || []).length} {th ? 'บิลส่งมอบ' : 'receipts'}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Action Toolbar (Flexible, responsive wrapping) */}
        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/60 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {/* Admin/Owner Prominent Distribute Item Button */}
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => openDeliverModal(item)}
                className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1 shrink-0"
                title={th ? 'แจกไอเทม' : 'Distribute item'}
              >
                <Gift className="w-3 h-3 text-amber-300 shrink-0" />
                <span>{th ? 'แจกไอเทม' : 'Distribute'}</span>
              </button>
            )}

            {/* Member Request Button */}
            {item.allowMemberQueue !== false || isUserInQueue ? (
              <button
                type="button"
                disabled={!currentUser || busyItemId === item.id || (!meetsPowerReq && !isUserInQueue)}
                onClick={() => handleInitiateRequest(item)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
                  isUserInQueue
                    ? 'bg-amber-950/80 hover:bg-red-950 border border-amber-500/60 hover:border-red-600 text-amber-200 hover:text-red-200 shadow-sm'
                    : meetsPowerReq
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:brightness-110 text-slate-950 font-black shadow-amber-500/20 active:scale-95'
                    : 'bg-slate-800 text-slate-400'
                }`}
                title={isUserInQueue ? (th ? 'คลิกเพื่อยกเลิกคิว' : 'Click to cancel queue') : undefined}
              >
                {busyItemId === item.id ? (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                ) : isUserInQueue ? (
                  <>
                    <X className="w-3 h-3 text-red-400 shrink-0" />
                    <span>{th ? `คิว ${userIndex !== -1 ? userIndex + 1 : 1} • ยกเลิก` : `#${userIndex !== -1 ? userIndex + 1 : 1} • Cancel`}</span>
                  </>
                ) : meetsPowerReq ? (
                  <>
                    <Sparkles className="w-3 h-3 text-slate-950 shrink-0" />
                    <span>{th ? 'ขอรับไอเทม' : 'Request'}</span>
                  </>
                ) : (
                  <span>{th ? 'พลังไม่ถึง' : 'Low PL'}</span>
                )}
              </button>
            ) : (
              <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[10.5px] font-semibold flex items-center gap-1 shrink-0">
                🔒 {th ? 'แอดมินแจก' : 'Admin Pick'}
              </span>
            )}
          </div>

          {/* Admin Management Icons */}
          {isAdminOrOwner && (
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveQueueIdForAdd(activeQueueIdForAdd === item.id ? null : item.id);
                }}
                className={`p-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  activeQueueIdForAdd === item.id
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
                title={th ? 'เพิ่มสมาชิกลงคิวด้วยตนเอง' : 'Add member manually'}
              >
                <UserPlus className="w-3.5 h-3.5 text-[#38bdf8]" />
              </button>
              <button
                type="button"
                onClick={() => openEditForm(item)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                title={th ? 'แก้ไข' : 'Edit'}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setItemToDelete(item)}
                className="p-1 rounded-lg bg-red-950/60 hover:bg-red-800 text-red-300 cursor-pointer"
                title={th ? 'ลบ' : 'Delete'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* In-line Add Member form if activeQueueIdForAdd === item.id */}
        {activeQueueIdForAdd === item.id && isAdminOrOwner && (
          <div className="p-2.5 rounded-xl bg-[#090d16] border border-sky-500/30 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                <UserPlus className="w-3.5 h-3.5" />
                <span>{th ? 'เพิ่มสมาชิกเข้าคิวนี้' : 'Add Member to Queue'}</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveQueueIdForAdd(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMemberIdForQueue}
                onChange={(e) => setSelectedMemberIdForQueue(e.target.value)}
                className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">{th ? '-- เลือกสมาชิก --' : '-- Select Member --'}</option>
                {allMembers
                  .filter((m) => m.status === 'active')
                  .sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.inGameName || m.username} ({cleanClanName(m.clan) || 'VoltZ'}) {m.powerLevel ? `• ⚡ ${m.powerLevel.toLocaleString()} PL` : ''}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min={1}
                max={item.maxRequestQuantity || 99}
                value={manualMemberQuantity}
                onChange={(e) => setManualMemberQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-14 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs text-center font-bold focus:border-sky-400 focus:outline-none"
                title={th ? 'จำนวนที่ขอรับ' : 'Requested quantity'}
              />
              <button
                type="button"
                disabled={!selectedMemberIdForQueue}
                onClick={() => handleAdminAddMember(item.id)}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0"
              >
                {th ? 'เพิ่ม' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {/* Row 3: Waiting Members Queue List (Directly connects below actions) */}
        <div className="p-2.5 rounded-xl bg-[#060a12] border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>{th ? 'ลำดับคิวผู้ขอรับ' : 'Queue Order'} ({pendingList.length})</span>
            </span>
            {pendingList.length > 5 && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setViewingRequestersItem(item);
                }}
                className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline cursor-pointer font-semibold"
              >
                {th ? `ดูทั้งหมด ${pendingList.length} คน` : `View all ${pendingList.length}`}
              </button>
            )}
          </div>

          {pendingList.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-500 italic">
              {th ? 'ยังไม่มีสมาชิกขอรับไอเทมนี้' : 'No requesters in queue yet'}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Table Column Sub-Header for Queue List */}
              <div className="flex items-center justify-between px-2 py-0.5 text-[9px] font-semibold text-slate-400 border-b border-slate-800/80 mb-1 select-none">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                  {isAdminOrOwner && <span className="w-3 shrink-0" />}
                  <span className="w-4 text-center shrink-0">#</span>
                  <span className="truncate min-w-0 flex-1">{th ? 'ชื่อตัวละคร' : 'Character'}</span>
                  <span className="w-[64px] sm:w-[72px] text-right shrink-0">{th ? 'ค่าพลัง' : 'Power'}</span>
                  <span className="w-10 text-center shrink-0">{th ? 'รับ/ขอ' : 'Qty'}</span>
                </div>
                {isAdminOrOwner && (
                  <span className="w-[76px] text-center shrink-0 ml-1">{th ? 'จัดการ' : 'Action'}</span>
                )}
              </div>

              {pendingList.slice(0, 5).map((m, idx) => {
                const resolvedM = resolveMemberProfile(m);
                const isSelf = currentUser && ((m.userId && m.userId === currentUser.id) || (m.name && currentUser.inGameName && m.name.toLowerCase() === currentUser.inGameName.toLowerCase()));
                return (
                  <div
                    key={m.id || idx}
                    draggable={isAdminOrOwner}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDraggedMemberId(m.id);
                    }}
                    onDragEnd={(e) => {
                      e.stopPropagation();
                      setDraggedMemberId(null);
                    }}
                    onDragOver={(e) => {
                      if (isAdminOrOwner) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropMemberOnTarget(item, m.id);
                    }}
                    className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs border transition-all ${
                      draggedMemberId === m.id ? 'opacity-40 border-cyan-400 dashed' : ''
                    } ${
                      isSelf
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    } ${isAdminOrOwner ? 'hover:border-slate-600 cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                      {isAdminOrOwner && (
                        <GripVertical className="w-3 h-3 text-slate-500 shrink-0" />
                      )}
                      <span className={`w-4 h-4 rounded-full text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${
                        idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span
                        className={`font-semibold truncate min-w-0 flex-1 ${isSelf ? 'text-amber-200' : 'text-slate-200'}`}
                        title={resolvedM.name}
                      >
                        {resolvedM.name}
                      </span>
                      <span
                        className="w-[64px] sm:w-[72px] text-right font-mono text-[10px] text-sky-400 tabular-nums shrink-0"
                        title={resolvedM.powerLevel ? (th ? `⚡ ค่าพลัง: ${resolvedM.powerLevel.toLocaleString()}` : `⚡ Power: ${resolvedM.powerLevel.toLocaleString()}`) : (th ? 'ไม่ระบุค่าพลัง' : 'No power level')}
                      >
                        {resolvedM.powerLevel ? `⚡${resolvedM.powerLevel.toLocaleString()}` : <span className="text-slate-600">-</span>}
                      </span>
                      {item.isCraftGoal || item.maxRequestQuantity === 0 || m.requestedQuantity === 0 ? (
                        <span
                          className={`w-auto px-1.5 text-center text-[9px] py-0.5 rounded font-mono font-bold shrink-0 border whitespace-nowrap ${
                            (m.receivedQuantity || 0) > 0
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                              : 'bg-slate-800 text-purple-300 border-purple-500/30'
                          }`}
                          title={th ? `แจกจนกว่าจะสำเร็จ (รับแล้ว ${m.receivedQuantity || 0} ชิ้น)` : `Until successful (${m.receivedQuantity || 0} pcs received)`}
                        >
                          {(m.receivedQuantity || 0) > 0
                            ? `🔨${m.receivedQuantity} • ${th ? 'จนสำเร็จ' : 'Until'}`
                            : (th ? 'จนสำเร็จ' : 'Until')}
                        </span>
                      ) : (
                        <span
                          className={`w-9 sm:w-10 text-center text-[9.5px] py-0.5 rounded font-mono font-bold shrink-0 border ${
                            (m.receivedQuantity || 0) >= (m.requestedQuantity || 1)
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : (m.receivedQuantity || 0) > 0
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                          title={th ? `ได้รับแล้ว ${m.receivedQuantity || 0} จาก ${m.requestedQuantity || 1} ชิ้น` : `Received ${m.receivedQuantity || 0} of ${m.requestedQuantity || 1}`}
                        >
                          {`${m.receivedQuantity || 0}/${m.requestedQuantity || 1}`}
                        </span>
                      )}
                    </div>

                    {/* Member Controls: Edit Quantity, Delete, & Reorder */}
                    {isAdminOrOwner && (
                      <div className="flex items-center gap-0.5 shrink-0 ml-1 w-[76px] justify-center">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQueueMember({
                              item,
                              member: m,
                              requestedQuantity: typeof m.requestedQuantity === 'number' ? m.requestedQuantity : 1,
                              receivedQuantity: m.receivedQuantity || 0
                            })
                          }
                          className="p-1 rounded hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                          title={th ? 'แก้ไขจำนวนคิวของสมาชิกนี้' : 'Edit member queue quantity'}
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(th ? `ต้องการลบ ${m.name} ออกจากคิวหรือไม่?` : `Remove ${m.name} from queue?`)) {
                              handleRemoveMemberFromQueue(item, m.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-red-950/60 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          title={th ? 'ลบสมาชิกออกจากคิว' : 'Remove member from queue'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveMemberInQueue(item, m.id, 'up')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title={th ? 'เลื่อนขึ้น' : 'Move up'}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === pendingList.length - 1}
                          onClick={() => handleMoveMemberInQueue(item, m.id, 'down')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title={th ? 'เลื่อนลง' : 'Move down'}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {pendingList.length > 5 && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setViewingRequestersItem(item);
                  }}
                  className="w-full py-1 text-center text-[10px] text-sky-400 hover:text-sky-300 font-semibold bg-sky-950/30 hover:bg-sky-950/50 border border-sky-800/40 rounded-md transition-colors cursor-pointer"
                >
                  {th ? `ดูเพิ่มเติม +${pendingList.length - 5} คน` : `View more +${pendingList.length - 5}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Table Row for Table View
  const renderItemRow = (item: GeneralItem, itemIdx: number, totalInList?: number, listScope?: GeneralItem[]) => {
    const pendingList = (item.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received');
    const userIndex = currentUser
      ? pendingList.findIndex(
          (m) =>
            (m.userId && m.userId === currentUser.id) ||
            (m.name && currentUser.inGameName && m.name.trim().toLowerCase() === currentUser.inGameName.trim().toLowerCase())
        )
      : -1;
    const isUserInQueue = userIndex !== -1;
    const meetsPowerReq = !currentUser || currentUser.powerLevel >= (item.minPowerLevel || 0);
    const countInList = totalInList ?? sortedItems.length;

    return (
      <tr
        key={item.id}
        draggable={isAdminOrOwner}
        onDragStart={(e) => {
          if (draggedMemberId) return;
          setDraggedItemId(item.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', item.id);
        }}
        onDragEnd={() => {
          setDraggedItemId(null);
          setDragOverItemId(null);
        }}
        onDragOver={(e) => {
          if (isAdminOrOwner && draggedItemId && draggedItemId !== item.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverItemId !== item.id) {
              setDragOverItemId(item.id);
            }
          }
        }}
        onDragLeave={(e) => {
          if (dragOverItemId === item.id && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverItemId(null);
          }
        }}
        onDrop={(e) => {
          if (isAdminOrOwner && draggedItemId && draggedItemId !== item.id) {
            e.preventDefault();
            e.stopPropagation();
            handleDropItemOnTarget(draggedItemId, item.id);
          }
        }}
        className={`hover:bg-slate-900/40 transition-colors ${
          isAdminOrOwner ? 'cursor-grab active:cursor-grabbing' : ''
        } ${
          draggedItemId === item.id
            ? 'opacity-40 bg-cyan-950/30'
            : dragOverItemId === item.id
            ? 'bg-amber-500/20 ring-1 ring-amber-400'
            : item.isPinned
            ? 'bg-amber-950/10'
            : ''
        }`}
      >
        {/* Item Info */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  if (onViewImageZoom) onViewImageZoom(item.imageUrl, item.name);
                }}
                className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0 hover:border-[#d4af37]"
              >
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <PackageCheck className="w-5 h-5 text-slate-500" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.isPinned && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-0.5">
                    <Pin className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    <span>{th ? 'ปักหมุด' : 'Pinned'}</span>
                  </span>
                )}
                <span className={`font-bold block text-sm ${getRarityTextGlow(item.rarity || 'RARE')}`}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                <span>{(item.receiptHistory || []).length} {th ? 'บิลส่งมอบ' : 'receipts'}</span>
                {item.allowMemberQueue === false && (
                  <span className="text-amber-400/80">🔒 {th ? 'แอดมินแจก' : 'Admin Pick'}</span>
                )}
              </div>
            </div>

            {/* Admin Pin & Reorder in Table */}
            {isAdminOrOwner && (
              <div className="flex items-center gap-0.5 ml-auto">
                <div
                  className="p-1 rounded text-slate-500 hover:text-amber-400 cursor-grab active:cursor-grabbing transition-colors"
                  title={th ? 'ลากเพื่อปรับตำแหน่ง' : 'Drag to reorder'}
                >
                  <GripVertical className="w-3 h-3" />
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePin(item)}
                  className={`p-1 rounded border transition-all cursor-pointer ${
                    item.isPinned
                      ? 'bg-amber-500/25 border-amber-500/70 text-amber-300'
                      : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-amber-300'
                  }`}
                  title={item.isPinned ? (th ? 'ยกเลิกการปักหมุด' : 'Unpin') : (th ? 'ปักหมุดไอเทมนี้' : 'Pin to top')}
                >
                  <Pin className={`w-3 h-3 ${item.isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
                <button
                  type="button"
                  disabled={itemIdx === 0}
                  onClick={() => handleMoveItemOrder(item, 'up', listScope)}
                  className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                  title={th ? 'เลื่อนขึ้น' : 'Move up'}
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={itemIdx === countInList - 1}
                  onClick={() => handleMoveItemOrder(item, 'down', listScope)}
                  className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                  title={th ? 'เลื่อนลง' : 'Move down'}
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </td>

        {/* Rarity Badge */}
        <td className="py-3 px-3">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase inline-block ${getRarityBadge(item.rarity || 'RARE')}`}>
            {item.rarity || 'RARE'}
          </span>
        </td>

        {/* Diamond Price Badge */}
        <td className="py-3 px-3">
          <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs inline-block">
            {item.price ? `${item.price.toLocaleString()} 💎` : (th ? 'แจกฟรี' : 'Free')}
          </span>
        </td>

        {/* Max Request Quantity Badge */}
        <td className="py-3 px-3">
          {item.isCraftGoal || item.maxRequestQuantity === 0 ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs inline-block" title={th ? 'แจกจนกว่าจะคราฟสำเร็จ' : 'Distribute until craft succeeds'}>
              {th ? '🎯 จนกว่าจะคราฟสำเร็จ' : '🎯 Until crafted'}
            </span>
          ) : (item.maxRequestQuantity || 1) > 1 ? (
            <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono font-bold text-xs inline-block">
              {th ? `สูงสุด ${item.maxRequestQuantity} ชิ้น/คน` : `Max ${item.maxRequestQuantity} pcs/p`}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 font-mono text-xs inline-block">
              1 {th ? 'ชิ้น' : 'pc'}
            </span>
          )}
        </td>

        {/* Min Power Badge */}
        <td className="py-3 px-3">
          <span className={`px-2 py-0.5 rounded border font-mono font-bold text-xs inline-block ${
            item.minPowerLevel > 0
              ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
              : 'bg-slate-800/40 border-slate-800 text-slate-400'
          }`}>
            {item.minPowerLevel > 0 ? `⚡ ${item.minPowerLevel.toLocaleString()}+ PL` : (th ? 'ไม่จำกัด' : 'None')}
          </span>
        </td>

        {/* Requesters Count & Click to View List */}
        <td className="py-3 px-4">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setViewingRequestersItem(item);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-400 text-blue-200 transition-all cursor-pointer font-semibold text-xs shadow-sm group"
            title={th ? 'คลิกเพื่อดูรายชื่อคนขอรับทั้งหมด' : 'Click to view all requesters'}
          >
            <Users className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="font-mono font-bold">{pendingList.length} {th ? 'คนรอคิว' : 'waiting'}</span>
            <span className="text-[10px] text-sky-400 underline ml-1">{th ? 'ดูรายชื่อ' : 'View'}</span>
          </button>
        </td>

        {/* Actions / Request Button */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {/* Admin/Owner Prominent Distribute Item Button */}
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => openDeliverModal(item)}
                className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1 shrink-0"
                title={th ? 'แจกไอเทม' : 'Distribute item'}
              >
                <Gift className="w-3 h-3 text-amber-300" />
                <span>{th ? 'แจกไอเทม' : 'Distribute'}</span>
              </button>
            )}

            {item.allowMemberQueue !== false || isUserInQueue ? (
              <button
                type="button"
                disabled={!currentUser || busyItemId === item.id || (!meetsPowerReq && !isUserInQueue)}
                onClick={() => handleInitiateRequest(item)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
                  isUserInQueue
                    ? 'bg-amber-950/80 hover:bg-red-950 border border-amber-500/60 hover:border-red-600 text-amber-200 hover:text-red-200'
                    : meetsPowerReq
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:brightness-110 text-slate-950 font-black shadow-amber-500/20 active:scale-95'
                    : 'bg-slate-800 text-slate-400'
                }`}
                title={isUserInQueue ? (th ? 'คลิกเพื่อยกเลิกคิว' : 'Click to cancel queue') : undefined}
              >
                {busyItemId === item.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isUserInQueue ? (
                  <>
                    <X className="w-3 h-3 text-red-400" />
                    <span>{th ? `คิว ${userIndex !== -1 ? userIndex + 1 : 1} • ยกเลิก` : `#${userIndex !== -1 ? userIndex + 1 : 1} • Cancel`}</span>
                  </>
                ) : meetsPowerReq ? (
                  <>
                    <Sparkles className="w-3 h-3 text-slate-950" />
                    <span>{th ? 'ขอรับไอเทม' : 'Request'}</span>
                  </>
                ) : (
                  <span>{th ? 'พลังไม่ถึง' : 'Low PL'}</span>
                )}
              </button>
            ) : (
              <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[10.5px] font-semibold flex items-center gap-1 shrink-0">
                🔒 {th ? 'แอดมินแจก' : 'Admin Pick'}
              </span>
            )}

            {isAdminOrOwner && (
              <>
                <button
                  type="button"
                  onClick={() => openEditForm(item)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                  title={th ? 'แก้ไข' : 'Edit'}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setItemToDelete(item)}
                  className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-800 text-red-300 cursor-pointer"
                  title={th ? 'ลบ' : 'Delete'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Render Table View Container
  const renderTableView = (itemList: GeneralItem[]) => {
    if (itemList.length === 0) return null;
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0e1422] border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{th ? 'ไอเทม' : 'Item'}</th>
                <th className="py-3 px-3">{th ? 'ระดับ' : 'Rarity'}</th>
                <th className="py-3 px-3">{th ? 'ราคาเพชรที่ต้องจ่าย' : 'Price to Pay'}</th>
                <th className="py-3 px-3">{th ? 'ขอรับสูงสุด/คน' : 'Max / Member'}</th>
                <th className="py-3 px-3">{th ? 'พลังขั้นต่ำ' : 'Min PL'}</th>
                <th className="py-3 px-4">{th ? 'คนขอรับ' : 'Requesters'}</th>
                <th className="py-3 px-4">{th ? 'ขอรับ / จัดการ' : 'Request / Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {itemList.map((item, idx) => renderItemRow(item, idx, itemList.length, itemList))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* SECTION HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 text-cyan-300 shadow-md">
              <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-[#e0f2fe] via-[#7dd3fc] to-[#38bdf8]">
              {th ? 'Item Queue' : 'Item Queue'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {items.length} {th ? 'รายการไอเทม' : 'items'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-semibold">
              {pendingTotal} {th ? 'คนกำลังรอรับคิว' : 'players in queue'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {th ? 'แจกจ่ายตามลำดับคิว • เพชรไม่คิดเข้ากองกลาง' : 'Queued distribution • No clan diamond vault impact'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Switcher: 2 Items / Row vs Full Table */}
          <div className="flex items-center p-1 rounded-xl bg-[#090d16] border border-slate-800 shadow-inner">
            <button
              type="button"
              id="btn-general-queue-view-grid"
              onClick={() => {
                sounds.playClick();
                setViewMode('grid');
                try { localStorage.setItem('l2m_general_queue_view_mode_v2', 'grid'); } catch {}
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={th ? 'แสดงแบบการ์ด' : 'Grid View'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{th ? 'แสดงแบบการ์ด' : 'Card View'}</span>
            </button>
            <button
              type="button"
              id="btn-general-queue-view-table"
              onClick={() => {
                sounds.playClick();
                setViewMode('table');
                try { localStorage.setItem('l2m_general_queue_view_mode_v2', 'table'); } catch {}
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={th ? 'แสดงแบบตาราง' : 'Table View'}
            >
              <List className="w-3.5 h-3.5" />
              <span>{th ? 'ตารางเต็ม' : 'Table'}</span>
            </button>
          </div>

          {/* Add Item Button */}
          {isAdminOrOwner && (
            <button
              id="btn-open-add-general-item"
              type="button"
              onClick={showAddForm ? closeForm : openAddForm}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddForm ? (th ? 'ปิดฟอร์ม' : 'Close Form') : (th ? 'เพิ่มไอเทมลงคิว' : 'Add Item to Queue')}</span>
            </button>
          )}
        </div>
      </div>


      {/* BEAUTIFUL & SIMPLE ADD / EDIT ITEM POPUP MODAL */}
      {showAddForm && isAdminOrOwner && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && closeForm()}
        >
          <form
            onSubmit={handleSaveItem}
            className="w-full max-w-lg rounded-2xl bg-[#0e1422] border border-[#d4af37]/40 p-4 sm:p-5 shadow-2xl space-y-4 my-auto overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold font-cinzel text-[#f5d77f] flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#f5d77f]" />
                <span>{editingId ? (th ? 'แก้ไขรายการไอเทม' : 'Edit Item') : (th ? 'เพิ่มไอเทมลงคิว' : 'Add Item to Queue')}</span>
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1-Click Quick Item Preset Selector */}
            {quickItems.length > 0 && !editingId && (
              <div className="p-2.5 rounded-xl bg-[#090e1a] border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#f5d77f]" />
                    <span>{th ? 'เลือกด่วนจากควิกไอเทม:' : 'Select from Quick Item preset:'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {quickItems.map((qi) => (
                    <button
                      key={qi.id}
                      type="button"
                      onClick={() => handleApplyQuickItem(qi)}
                      className={`text-xs px-2 py-1 rounded-lg bg-[#111827] hover:bg-[#1e293b] border text-slate-200 hover:text-white flex items-center gap-1.5 shrink-0 transition-all shadow-sm cursor-pointer ${
                        draft.name === qi.name ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-slate-700/80 hover:border-[#d4af37]/60'
                      }`}
                    >
                      {qi.imageUrl ? (
                        <img src={qi.imageUrl} alt={qi.name} className="w-5 h-5 rounded object-cover border border-slate-600 shrink-0" />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 bg-slate-800">
                          <Sparkles className="h-3 w-3 text-[#f5d77f]" />
                        </span>
                      )}
                      <span className="font-semibold text-xs">{qi.name}</span>
                      <span className="text-[8.5px] px-1 py-0.2 rounded font-mono bg-slate-800 text-amber-300 border border-slate-700">
                        {qi.rarity}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* Compact Form Layout */}
            <div className="space-y-3.5">
              {/* Image & Name row */}
              <div className="flex items-center gap-3">
                {/* Image upload thumbnail / paste */}
                <div
                  tabIndex={0}
                  onPaste={handlePasteImage}
                  className="relative w-16 h-16 rounded-xl border-2 border-dashed border-slate-700 hover:border-[#d4af37]/70 bg-[#090d16] flex flex-col items-center justify-center text-center transition-all group outline-none cursor-pointer shrink-0 overflow-hidden"
                  title={th ? 'คลิกเลือกรูปภาพ หรือกด Ctrl + V เพื่อวาง' : 'Click to upload or press Ctrl + V'}
                >
                  {imagePreview ? (
                    <div className="relative w-full h-full">
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagePreview('');
                          setImageFile(null);
                          setDraft((prev) => ({ ...prev, imageUrl: '' }));
                        }}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-900/80 hover:bg-red-700 text-white text-[10px]"
                        title={th ? 'ลบรูป' : 'Remove image'}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="file-general-item-image" className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-slate-400 group-hover:text-[#f5d77f]">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[8.5px] mt-0.5">{th ? 'เลือกรูป' : 'Image'}</span>
                      <input
                        id="file-general-item-image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          handleImageFile(e.target.files?.[0]);
                          e.currentTarget.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {th ? 'ชื่อไอเทม' : 'Item Name'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={th ? 'เช่น Scroll of Blessing, Potion...' : "e.g. Scroll of Blessing, Potion..."}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs font-semibold focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Rarity & Price */}
              <div className="grid grid-cols-2 gap-3">
                {/* Rarity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {th ? 'ระดับความหายาก' : 'Rarity'}
                  </label>
                  <select
                    value={draft.rarity}
                    onChange={(e) => setDraft({ ...draft, rarity: e.target.value as ItemRarity })}
                    className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="RARE">🟦 RARE</option>
                    <option value="EPIC">🟥 EPIC</option>
                    <option value="LAGEND">🟪 LEGEND</option>
                    <option value="MYTHIC">🟨 MYTHIC</option>
                  </select>
                </div>

                {/* Price (Diamonds) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'ราคาเพชรที่ต้องจ่าย' : 'Price to Pay'}</span>
                    <span className="text-[10px] text-amber-400 font-mono">0 = {th ? 'ฟรี' : 'Free'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={draft.price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-amber-300 text-xs font-mono font-bold focus:outline-none"
                    />
                    <Coins className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Min Power Level & Max Request Quantity (Notice: "จำนวนที่จะได้รับ" removed per request!) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'พลังขั้นต่ำในการรับ' : 'Minimum Power'}</span>
                    <span className="text-[10px] text-sky-400 font-mono">0 = {th ? 'ไม่จำกัด' : 'None'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={draft.minPowerLevel}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDraft({ ...draft, minPowerLevel: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-sky-300 text-xs font-mono font-bold focus:outline-none"
                    />
                    <Zap className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'ขอรับสูงสุดต่อคน' : 'Max / Member'}</span>
                    <span className="text-[10px] text-purple-400 font-mono">
                      {draft.maxRequestQuantity === 0 ? (th ? 'ไม่จำกัด (คราฟ)' : 'Unlimited (Craft)') : (th ? 'ชิ้น' : 'pcs')}
                    </span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder={th ? 'ใส่ 0 = ไม่จำกัด/คราฟ' : '0 = Unlimited/Craft'}
                    value={draft.maxRequestQuantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDraft({ ...draft, maxRequestQuantity: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-purple-300 text-xs font-mono font-bold focus:outline-none"
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-slate-400">
                      {draft.maxRequestQuantity === 0
                        ? (th ? '🎯 ไม่จำกัด (แจกจนกว่าจะคราฟสำเร็จ)' : '🎯 Unlimited: until craft succeeds')
                        : (th ? '0 = แจกจนกว่าจะคราฟสำเร็จ' : '0 = Until craft succeeds')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, maxRequestQuantity: draft.maxRequestQuantity === 0 ? 1 : 0 })}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                    >
                      {draft.maxRequestQuantity === 0 ? (th ? 'กำหนดจำนวน' : 'Set limit') : (th ? 'ไม่จำกัด (คราฟ)' : 'Unlimited (Craft)')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Craft Goal Mode (Until successful) */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 cursor-pointer hover:border-purple-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={draft.isCraftGoal || draft.maxRequestQuantity === 0}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDraft({
                      ...draft,
                      isCraftGoal: checked,
                      maxRequestQuantity: checked ? 0 : (draft.maxRequestQuantity === 0 ? 1 : draft.maxRequestQuantity)
                    });
                  }}
                  className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-purple-600 focus:ring-purple-400 cursor-pointer"
                />
                <div className="min-w-0 text-xs">
                  <span className="font-bold text-slate-200 block flex items-center gap-1.5">
                    <span>{th ? '🎯 ไอเทมแจกจนกว่าจะคราฟสำเร็จ (Until successful)' : '🎯 Distribute until craft succeeds (Until successful)'}</span>
                    {(draft.isCraftGoal || draft.maxRequestQuantity === 0) && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/25 text-purple-300 font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                  </span>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    {th
                      ? 'สำหรับไอเทมที่ต้องแจกเรื่อยๆ จนกว่าจะคราฟติด ในรายชื่อจะแสดง "Until successful" แทน 0/X'
                      : 'Distribute repeatedly until crafting succeeds. Queue list will display "Until successful" instead of 0/X.'}
                  </span>
                </div>
              </label>

              {/* Receipt / Hunters Policy Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'นโยบายการแนบหลักฐาน / ส่งบิลผู้ล่า' : 'Hunters Proof & Billing Policy'}
                </label>
                <select
                  value={draft.receiptPolicy}
                  onChange={(e) => setDraft({ ...draft, receiptPolicy: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-[#d4af37] text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="per_delivery">
                    {th ? '📸 แนบหลักฐานผู้ล่าทุกครั้งที่แจก (Billed per delivery)' : '📸 Hunters proof required for each delivery'}
                  </option>
                  <option value="on_complete">
                    {th ? '⏳ แนบหลักฐานผู้ล่าเมื่อแจกครบโควต้า (Billed on complete)' : '⏳ Hunters proof required when quota completed'}
                  </option>
                  <option value="optional">
                    {th ? '✨ ไม่บังคับแนบ / แจกฟรีกดรับได้เลย (Optional / Free)' : '✨ Optional proof / Free distribution'}
                  </option>
                </select>
              </div>

              {/* Queue Permission & Pin Options */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={draft.allowMemberQueue}
                    onChange={(e) => setDraft({ ...draft, allowMemberQueue: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 border-slate-700 bg-slate-950 cursor-pointer"
                  />
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-slate-200 block text-[11px]">
                      {th ? 'เปิดให้สมาชิกกดรับเอง' : 'Allow request'}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block truncate">
                      {draft.allowMemberQueue ? (th ? 'สมาชิกกดขอรับได้' : 'Open for members') : (th ? 'แอดมินเลือกเอง' : 'Admin pick only')}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={draft.isPinned}
                    onChange={(e) => setDraft({ ...draft, isPinned: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 border-slate-700 bg-slate-950 cursor-pointer"
                  />
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-amber-300 block text-[11px] flex items-center gap-1">
                      <Pin className="w-3 h-3" />
                      <span>{th ? 'ปักหมุดไว้บนสุด' : 'Pin to top'}</span>
                    </span>
                    <span className="text-[9.5px] text-slate-400 block truncate">
                      {th ? 'แสดงรายการแรก' : 'Show first'}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !draft.name.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa841c] hover:brightness-110 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                <span>{isSubmitting ? (th ? 'กำลังบันทึก...' : 'Saving...') : (editingId ? (th ? 'บันทึกการแก้ไข' : 'Save Changes') : (th ? 'เพิ่มไอเทมลงคิว' : 'Add Item to Queue'))}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ITEMS DISPLAY: 4 ITEMS PER ROW (GRID) OR FULL TABLE VIEW */}
      {items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0c121e] border border-slate-800 text-center text-xs text-slate-500 space-y-2">
          <PackageCheck className="w-10 h-10 mx-auto text-slate-600 opacity-40" />
          <p>{th ? 'ยังไม่มีรายการไอเทมในคิวขณะนี้' : 'No items in the queue yet'}</p>
          {isAdminOrOwner && (
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-[#f5d77f] text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{th ? 'เพิ่มไอเทมแรก' : 'Add First Item'}</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
          {sortedItems.map((item, idx) => renderItemCard(item, idx, sortedItems.length, sortedItems))}
        </div>
      ) : (
        renderTableView(sortedItems)
      )}

      {/* ITEM REQUESTERS QUEUE MODAL ("กดดูรายชื่อได้") */}
      {activeRequestersItem && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && setViewingRequestersItem(null)}
        >
          <div className="w-full max-w-xl rounded-2xl border border-[#d4af37]/50 bg-[#0b101b] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1524]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-cinzel text-white flex items-center gap-2 flex-wrap">
                    <span>{th ? 'รายชื่อผู้ขอรับไอเทม' : 'Item Requesters List'}</span>
                    <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border uppercase ${getRarityBadge(activeRequestersItem.rarity || 'RARE')}`}>
                      {activeRequestersItem.rarity || 'RARE'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-bold text-amber-200">
                    {activeRequestersItem.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setViewingRequestersItem(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                title={th ? 'ปิด' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges Summary Bar inside Modal */}
            <div className="px-5 py-3 bg-[#080c14] border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                {activeRequestersItem.imageUrl && (
                  <img
                    src={activeRequestersItem.imageUrl}
                    alt={activeRequestersItem.name}
                    className="w-8 h-8 rounded-lg object-cover border border-slate-700"
                  />
                )}
                {/* Price */}
                <span className="px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{th ? 'ราคาเพชรที่ต้องจ่าย:' : 'Price to Pay:'} {activeRequestersItem.price ? `${activeRequestersItem.price.toLocaleString()} 💎` : (th ? 'แจกฟรี' : 'Free')}</span>
                </span>
                {/* Quantity */}
                <span className="px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                  <Layers3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{th ? 'จำนวนที่จะได้รับ:' : 'Qty to Receive:'} x{activeRequestersItem.quantity}</span>
                </span>
                {/* Min Power */}
                <span className={`px-2 py-1 rounded-md border font-bold flex items-center gap-1 ${
                  activeRequestersItem.minPowerLevel > 0
                    ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                }`}>
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  <span>{th ? 'พลังขั้นต่ำ:' : 'Min PL:'} {activeRequestersItem.minPowerLevel > 0 ? `${activeRequestersItem.minPowerLevel.toLocaleString()}+` : (th ? 'ไม่จำกัด' : 'None')}</span>
                </span>
              </div>

              <div className="text-[11px] font-bold text-sky-300 font-mono">
                {th ? 'จำนวนในคิว:' : 'In Queue:'} {(activeRequestersItem.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received').length} {th ? 'คน' : 'players'}
              </div>
            </div>

            {/* Member List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-[#090d16]">
              {(() => {
                const pendingMembers = (activeRequestersItem.queueList || []).filter((m) => m.status === 'pending' || m.status === 'partially_received');
                const deliveredMembers = (activeRequestersItem.queueList || []).filter((m) => m.status === 'received');

                if (pendingMembers.length === 0 && deliveredMembers.length === 0) {
                  return (
                    <div className="py-12 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/60 mx-auto flex items-center justify-center text-slate-500">
                        <Users className="w-6 h-6 opacity-40" />
                      </div>
                      <p className="text-sm font-semibold text-slate-300">
                        {th ? 'ยังไม่มีสมาชิกขอรับไอเทมนี้' : 'No requesters in queue yet'}
                      </p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        {th
                          ? 'เมื่อสมาชิกกดปุ่ม "ขอรับไอเทม" รายชื่อจะแสดงที่นี่'
                          : 'When members click "Request", their names will appear here.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {pendingMembers.map((member, index) => {
                      const resolvedMember = resolveMemberProfile(member);
                      const isCurrentUserMember = currentUser && ((member.userId && member.userId === currentUser.id) || (member.name && currentUser.inGameName && member.name.toLowerCase() === currentUser.inGameName.toLowerCase()));

                      return (
                        <div
                          key={member.id}
                          draggable={isAdminOrOwner}
                          onDragStart={() => setDraggedMemberId(member.id)}
                          onDragOver={(e) => {
                            if (isAdminOrOwner) e.preventDefault();
                          }}
                          onDrop={() => handleDropMemberOnTarget(activeRequestersItem, member.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all shadow-sm ${
                            draggedMemberId === member.id ? 'opacity-40 border-cyan-400 dashed' : ''
                          } ${
                            isCurrentUserMember
                              ? 'bg-amber-950/25 border-[#d4af37]/60 ring-1 ring-amber-500/20'
                              : 'bg-[#0e1422] border-slate-800 hover:border-slate-700'
                          } ${isAdminOrOwner ? 'cursor-grab active:cursor-grabbing hover:border-slate-600' : ''}`}
                        >
                          {/* Rank & Profile */}
                          <div className="flex items-center gap-3 min-w-0">
                            {isAdminOrOwner && (
                              <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-black shrink-0 shadow-md ${
                                index === 0
                                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 ring-2 ring-yellow-400/40'
                                  : index === 1
                                  ? 'bg-slate-200 text-slate-950 ring-2 ring-slate-300/40'
                                  : index === 2
                                  ? 'bg-amber-700 text-white ring-2 ring-amber-600/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-bold text-xs sm:text-sm ${isCurrentUserMember ? 'text-amber-300' : 'text-slate-100'}`}>
                                  {resolvedMember.name}
                                </span>
                                {resolvedMember.clan && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                                    🛡️ {cleanClanName(resolvedMember.clan)}
                                  </span>
                                )}
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                                  ⏳ {th ? 'รอส่งมอบ' : 'Waiting'}
                                </span>
                                {activeRequestersItem.isCraftGoal || activeRequestersItem.maxRequestQuantity === 0 || member.requestedQuantity === 0 ? (
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                                      (member.receivedQuantity || 0) > 0
                                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                                        : 'bg-slate-800 text-purple-300 border-purple-500/30'
                                    }`}
                                    title={th ? `เป้าหมายคราฟ: ได้รับแล้ว ${member.receivedQuantity || 0} ชิ้น (แจกจนกว่าจะสำเร็จ)` : `Craft Goal: ${member.receivedQuantity || 0} pcs received (until success)`}
                                  >
                                    {(member.receivedQuantity || 0) > 0
                                      ? `🔨 ${member.receivedQuantity} • Until successful`
                                      : 'Until successful'}
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                                      (member.receivedQuantity || 0) >= (member.requestedQuantity || 1)
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                        : (member.receivedQuantity || 0) > 0
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                        : 'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}
                                    title={th ? `ได้รับแล้ว ${member.receivedQuantity || 0} จาก ${member.requestedQuantity || 1} ชิ้น` : `Received ${member.receivedQuantity || 0} of ${member.requestedQuantity || 1}`}
                                  >
                                    {`${member.receivedQuantity || 0}/${member.requestedQuantity || 1}`}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1 flex-wrap">
                                {member.powerLevel ? (
                                  <span className="text-sky-400 font-bold">
                                    ⚡ {member.powerLevel.toLocaleString()} PL
                                  </span>
                                ) : null}
                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {member.joinedAt
                                      ? new Date(member.joinedAt).toLocaleString(th ? 'th-TH' : 'en-US', {
                                          day: 'numeric',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })
                                      : (th ? 'เมื่อสักครู่' : 'Recently')}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons in Modal */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Admin Reorder Controls */}
                            {isAdminOrOwner && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMoveMemberInQueue(activeRequestersItem, member.id, 'up')}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer"
                                  title={th ? 'เลื่อนขึ้น' : 'Move up'}
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === pendingMembers.length - 1}
                                  onClick={() => handleMoveMemberInQueue(activeRequestersItem, member.id, 'down')}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer"
                                  title={th ? 'เลื่อนลง' : 'Move down'}
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {isAdminOrOwner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingQueueMember({
                                      item: activeRequestersItem,
                                      member,
                                      requestedQuantity: typeof member.requestedQuantity === 'number' ? member.requestedQuantity : 1,
                                      receivedQuantity: member.receivedQuantity || 0
                                    })
                                  }
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition-all cursor-pointer"
                                  title={th ? 'แก้ไขจำนวนคิว' : 'Edit queue quantity'}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingRequestersItem(null);
                                    openDeliverModal(activeRequestersItem, member);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                                  title={th ? 'แจกไอเทมให้สมาชิกคนนี้' : 'Distribute item to this member'}
                                >
                                  <Gift className="w-3.5 h-3.5 text-amber-300" />
                                  <span>{th ? 'แจกไอเทม' : 'Distribute'}</span>
                                </button>
                              </>
                            )}

                            {(isAdminOrOwner || isCurrentUserMember) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberFromQueue(activeRequestersItem, member.id)}
                                className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 hover:text-white transition-all cursor-pointer"
                                title={th ? 'นำออกจากคิว' : 'Remove from queue'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Delivered members if any */}
                    {deliveredMembers.length > 0 && (
                      <div className="pt-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{th ? 'สมาชิกที่ได้รับไอเทมแล้ว' : 'Delivered Requesters'} ({deliveredMembers.length})</span>
                        </div>
                        <div className="space-y-1.5 opacity-75">
                          {deliveredMembers.map((m) => {
                            const resolvedM = resolveMemberProfile(m);
                            return (
                              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0a0d16] border border-slate-800 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-300">{resolvedM.name}</span>
                                  {resolvedM.clan && <span className="text-[10px] text-slate-500">({cleanClanName(resolvedM.clan)})</span>}
                                </div>
                                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                                  ✓ {th ? 'ส่งมอบเรียบร้อย' : 'Delivered'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0e1524] border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400 font-prompt">
                {th ? 'ลำดับคิวพิจารณาตามเวลาที่ลงชื่อ' : 'Queue priority by request time'}
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setViewingRequestersItem(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                {th ? 'ปิดหน้าต่าง' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT QUEUE MEMBER MODAL (Owner/Admin) */}
      {editingQueueMember && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && setEditingQueueMember(null)}
        >
          <form
            onSubmit={handleSaveEditedQueueMember}
            className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-[#0b101b] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1524]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm sm:text-base font-bold font-cinzel text-white">
                  {th ? 'แก้ไขจำนวนคิวของสมาชิก' : 'Edit Member Queue'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingQueueMember(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Member and Item summary */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{th ? 'สมาชิก:' : 'Member:'}</span>
                  <span className="font-bold text-white">{editingQueueMember.member.name} ({cleanClanName(editingQueueMember.member.clan)})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{th ? 'ไอเทม:' : 'Item:'}</span>
                  <span className="font-bold text-amber-300">{editingQueueMember.item.name}</span>
                </div>
              </div>

              {/* Requested Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>{th ? 'จำนวนที่ขอรับ (เป้าหมาย)' : 'Requested Quantity'}</span>
                  <span className="text-[10px] text-purple-400 font-mono">
                    {editingQueueMember.requestedQuantity === 0 ? (th ? 'ไม่จำกัด (คราฟ)' : 'Unlimited (Craft)') : (th ? 'ชิ้น' : 'pcs')}
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder={th ? 'ใส่ 0 = จนกว่าจะคราฟสำเร็จ' : '0 = Until craft succeeds'}
                  value={editingQueueMember.requestedQuantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setEditingQueueMember({
                      ...editingQueueMember,
                      requestedQuantity: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0)
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-amber-400 text-white font-mono font-bold text-xs focus:outline-none"
                />
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-400">
                    {editingQueueMember.requestedQuantity === 0
                      ? (th ? '🎯 ไม่จำกัดจำนวน (แจกจนกว่าจะคราฟสำเร็จ)' : '🎯 Unlimited: until craft succeeds')
                      : (th ? 'ใส่ 0 = จนกว่าจะคราฟสำเร็จ' : '0 = Until craft succeeds')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingQueueMember({
                        ...editingQueueMember,
                        requestedQuantity: editingQueueMember.requestedQuantity === 0 ? 1 : 0
                      })
                    }
                    className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                  >
                    {editingQueueMember.requestedQuantity === 0 ? (th ? 'กำหนดจำนวน' : 'Set limit') : (th ? 'ไม่จำกัด (คราฟ)' : 'Unlimited (Craft)')}
                  </button>
                </div>
              </div>

              {/* Received Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>{th ? 'จำนวนที่ได้รับแล้ว' : 'Received Quantity'}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{th ? 'ชิ้น' : 'pcs'}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={editingQueueMember.receivedQuantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setEditingQueueMember({
                      ...editingQueueMember,
                      receivedQuantity: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0)
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-amber-400 text-white font-mono font-bold text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3.5 bg-[#0e1524]">
              <button
                type="button"
                onClick={() => setEditingQueueMember(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:brightness-110 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
              >
                {th ? 'บันทึกการแก้ไข' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELIVER ITEM MODAL (Replaces window.prompt) */}
      {deliveryModalData && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
          onMouseDown={(e) => e.target === e.currentTarget && setDeliveryModalData(null)}
        >
          <form
            onSubmit={handleConfirmDelivery}
            className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-[#0b101b] shadow-2xl overflow-hidden my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1524]">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold font-cinzel text-white">
                  {th ? 'แจกไอเทม' : 'Distribute Item'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Item Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  {deliveryModalData.item.imageUrl ? (
                    <img
                      src={deliveryModalData.item.imageUrl}
                      alt={deliveryModalData.item.name}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <PackageCheck className="w-5 h-5 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider">{th ? 'ไอเทมที่แจก' : 'Item to Distribute'}</span>
                    <span className="font-bold text-white text-sm truncate block">{deliveryModalData.item.name}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${getRarityBadge(deliveryModalData.item.rarity || 'RARE')}`}>
                  {deliveryModalData.item.rarity || 'RARE'}
                </span>
              </div>

              {/* Recipient Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>{th ? 'ผู้รับไอเทม' : 'Recipient'} <span className="text-emerald-400">*</span></span>
                  <span className="text-[10px] text-slate-400">{deliveryModalData.member.name ? `(${cleanClanName(deliveryModalData.member.clan)})` : ''}</span>
                </label>
                <select
                  value={deliveryModalData.member.userId || deliveryModalData.member.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = allMembers.find((m) => m.id === val || m.inGameName === val);
                    if (found) {
                      setDeliveryModalData({
                        ...deliveryModalData,
                        member: {
                          id: `gqm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          userId: found.id,
                          name: found.inGameName || found.username,
                          clan: cleanClanName(found.clan) || 'VoltZ',
                          powerLevel: found.powerLevel || 0,
                          status: 'pending',
                          joinedAt: Date.now()
                        }
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-emerald-400 text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {deliveryModalData.member.name && !allMembers.some((m) => m.id === deliveryModalData.member.userId) && (
                    <option value={deliveryModalData.member.name}>
                      {deliveryModalData.member.name} ({cleanClanName(deliveryModalData.member.clan)})
                    </option>
                  )}
                  {(Object.entries(membersByClan) as [string, User[]][]).map(([clanName, members]) => (
                    <optgroup key={clanName} label={`🛡️ ${cleanClanName(clanName)} (${members.length} ${th ? 'คน' : 'members'})`}>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.inGameName} ({cleanClanName(m.clan)}) {m.powerLevel ? `• ⚡ ${m.powerLevel.toLocaleString()} PL` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Price & Quantity Grid (Editable Price) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Editable Price to Pay per pc */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'ราคาเพชรที่ต้องจ่าย/ชิ้น' : 'Price to Pay/pc'}</span>
                    <span className="text-[10px] text-amber-400 font-mono">0 = {th ? 'ฟรี' : 'Free'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={deliveryModalData.price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setDeliveryModalData({
                          ...deliveryModalData,
                          price: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0)
                        })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-amber-400 text-amber-300 font-mono font-bold text-xs focus:outline-none"
                    />
                    <Coins className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Quantity to Receive */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'จำนวนที่จะได้รับ' : 'Quantity to Receive'}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{th ? 'ชิ้น' : 'pcs'}</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={deliveryModalData.item.maxRequestQuantity || 99}
                    value={deliveryModalData.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setDeliveryModalData({
                        ...deliveryModalData,
                        quantity: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1)
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-amber-400 text-white font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Calculation Highlight */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">{th ? 'รวมเพชรที่ต้องจ่ายทั้งหมด:' : 'Total Diamonds to Pay:'}</span>
                <span className="font-mono font-black text-amber-300 text-sm">
                  {((typeof deliveryModalData.price === 'number' ? deliveryModalData.price : (parseInt(String(deliveryModalData.price), 10) || 0)) * (typeof deliveryModalData.quantity === 'number' ? deliveryModalData.quantity : (parseInt(String(deliveryModalData.quantity), 10) || 1))).toLocaleString()} 💎
                </span>
              </div>

              {/* Billing Method Selector (or Free Notice if price is 0) */}
              {((typeof deliveryModalData.price === 'number' ? deliveryModalData.price : (parseInt(String(deliveryModalData.price), 10) || 0)) === 0) ? (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-300">
                  <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold block text-xs sm:text-sm">
                      {th ? '🎁 ไอเทมแจกฟรี (0 เพชร)' : '🎁 Free Item (0 Diamonds)'}
                    </span>
                    <span className="text-[11px] text-emerald-400/80 block mt-0.5">
                      {th
                        ? 'ไอเทมนี้แจกฟรี ไม่ต้องแนบรูปบิล และไม่ต้องยืนยันชำระ (บันทึกเป็นแจกฟรีอัตโนมัติ)'
                        : 'Free item: No bill attachment and no payment confirmation needed (Auto-recorded as free).'}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {th ? 'รูปแบบการส่งบิลเรียกเก็บเพชร' : 'Billing Method'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryModalData({ ...deliveryModalData, billingType: 'immediate' })}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        deliveryModalData.billingType === 'immediate'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold block">{th ? '🧾 ส่งบิลรอบนี้ทันที' : '🧾 Bill Immediately'}</span>
                      <span className="text-[10px] opacity-75 block">{th ? 'บันทึกบิลเพชรรอบนี้' : 'Record bill for this delivery'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryModalData({ ...deliveryModalData, billingType: 'on_complete' })}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        deliveryModalData.billingType === 'on_complete'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold block">{th ? '⏳ รอรวมบิลเมื่อแจกครบ' : '⏳ Bill on Complete'}</span>
                      <span className="text-[10px] opacity-75 block">{th ? 'รอรวมยอดส่งทีเดียว' : 'Wait until all pcs delivered'}</span>
                    </button>
                  </div>
                </div>
              )}



              {/* Note / Bill Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'หมายเหตุ / เลขที่บิล' : 'Note / Bill Number'}
                </label>
                <input
                  type="text"
                  placeholder={th ? 'เช่น บิลรอบที่ 1, มอบให้ตัวหลัก' : 'e.g. Round 1, Delivered in-game'}
                  value={deliveryModalData.note}
                  onChange={(e) => setDeliveryModalData({ ...deliveryModalData, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-amber-400 text-white text-xs focus:outline-none"
                />
              </div>

              {/* Receipt Image Upload & Paste (Only needed when price > 0) */}
              {((typeof deliveryModalData.price === 'number' ? deliveryModalData.price : (parseInt(String(deliveryModalData.price), 10) || 0)) > 0) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{th ? 'รูปถ่ายใบเสร็จ / บิลส่งมอบ' : 'Receipt / Bill image'}</span>
                    <span className="text-[10px] text-slate-400">{th ? '(แนบรูปบิล/สลิป)' : '(Attach bill/slip)'}</span>
                  </label>
                <div
                  tabIndex={0}
                  onPaste={(e) => {
                    const file = e.clipboardData?.items?.[0]?.getAsFile();
                    if (file && file.type.startsWith('image/')) {
                      compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.74 }).then((preview) => {
                        setDeliveryModalData({
                          ...deliveryModalData,
                          receiptFile: file,
                          receiptPreview: preview
                        });
                      });
                    }
                  }}
                  className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-400 outline-none"
                >
                  <label htmlFor="file-delivery-receipt" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{th ? 'เลือกรูปภาพ หรือกด Ctrl + V เพื่อวางรูป' : 'Choose image or press Ctrl + V'}</span>
                    <input
                      id="file-delivery-receipt"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const preview = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.74 });
                          setDeliveryModalData({
                            ...deliveryModalData,
                            receiptFile: file,
                            receiptPreview: preview
                          });
                        }
                        e.currentTarget.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  {deliveryModalData.receiptPreview && (
                    <div className="relative shrink-0">
                      <img
                        src={deliveryModalData.receiptPreview}
                        alt="receipt preview"
                        className="w-10 h-10 rounded object-cover border border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setDeliveryModalData({ ...deliveryModalData, receiptFile: null, receiptPreview: '' })}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-600 rounded-full text-white cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Keep in Queue / Craft in Progress Checkbox */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/40 cursor-pointer hover:border-purple-400 transition-colors">
                <input
                  type="checkbox"
                  checked={deliveryModalData.keepInQueue}
                  onChange={(e) => setDeliveryModalData({ ...deliveryModalData, keepInQueue: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-purple-600 focus:ring-purple-400 cursor-pointer"
                />
                <div className="min-w-0 text-xs">
                  <span className="font-bold text-slate-200 block flex items-center gap-1.5">
                    <span>{th ? '🔨 คงคิวไว้ต่อไป (ยังคราฟไม่สำเร็จ)' : '🔨 Keep in queue (Craft in progress / not finished)'}</span>
                    {deliveryModalData.keepInQueue ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">
                        {th ? 'ยังอยู่ในคิว' : 'IN QUEUE'}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                        {th ? 'คราฟสำเร็จ / จบคิว' : 'COMPLETED'}
                      </span>
                    )}
                  </span>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    {deliveryModalData.keepInQueue
                      ? (th
                          ? 'แจกของและบันทึกประวัติบิลตามปกติ แต่สมาชิกจะยังคงอยู่อันดับเดิมในคิว เพื่อรอรับรอบต่อไปจนกว่าจะคราฟสำเร็จ'
                          : 'Deliver & record receipt normally, but keep member in current queue spot until craft succeeds.')
                      : (th
                          ? 'ปรับสถานะเป็นรับครบถ้วน/คราฟสำเร็จ เพื่อส่งต่อคิวให้สมาชิกคนถัดไป'
                          : 'Mark as completed/succeeded to advance queue to the next member.')}
                  </span>
                </div>
              </label>

              {/* Discord Notification Toggle Checkbox */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={deliveryModalData.sendDiscordNotification}
                  onChange={(e) => setDeliveryModalData({ ...deliveryModalData, sendDiscordNotification: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-500 bg-slate-950 border-slate-700 focus:ring-sky-400 cursor-pointer"
                />
                <div className="min-w-0 text-xs">
                  <span className="font-bold text-slate-200 block flex items-center gap-1.5">
                    <span>{th ? 'ส่งการแจ้งเตือนแจกไอเทมเข้า Discord' : 'Send distribution notice to Discord'}</span>
                    {deliveryModalData.sendDiscordNotification ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono font-bold">ON</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono font-bold">MUTED</span>
                    )}
                  </span>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    {deliveryModalData.sendDiscordNotification
                      ? (th ? 'จะส่งข้อความประกาศผลการแจกเข้า Discord ตามปกติ' : 'Will post delivery announcement to Discord')
                      : (th ? 'ปิดการแจ้งเตือนไว้เพื่อไม่ให้รบกวนช่อง Discord (เช่น กำลังทยอยแจก)' : 'Notification muted to prevent spam during partial deliveries')}
                  </span>
                </div>
              </label>

              {/* Item Queue Rule: Strictly Zero Diamond Vault Impact */}
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-emerald-300 block">
                    {th ? 'กฎระบบ Item Queue: เพชรไม่คิดเข้ากองกลาง 100%' : 'Item Queue Rule: Strictly Zero Diamond Vault Impact'}
                  </span>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    {th
                      ? 'ยอดเพชรจะถูกบันทึกลงในประวัติบิลส่งมอบของไอเทมนี้เท่านั้น โดยไม่เพิ่มหรือลดเพชรในคลังกลางของแคลน'
                      : 'Transaction recorded in item delivery receipts only, without modifying Clan Diamond Vault fund balance.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3.5 bg-[#0e1524]">
              <button
                type="button"
                onClick={() => setDeliveryModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isDelivering}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:brightness-110 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDelivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4 text-amber-300" />}
                <span>{isDelivering ? (th ? 'กำลังแจกไอเทม...' : 'Distributing...') : (th ? 'ยืนยันแจกไอเทม' : 'Confirm Distribute')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT RECEIPT MODAL */}
      {editingReceiptData && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && setEditingReceiptData(null)}
        >
          <form
            onSubmit={handleConfirmEditReceipt}
            className="w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-[#0b101b] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1524]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold font-cinzel text-white">
                  {th ? 'แก้ไขข้อมูลบิลส่งมอบ' : 'Edit Delivery Receipt'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingReceiptData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'หมายเหตุ / เลขที่บิล' : 'Note / Bill Number'}
                </label>
                <input
                  type="text"
                  value={editingReceiptData.note}
                  onChange={(e) => setEditingReceiptData({ ...editingReceiptData, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-slate-700 focus:border-cyan-400 text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {th ? 'เปลี่ยนรูปใบเสร็จใหม่' : 'Replace receipt image'}
                </label>
                <label className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex items-center justify-between gap-3 cursor-pointer hover:border-cyan-400">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{th ? 'คลิกเพื่อเลือกไฟล์รูปใหม่' : 'Click to select new image'}</span>
                  </div>
                  {editingReceiptData.newReceiptPreview && (
                    <img
                      src={editingReceiptData.newReceiptPreview}
                      alt="receipt"
                      className="w-10 h-10 rounded object-cover border border-cyan-400 shrink-0"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const preview = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.74 });
                        setEditingReceiptData({
                          ...editingReceiptData,
                          newReceiptFile: file,
                          newReceiptPreview: preview
                        });
                      }
                      e.currentTarget.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3.5 bg-[#0e1524]">
              <button
                type="button"
                onClick={() => setEditingReceiptData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isUpdatingReceipt}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white text-xs font-bold shadow-md"
              >
                {isUpdatingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span>{isUpdatingReceipt ? (th ? 'กำลังบันทึก...' : 'Saving...') : (th ? 'บันทึกการแก้ไข' : 'Save Changes')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MEMBER REQUEST QUANTITY MODAL */}
      {requestModalData && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && !isSubmittingRequest && setRequestModalData(null)}
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-500/50 bg-[#0b101b] shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1524]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-cinzel text-white">
                    {th ? 'ขอรับไอเทม' : 'Request Item'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {requestModalData.item.isCraftGoal || requestModalData.item.maxRequestQuantity === 0
                      ? (th ? 'ขอรับไอเทมสำหรับคราฟ (แจกจนกว่าจะสำเร็จ)' : 'Request item for crafting (until success)')
                      : (th ? 'ระบุจำนวนที่ต้องการ' : 'Specify quantity')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalData(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title={th ? 'ปิด' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmRequest} className="p-5 space-y-4 bg-[#090d16]">
              {/* Item Preview Card */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0e1422] border border-slate-800">
                {requestModalData.item.imageUrl ? (
                  <img
                    src={requestModalData.item.imageUrl}
                    alt={requestModalData.item.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border uppercase shrink-0 ${getRarityBadge(requestModalData.item.rarity || 'RARE')}`}>
                      {requestModalData.item.rarity || 'RARE'}
                    </span>
                    <span className="font-bold text-sm text-white truncate">
                      {requestModalData.item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                    <span className="text-amber-300 font-mono font-bold">
                      {requestModalData.item.price ? `${requestModalData.item.price.toLocaleString()} 💎 / ${th ? 'ชิ้น' : 'pc'}` : (th ? 'แจกฟรี' : 'Free')}
                    </span>
                    {requestModalData.item.minPowerLevel > 0 && (
                      <span className="text-sky-400 font-mono">
                        ⚡ {requestModalData.item.minPowerLevel.toLocaleString()}+ PL
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Craft Goal Notice */}
              {(requestModalData.item.isCraftGoal || requestModalData.item.maxRequestQuantity === 0) && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-start gap-2.5 text-xs text-purple-200">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-purple-300 block">
                      {th ? '🔨 สิทธิ์การแจกจนกว่าจะคราฟสำเร็จ' : '🔨 Craft Until Success Queue'}
                    </span>
                    <span className="text-[11px] text-purple-300/80 block">
                      {th
                        ? 'คุณจะได้รับไอเทมเพื่อลองคราฟ และคงอยู่ในคิวอันดับเดิมต่อไปเรื่อยๆ จนกว่าจะคราฟสำเร็จ'
                        : 'You will receive items per attempt and remain in your queue position until crafting succeeds.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Quantity Stepper Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {th ? 'จำนวนที่ต้องการขอรับ:' : 'Requested Quantity:'}
                  </label>
                  <span className={`text-[11px] font-mono font-semibold ${(requestModalData.item.isCraftGoal || requestModalData.item.maxRequestQuantity === 0) ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {(requestModalData.item.isCraftGoal || requestModalData.item.maxRequestQuantity === 0)
                      ? (th ? '🎯 ไม่จำกัด (จนกว่าจะคราฟสำเร็จ)' : '🎯 Until craft succeeds')
                      : (th ? `สูงสุด ${requestModalData.item.maxRequestQuantity || 1} ชิ้น` : `Max ${requestModalData.item.maxRequestQuantity || 1} pcs`)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRequestModalData((prev) =>
                        prev ? { ...prev, quantity: Math.max(1, (Number(prev.quantity) || 1) - 1) } : null
                      )
                    }
                    className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer border border-slate-700 text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={(requestModalData.item.isCraftGoal || requestModalData.item.maxRequestQuantity === 0) ? 99 : (requestModalData.item.maxRequestQuantity || 1)}
                    value={requestModalData.quantity}
                    onChange={(e) => {
                      const max = (requestModalData.item.isCraftGoal || requestModalData.item.maxRequestQuantity === 0) ? 99 : (requestModalData.item.maxRequestQuantity || 1);
                      const val = e.target.value === '' ? '' : Math.max(1, Math.min(max, parseInt(e.target.value, 10) || 1));
                      setRequestModalData((prev) => (prev ? { ...prev, quantity: val as any } : null));
                    }}
                    className="flex-1 h-10 px-3 text-center rounded-xl bg-[#0e1422] border border-slate-700 text-white font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const max = requestModalData.item.maxRequestQuantity === 0 ? 99 : (requestModalData.item.maxRequestQuantity || 1);
                      setRequestModalData((prev) =>
                        prev ? { ...prev, quantity: Math.min(max, (Number(prev.quantity) || 1) + 1) } : null
                      );
                    }}
                    className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer border border-slate-700 text-base"
                  >
                    +
                  </button>
                  {(requestModalData.item.maxRequestQuantity || 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const max = requestModalData.item.maxRequestQuantity || 1;
                        setRequestModalData((prev) => (prev ? { ...prev, quantity: max } : null));
                      }}
                      className="px-3 h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              {/* Total Calculation / Free Notice */}
              {requestModalData.item.price > 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    {th ? 'รวมเพชรที่ต้องชำระ:' : 'Total Diamonds to Pay:'}
                  </span>
                  <span className="font-mono font-black text-amber-300 text-sm">
                    {(requestModalData.item.price * (Number(requestModalData.quantity) || 1)).toLocaleString()} 💎
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                  <Gift className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{th ? 'ไอเทมนี้แจกฟรี ไม่มีค่าใช้จ่ายเพชร' : 'This item is free of charge'}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRequestModalData(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {th ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{isSubmittingRequest ? (th ? 'กำลังขอรับ...' : 'Submitting...') : (th ? 'ยืนยันขอรับ' : 'Confirm Request')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ITEM DIALOG */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => e.target === e.currentTarget && setItemToDelete(null)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-red-500/40 bg-[#0f1422] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/80">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold font-cinzel text-white">
                {th ? 'ยืนยันลบไอเทม' : 'Confirm Delete Item'}
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              {th
                ? `คุณแน่ใจหรือไม่ว่าต้องการลบไอเทม "${itemToDelete.name}" ออกจากคิว? ข้อมูลคิวและประวัติจะถูกลบทั้งหมด`
                : `Are you sure you want to remove "${itemToDelete.name}" from the queue? All waiting members and receipts will be removed.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                {th ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = itemToDelete.id;
                  setItemToDelete(null);
                  await onDelete(id);
                  if (showToast) showToast(th ? 'ลบไอเทมเรียบร้อยแล้ว' : 'Item deleted', 'info');
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md"
              >
                {th ? 'ลบไอเทม' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
