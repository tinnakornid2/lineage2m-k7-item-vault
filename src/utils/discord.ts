import { DiscordSettings, ItemRarity, VaultItem, DistributedInfo, cleanClanName } from '../types';

function getRarityColor(rarity: ItemRarity): number {
  switch (rarity) {
    case 'MYTHIC':
      return 0xf59e0b; // Gold
    case 'LAGEND':
      return 0xa855f7; // Purple
    case 'EPIC':
      return 0xef4444; // Red
    case 'RARE':
    default:
      return 0x38bdf8; // Sky Blue
  }
}

/**
 * Send rich discord notification through backend proxy
 */
export async function sendDiscordNotification(
  settings: DiscordSettings,
  event: 'new_item' | 'distribute' | 'test' | 'stat_request' | 'stat_approval',
  data?: {
    item?: VaultItem;
    distributeInfo?: DistributedInfo;
    actorName?: string;
    memberName?: string;
    memberClan?: string;
    oldPowerLevel?: number;
    newPowerLevel?: number;
    screenshotUrl?: string;
    statsSummary?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  if (!settings.enabled || !settings.webhookUrl) {
    return { success: false, message: 'Discord Webhook is disabled or not configured' };
  }

  let payload: any = null;

  if (event === 'test') {
    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: '🔔 ทดสอบการเชื่อมต่อ Discord Webhook สำเร็จ!',
          description: 'ระบบแคลนและคลังไอเทม **Lineage 2M Clan Hub** เชื่อมต่อกับช่อง Discord นี้เรียบร้อยแล้ว\nต่อไปนี้เมื่อมีการลงทะเบียนไอเทมใหม่ หรือแจกไอเทม สมาชิกในกิลด์จะได้รับการแจ้งเตือนอัตโนมัติที่นี่',
          color: 0x10b981, // Green
          fields: [
            {
              name: '👑 ผู้ทดสอบระบบ',
              value: data?.actorName || 'Admin/Owner',
              inline: true
            },
            {
              name: '⚡ สถานะการแจ้งเตือน',
              value: `• แจ้งเตือนของใหม่: ${settings.notifyOnNewItem ? '✅ เปิด' : '❌ ปิด'}\n• แจ้งเตือนเมื่อแจก: ${settings.notifyOnDistribute ? '✅ เปิด' : '❌ ปิด'}`,
              inline: true
            }
          ],
          footer: {
            text: 'Lineage 2M Clan Hub • Notification Bot'
          },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else if (event === 'new_item' && data?.item) {
    if (!settings.notifyOnNewItem) {
      return { success: false, message: 'Notification for new items is disabled in settings' };
    }

    const item = data.item;
    const color = getRarityColor(item.rarity);
    const hunterCount = item.hunters?.length || 0;
    const hunterSample = item.hunters && item.hunters.length > 0
      ? item.hunters.slice(0, 10).map((h) => `${h.name} (${cleanClanName(h.clan) || 'VoltZ'})`).join(', ') + (item.hunters.length > 10 ? ` และอีก ${item.hunters.length - 10} คน` : '')
      : 'ไม่มีรายชื่อ';

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: `⚔️ ไอเทมใหม่เข้าคลัง! [${item.rarity}] ${item.name}`,
          description: `แอดมินนำไอเทมบอสเข้าสู่ระบบคลังเรียบร้อยแล้ว สมาชิกที่มีพลังตามเกณฑ์สามารถเข้าเว็บไซต์เพื่อลงชื่อเครมไอเทมได้ทันที!`,
          color: color,
          thumbnail: item.imageUrl ? { url: item.imageUrl } : undefined,
          fields: [
            {
              name: '💎 มูลค่าคลัง',
              value: `**${item.price.toLocaleString()} Diamonds**`,
              inline: true
            },
            {
              name: '🛡️ พลังรบขั้นต่ำ (Min PL)',
              value: `**⚡ ${item.minPowerLevel.toLocaleString()} PL**`,
              inline: true
            },
            {
              name: '👥 สมาชิกร่วมล่าบอส',
              value: `**${hunterCount} คน**\n${hunterSample}`,
              inline: false
            }
          ],
          footer: {
            text: `ลงระบบโดย: ${data.actorName || 'Admin'} • Lineage 2M Clan Hub`
          },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else if (event === 'distribute' && data?.item && data?.distributeInfo) {
    if (!settings.notifyOnDistribute) {
      return { success: false, message: 'Notification for distributed items is disabled in settings' };
    }

    const item = data.item;
    const dist = data.distributeInfo;
    const color = getRarityColor(item.rarity);

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: `🏆 ประกาศผลการแจกไอเทม! [${item.rarity}] ${item.name}`,
          description: `ขอแสดงความยินดีกับ **${dist.name}** แห่ง **${cleanClanName(dist.clan) || 'Alliance'}** ที่ได้รับไอเทมชิ้นนี้ไปครอบครอง!`,
          color: color,
          thumbnail: item.imageUrl ? { url: item.imageUrl } : undefined,
          fields: [
            {
              name: '👤 ผู้ได้รับไอเทม',
              value: `**${dist.name}**\n(${cleanClanName(dist.clan) || 'No Clan'})`,
              inline: true
            },
            {
              name: '💎 มูลค่าไอเทม',
              value: `**${item.price.toLocaleString()} Diamonds**`,
              inline: true
            },
            {
              name: '👑 ผู้ดำเนินการแจก',
              value: dist.distributedBy || data.actorName || 'Owner/Admin',
              inline: true
            }
          ],
          footer: {
            text: `แจกจ่ายเมื่อ: ${new Date(dist.distributedAt).toLocaleString('th-TH')} • Lineage 2M Clan Hub`
          },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else if (event === 'stat_request') {
    const prev = data?.oldPowerLevel || 0;
    const next = data?.newPowerLevel || 0;
    const diff = next - prev;

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: `⚡ มีคำขออัปเดตสเตตัสและค่าพลังใหม่!`,
          description: `สมาชิก **${data?.memberName}** แห่ง **${cleanClanName(data?.memberClan) || 'Alliance'}** ส่งคำขออัปเดตสเตตัสเพื่อคำนวณ Power Level ใหม่ แอดมินสามารถเปิดหน้าเว็บเพื่อตรวจสเตตัสได้ทันที`,
          color: 0xf59e0b, // Amber
          image: data?.screenshotUrl && !data.screenshotUrl.startsWith('data:') ? { url: data.screenshotUrl } : undefined,
          fields: [
            {
              name: '👤 สมาชิก',
              value: `**${data?.memberName}** (${cleanClanName(data?.memberClan) || 'VoltZ'})`,
              inline: true
            },
            {
              name: '⚡ พลังรบใหม่ (PL)',
              value: `**${next.toLocaleString()} PL** (${diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()})`,
              inline: true
            },
            {
              name: '📊 สถานะการตรวจ',
              value: '⏳ รอแอดมินตรวจสอบและอนุมัติ',
              inline: true
            }
          ],
          footer: {
            text: 'Lineage 2M Clan Hub • Stat Verification'
          },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else if (event === 'stat_approval') {
    const next = data?.newPowerLevel || 0;

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: `✅ อนุมัติการอัปเดตสเตตัสเรียบร้อย!`,
          description: `ยินดีกับ **${data?.memberName}** สเตตัสได้รับการอนุมัติแล้ว และค่าพลังอย่างเป็นทางการถูกอัปเดตทั่วทั้งระบบ`,
          color: 0x10b981, // Emerald
          fields: [
            {
              name: '👤 สมาชิก',
              value: `**${data?.memberName}** (${cleanClanName(data?.memberClan) || 'VoltZ'})`,
              inline: true
            },
            {
              name: '⚡ พลังรบอย่างเป็นทางการ',
              value: `**${next.toLocaleString()} PL**`,
              inline: true
            },
            {
              name: '👑 ผู้ตรวจอนุมัติ',
              value: data?.actorName || 'Admin/Owner',
              inline: true
            }
          ],
          footer: {
            text: 'Lineage 2M Clan Hub • Stat Verification'
          },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  if (!payload) {
    return { success: false, message: 'Invalid notification event or payload' };
  }

  // 1. Try local/backend proxy first
  try {
    const res = await fetch('/api/discord-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: settings.webhookUrl,
        payload
      })
    });

    if (res.ok) {
      const resText = await res.text();
      try {
        const result = JSON.parse(resText);
        if (result.success) return { success: true };
      } catch {
        // Fallback to direct fetch below
      }
    }
  } catch {
    // Backend unavailable, fallback to direct fetch below
  }

  // 2. Direct Discord webhook call (Fallback for Vercel / Static hosting)
  try {
    const directRes = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (directRes.ok || directRes.status === 204) {
      return { success: true };
    }
    const errText = await directRes.text();
    return { success: false, message: `Discord returned ${directRes.status}: ${errText}` };
  } catch (err: any) {
    console.error('Error sending discord notification:', err);
    return { success: false, message: err.message || 'Network error sending webhook' };
  }
}
