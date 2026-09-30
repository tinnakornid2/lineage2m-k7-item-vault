import type { User, StatUpdateSettings } from '../types';

export function roundApproved(user: Partial<User> | null | undefined, settings?: StatUpdateSettings): boolean {
  const round = settings?.round;
  return !round?.active || Boolean(user && Number(user.approvedStatRequestAt || 0) >= round.openedAt && Number(user.statApprovalAt || 0) >= round.openedAt);
}
export function claimBlocked(user: Partial<User> | null | undefined, settings?: StatUpdateSettings, now = Date.now()): boolean {
  return Boolean(settings?.round?.active && now >= settings.round.enforceAt && !roundApproved(user, settings));
}
const numberMap = (value: Record<string, number> = {}) => Object.entries(value || {}).map(([k, v]) => [k, Number(v) || 0] as const).filter(([, v]) => v !== 0).sort(([a], [b]) => a.localeCompare(b));
export function statSignature(user: Partial<User>, pending = false): string {
  return JSON.stringify([
    numberMap(pending ? user.pendingStats ?? user.stats : user.stats),
    numberMap(pending ? user.pendingSpiritEnhancements ?? user.spiritEnhancements : user.spiritEnhancements),
    [...(pending ? user.pendingClasses ?? user.classes ?? [] : user.classes ?? [])].sort(),
    Number((pending ? user.pendingLevel ?? user.level : user.level) || 0),
    Number((pending ? user.pendingLegendClasses ?? user.legendClasses : user.legendClasses) || 0),
    Number((pending ? user.pendingLegendAgathions ?? user.legendAgathions : user.legendAgathions) || 0)
  ]);
}
export function submissionError(existing: Partial<User>, submitted: Partial<User>, settings?: StatUpdateSettings): string | null {
  const pendingAt = Number(existing.pendingPowerLevelRequestedAt || 0);
  const pending = pendingAt > Math.max(Number(existing.statApprovalAt || 0), Number(existing.statRejectionAt || 0));
  if (pending && (!settings?.round?.active || pendingAt >= settings.round.openedAt) && statSignature(existing, true) === statSignature(submitted, true)) return 'DUPLICATE_PENDING';
  const needsRound = Boolean(settings?.round?.active && !roundApproved(existing, settings));
  if (needsRound && (!submitted.pendingStatScreenshotUrl || submitted.pendingStatScreenshotUrl === existing.statScreenshotUrl || (pendingAt < settings!.round!.openedAt && submitted.pendingStatScreenshotUrl === existing.pendingStatScreenshotUrl))) return 'ROUND_SCREENSHOT_REQUIRED';
  if (!needsRound && existing.statApprovalAt && statSignature(existing) === statSignature(submitted, true)) return 'UNCHANGED_STATS';
  return null;
}
export function statMessage(code: string, lang: 'th' | 'en'): string {
  const messages: Record<string, [string, string]> = {
    DUPLICATE_PENDING: ['มีคำขอสเตตัสชุดนี้รอตรวจอยู่แล้ว', 'These stats are already awaiting review.'],
    UNCHANGED_STATS: ['ข้อมูลไม่เปลี่ยนแปลงจากสเตตัสที่อนุมัติล่าสุด', 'Stats have not changed since the last approval.'],
    ROUND_SCREENSHOT_REQUIRED: ['กรุณาแนบภาพหลักฐานใหม่สำหรับรอบนี้', 'Please attach a new screenshot for this round.'],
    STAT_ROUND_REQUIRED: ['ต้องได้รับอนุมัติสเตตัสของรอบปัจจุบันก่อนขอรับหรือรับไอเทม', 'Current-round stat approval is required before requesting or receiving items.'],
    ACCOUNT_PENDING_APPROVAL: ['บัญชีนี้อยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ', 'Your account is pending approval by an administrator.'],
    ACCOUNT_SUSPENDED: ['บัญชีนี้ถูกระงับการใช้งาน', 'This account has been suspended.'],
    ACCOUNT_NOT_ACTIVE: ['บัญชีไม่อยู่ในสถานะเปิดใช้งาน', 'Account is not active.'],
    USER_NOT_FOUND: ['ไม่พบบัญชีผู้ใช้ในระบบ', 'User account not found.'],
    INSUFFICIENT_POWER_LEVEL: ['ค่าพลังของคุณยังไม่ถึงเกณฑ์ขั้นต่ำสำหรับไอเทมนี้', 'Your power level does not meet the minimum requirement for this item.'],
    QUEUE_CLOSED: ['รายการนี้ปิดรับการลงคิวแล้ว', 'This item queue is currently closed.'],
    FORBIDDEN: ['คุณไม่มีสิทธิ์ดำเนินการนี้', 'You do not have permission to perform this action.'],
    CENTRAL_STORE_TIMEOUT: ['การเชื่อมต่อฐานข้อมูลส่วนกลางหมดเวลา กรุณาลองใหม่อีกครั้ง', 'Central database connection timed out. Please try again.'],
    CENTRAL_STORE_UNAVAILABLE: ['ฐานข้อมูลส่วนกลางไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง', 'Central store is unavailable. Please try again.'],
    AUTH_REQUIRED: ['เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', 'Session expired. Please sign in again.']
  };
  return messages[code]?.[lang === 'th' ? 0 : 1] || (lang === 'th' ? 'บันทึกไม่สำเร็จ กรุณาลองใหม่' : 'Save failed. Please try again.');
}
