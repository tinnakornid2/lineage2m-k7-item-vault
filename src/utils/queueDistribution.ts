import { GeneralItem, GeneralItemReceipt, VaultItem } from '../types';

/** One receipt always maps to one archive entry, including partial deliveries. */
export function queueReceiptToVaultItem(item: GeneralItem, receipt: GeneralItemReceipt): VaultItem {
  const price = Math.max(0, Number(receipt.diamondPrice) || 0);
  const free = price === 0;
  return {
    id: `queue_receipt_${receipt.id}`,
    name: receipt.itemName || item.name,
    imageUrl: receipt.itemImageUrl || item.imageUrl || '',
    rarity: receipt.itemRarity || item.rarity || 'RARE',
    price,
    quantity: Math.max(1, Number(receipt.quantity) || 1),
    minPowerLevel: item.minPowerLevel || 0,
    hunters: [],
    hunterScreenshots: [],
    claimants: [],
    status: 'distributed',
    source: 'item_queue',
    receiptImages: free ? [] : receipt.receiptImages || [],
    paymentStatus: free ? 'paid' : 'pending',
    // Queue deliveries have no hunter payout, so never enter that pending box.
    diamondDistributed: true,
    distributedTo: {
      userId: receipt.userId,
      name: receipt.name,
      clan: receipt.clan,
      distributedAt: receipt.deliveredAt,
      distributedBy: receipt.deliveredBy,
      source: 'item_queue',
      receiptImages: free ? [] : receipt.receiptImages || [],
      paymentStatus: free ? 'paid' : 'pending',
      diamondDistributed: true
    },
    createdAt: receipt.deliveredAt,
    updatedAt: receipt.updatedAt || receipt.deliveredAt
  };
}

export function mergeDistributionArchive(previous: VaultItem[], additions: VaultItem[]): VaultItem[] {
  const incoming = new Set(additions.map(item => item.id));
  return [...additions, ...previous.filter(item => !incoming.has(item.id))];
}
