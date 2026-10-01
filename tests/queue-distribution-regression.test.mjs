import test from 'node:test';
import assert from 'node:assert/strict';
import { queueReceiptToVaultItem, mergeDistributionArchive } from '../src/utils/queueDistribution.ts';
import { isItemDistributed, isDistributedItemPaymentPending, isDistributedItemDiamondPayoutPending } from '../src/types.ts';

const item = { id: 'queue-1', name: 'Sword', imageUrl: '', rarity: 'RARE', minPowerLevel: 0, createdAt: 1 };
const receipt = { id: 'receipt-1', userId: 'member-1', name: 'Member', clan: 'K7', quantity: 2, diamondPrice: 0, receiptImages: [], deliveredAt: 123, deliveredBy: 'Admin' };

test('Free queue delivery enters the distributed archive without payment or hunter payout pending', () => {
  const archive = queueReceiptToVaultItem(item, receipt);
  assert.equal(archive.id, 'queue_receipt_receipt-1');
  assert.equal(archive.quantity, 2);
  assert.equal(archive.distributedTo.userId, 'member-1');
  assert.equal(isItemDistributed(archive), true);
  assert.equal(isDistributedItemPaymentPending(archive), false);
  assert.equal(isDistributedItemDiamondPayoutPending(archive), false);
});

test('Paid-price partial delivery is archived immediately, awaiting payment but not hunter payout', () => {
  const archive = queueReceiptToVaultItem(item, { ...receipt, diamondPrice: 50, quantity: 1, receiptImages: ['https://example.test/slip'] });
  assert.equal(isItemDistributed(archive), true);
  assert.equal(isDistributedItemPaymentPending(archive), true);
  assert.equal(isDistributedItemDiamondPayoutPending(archive), false);
  assert.deepEqual(archive.receiptImages, ['https://example.test/slip']);
});

test('Repeated delivery receipt produces one archive entry and preserves unrelated concurrent items', () => {
  const archive = queueReceiptToVaultItem(item, receipt);
  const other = { ...archive, id: 'another-item' };
  const once = mergeDistributionArchive([other], [archive]);
  const twice = mergeDistributionArchive(once, [queueReceiptToVaultItem(item, receipt)]);
  assert.equal(twice.length, 2);
  assert.equal(twice.filter(entry => entry.id === archive.id).length, 1);
  assert.ok(twice.includes(other));
});
