import { ClanFundTxType, DiamondVaultRecord } from '../types';

/**
 * Calculates the exact signed net change for a given diamond vault transaction.
 * - Deposits/Credits: +netAmount (or +amount)
 * - Withdrawals/Deductions/Expenditures: -amount
 * - Adjustments: +amount (can be positive or negative)
 */
export function calculateDiamondNetChange(tx: {
  type: ClanFundTxType | string;
  amount: number;
  netAmount?: number;
}): number {
  if (tx.type === 'credit' || tx.type === 'deposit') {
    return typeof tx.netAmount === 'number' ? tx.netAmount : tx.amount;
  }
  if (tx.type === 'deduction' || tx.type === 'expenditure' || tx.type === 'withdraw') {
    return -Math.abs(tx.amount);
  }
  if (tx.type === 'adjust') {
    return tx.amount;
  }
  return tx.amount;
}

/**
 * Computes the total global diamond vault balance from transaction history starting at 0.
 */
export function computeTotalVaultBalance(transactions: DiamondVaultRecord[]): number {
  return transactions.reduce((acc, tx) => acc + calculateDiamondNetChange(tx), 0);
}
