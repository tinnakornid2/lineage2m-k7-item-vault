import { DiscordSettings, ItemRarity, VaultItem, DistributedInfo, Language, cleanClanName } from '../types';
import { getCurrentUserIdToken } from '../services/firebase';

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
    lang?: Language;
  }
): Promise<{ success: boolean; message?: string }> {
  const lang = data?.lang || 'th';
  const th = lang === 'th';
  if (!settings.enabled) {
    return { success: false, message: th ? 'ปิดการใช้งาน Discord Webhook อยู่' : 'Discord Webhook is disabled' };
  }

  let payload: any = null;

  if (event === 'test') {
    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: th ? '🔔 ทดสอบการเชื่อมต่อ Discord Webhook สำเร็จ!' : '🔔 Discord Webhook connection successful!',
          description: th
            ? 'ระบบแคลนและคลังไอเทม **Lineage 2M Clan Hub** เชื่อมต่อกับช่อง Discord นี้เรียบร้อยแล้ว\nเมื่อมีไอเทมใหม่หรือมีการแจกไอเทม ระบบจะแจ้งเตือนที่นี่โดยอัตโนมัติ'
            : '**Lineage 2M Clan Hub** is now connected to this Discord channel.\nNew items and item distributions will be announced here automatically.',
          color: 0x10b981, // Green
          fields: [
            {
              name: th ? '👑 ผู้ทดสอบระบบ' : '👑 Tested by',
              value: data?.actorName || 'Admin/Owner',
              inline: true
            },
            {
              name: th ? '⚡ สถานะการแจ้งเตือน' : '⚡ Notification status',
              value: th
                ? `• แจ้งเตือนของใหม่: ${settings.notifyOnNewItem ? '✅ เปิด' : '❌ ปิด'}\n• แจ้งเตือนเมื่อแจก: ${settings.notifyOnDistribute ? '✅ เปิด' : '❌ ปิด'}`
                : `• New item alerts: ${settings.notifyOnNewItem ? '✅ On' : '❌ Off'}\n• Distribution alerts: ${settings.notifyOnDistribute ? '✅ On' : '❌ Off'}`,
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
      return { success: false, message: th ? 'ปิดการแจ้งเตือนไอเทมใหม่อยู่' : 'New item notifications are disabled' };
    }

    const item = data.item;
    const color = getRarityColor(item.rarity);
    const hunterCount = item.hunters?.length || 0;
    const hunterSample = item.hunters && item.hunters.length > 0
      ? item.hunters.slice(0, 10).map((h) => `${h.name} (${cleanClanName(h.clan) || 'VoltZ'})`).join(', ') + (item.hunters.length > 10 ? (th ? ` และอีก ${item.hunters.length - 10} คน` : ` and ${item.hunters.length - 10} more`) : '')
      : (th ? 'ไม่มีรายชื่อ' : 'No hunters listed');

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: th ? `⚔️ ไอเทมใหม่เข้าคลัง! [${item.rarity}] ${item.name}` : `⚔️ New vault item! [${item.rarity}] ${item.name}`,
          description: th ? 'แอดมินนำไอเทมบอสเข้าสู่ระบบคลังแล้ว สมาชิกที่มีพลังตามเกณฑ์สามารถเข้ามาลงชื่อรับไอเทมได้ทันที' : 'A new boss item has been added to the vault. Eligible members can submit a claim now.',
          color: color,
          thumbnail: item.imageUrl ? { url: item.imageUrl } : undefined,
          fields: [
            {
              name: th ? '📦 จำนวน' : '📦 Quantity',
              value: `**${item.quantity || 1} ${th ? 'ชิ้น' : 'pcs'}**`,
              inline: true
            },
            {
              name: th ? '💎 มูลค่าคลัง' : '💎 Vault value',
              value: item.price > 0 ? `**${item.price.toLocaleString()} Diamonds**` : '**🎁 FREE (ฟรี 0 เพชร)**',
              inline: true
            },
            {
              name: th ? '🛡️ พลังรบขั้นต่ำ' : '🛡️ Minimum Power Level',
              value: `**⚡ ${item.minPowerLevel.toLocaleString()} PL**`,
              inline: true
            },
            {
              name: th ? '👥 สมาชิกร่วมล่าบอส' : '👥 Boss hunters',
              value: `**${hunterCount} ${th ? 'คน' : 'members'}**\n${hunterSample}`,
              inline: false
            }
          ],
          footer: {
            text: `${th ? 'ลงระบบโดย' : 'Added by'}: ${data.actorName || 'Admin'} • Lineage 2M Clan Hub`
          },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else if (event === 'distribute' && data?.item && data?.distributeInfo) {
    if (!settings.notifyOnDistribute) {
      return { success: false, message: th ? 'ปิดการแจ้งเตือนการแจกไอเทมอยู่' : 'Item distribution notifications are disabled' };
    }

    const item = data.item;
    const dist = data.distributeInfo;
    const color = getRarityColor(item.rarity);

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: th ? `🏆 ประกาศผลการแจกไอเทม! [${item.rarity}] ${item.name}` : `🏆 Item distribution result! [${item.rarity}] ${item.name}`,
          description: th ? `ขอแสดงความยินดีกับ **${dist.name}** แห่ง **${cleanClanName(dist.clan) || 'Alliance'}** ที่ได้รับไอเทมชิ้นนี้` : `Congratulations to **${dist.name}** of **${cleanClanName(dist.clan) || 'Alliance'}**, who received this item!`,
          color: color,
          thumbnail: item.imageUrl ? { url: item.imageUrl } : undefined,
          fields: [
            {
              name: th ? '👤 ผู้ได้รับไอเทม' : '👤 Recipient',
              value: `**${dist.name}**\n(${cleanClanName(dist.clan) || 'No Clan'})`,
              inline: true
            },
            {
              name: th ? '💎 มูลค่าไอเทม' : '💎 Item value',
              value: item.price > 0 ? `**${item.price.toLocaleString()} Diamonds**` : '**🎁 FREE (ฟรี 0 เพชร)**',
              inline: true
            },
            {
              name: th ? '👑 ผู้ดำเนินการแจก' : '👑 Distributed by',
              value: dist.distributedBy || data.actorName || 'Owner/Admin',
              inline: true
            }
          ],
          footer: {
            text: `${th ? 'แจกจ่ายเมื่อ' : 'Distributed at'}: ${new Date(dist.distributedAt).toLocaleString(th ? 'th-TH' : 'en-US')} • Lineage 2M Clan Hub`
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
          title: th ? '⚡ มีคำขออัปเดตสเตตัสและค่าพลังใหม่!' : '⚡ New stats and Power Level update request!',
          description: th ? `สมาชิก **${data?.memberName}** แห่ง **${cleanClanName(data?.memberClan) || 'Alliance'}** ส่งคำขออัปเดตสเตตัสเพื่อคำนวณ Power Level ใหม่ แอดมินสามารถเปิดหน้าเว็บเพื่อตรวจสอบได้ทันที` : `**${data?.memberName}** of **${cleanClanName(data?.memberClan) || 'Alliance'}** submitted updated stats for a new Power Level calculation. An admin can review the request on the website.`,
          color: 0xf59e0b, // Amber
          image: data?.screenshotUrl && !data.screenshotUrl.startsWith('data:') ? { url: data.screenshotUrl } : undefined,
          fields: [
            {
              name: th ? '👤 สมาชิก' : '👤 Member',
              value: `**${data?.memberName}** (${cleanClanName(data?.memberClan) || 'VoltZ'})`,
              inline: true
            },
            {
              name: th ? '⚡ พลังรบใหม่ (PL)' : '⚡ New Power Level',
              value: `**${next.toLocaleString()} PL** (${diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()})`,
              inline: true
            },
            {
              name: th ? '📊 สถานะการตรวจ' : '📊 Review status',
              value: th ? '⏳ รอแอดมินตรวจสอบและอนุมัติ' : '⏳ Waiting for admin review and approval',
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
          title: th ? '✅ อนุมัติการอัปเดตสเตตัสเรียบร้อย!' : '✅ Stats update approved!',
          description: th ? `สเตตัสของ **${data?.memberName}** ได้รับการอนุมัติ และค่าพลังอย่างเป็นทางการได้รับการอัปเดตแล้ว` : `**${data?.memberName}**'s stats were approved and the verified Power Level has been updated.`,
          color: 0x10b981, // Emerald
          fields: [
            {
              name: th ? '👤 สมาชิก' : '👤 Member',
              value: `**${data?.memberName}** (${cleanClanName(data?.memberClan) || 'VoltZ'})`,
              inline: true
            },
            {
              name: th ? '⚡ พลังรบอย่างเป็นทางการ' : '⚡ Verified Power Level',
              value: `**${next.toLocaleString()} PL**`,
              inline: true
            },
            {
              name: th ? '👑 ผู้ตรวจอนุมัติ' : '👑 Approved by',
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
    return { success: false, message: th ? 'เหตุการณ์หรือข้อมูลแจ้งเตือนไม่ถูกต้อง' : 'Invalid notification event or payload' };
  }

  // 1. Try local/backend proxy first
  try {
    const token = await getCurrentUserIdToken();
    const res = await fetch('/api/discord-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ payload })
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
  } catch (err: any) {
    console.error('Error sending discord notification:', err);
    return { success: false, message: th ? 'เกิดข้อผิดพลาดขณะส่งข้อความไป Discord' : 'Network error while sending the Discord notification' };
  }

  return { success: false, message: th ? 'เซิร์ฟเวอร์ปฏิเสธการแจ้งเตือน Discord' : 'The server rejected the Discord notification' };
}
