import { DiscordSettings, ItemRarity, VaultItem, DistributedInfo, Language, cleanClanName, DiscordMessageTemplate } from '../types';
import { getCurrentUserIdToken } from '../services/firebase';
import { DEFAULT_ITEM_ICON_BASE64 } from './defaultItemIcon';

export interface DiscordTemplateOption {
  id: DiscordMessageTemplate;
  name: Record<Language, string>;
  description: Record<Language, string>;
  badge: Record<Language, string>;
  accentColor: string;
}

export const DISCORD_TEMPLATES: DiscordTemplateOption[] = [
  {
    id: 'neon_glow',
    name: {
      th: '🌟 แฟนตาซีนีออนเรืองแสง (Radiant Neon)',
      en: '🌟 Radiant Neon Fantasy'
    },
    description: {
      th: 'กรอบข้อความสีนีออนเรืองแสงตามระดับไอเทม สวยเด่นตระการตา สไตล์ MMORPG',
      en: 'Radiant ANSI neon frame tailored to item rarity with glowing highlights'
    },
    badge: {
      th: 'เรืองแสง',
      en: 'Neon Glow'
    },
    accentColor: '#8500fd'
  },
  {
    id: 'war_horn',
    name: {
      th: '⚔️ ประกาศศึกคลังกิลด์ (Siege & War Alert)',
      en: '⚔️ Siege & War Vault Alert'
    },
    description: {
      th: 'สไตล์บัญชาการรบ ดุดัน แจ้งเตือนบอสและเปิดสิทธิ์เคลมเสริมทัพกิลด์',
      en: 'Tactical clan war theme alerting raid victory and claim readiness'
    },
    badge: {
      th: 'สงครามกิลด์',
      en: 'War Alert'
    },
    accentColor: '#ef4444'
  },
  {
    id: 'clan_market',
    name: {
      th: '🏛️ ตลาดประมูลคลังกิลด์ (Guild Merchant)',
      en: '🏛️ Guild Treasury & Market'
    },
    description: {
      th: 'สไตล์ตลาดประมูลปราสาทกีรัน เน้นราคาเพชร รายการไอเทม และสิทธิ์จัดสรร',
      en: 'Giran Castle market style highlighting diamond price and allocation'
    },
    badge: {
      th: 'ตลาดการค้า',
      en: 'Market'
    },
    accentColor: '#10b981'
  },
  {
    id: 'crystal_minimal',
    name: {
      th: '✨ คลีนมินิมอล (Clean & Minimal)',
      en: '✨ Clean & Minimal Elegance'
    },
    description: {
      th: 'การ์ด Embed สวยหรู ไม่มีกรอบโค้ดดำ เน้นความกระชับ อ่านง่าย สบายตา',
      en: 'Sleek embed with Discord blockquotes, zero code blocks, pure elegance'
    },
    badge: {
      th: 'มินิมอล',
      en: 'Clean'
    },
    accentColor: '#38bdf8'
  }
];

function getRarityColor(rarity: ItemRarity): number {
  switch (rarity) {
    case 'MYTHIC':
      return 0xffb800; // Radiant Neon Gold
    case 'LAGEND':
      return 0x8500fd; // Ultra Radiant Neon Violet (#8500fd)
    case 'EPIC':
      return 0xff1744; // Radiant Laser Red
    case 'RARE':
    default:
      return 0x00e5ff; // Radiant Diamond Cyan
  }
}

function getAnsiRarityCode(rarity: ItemRarity): string {
  switch (rarity) {
    case 'MYTHIC':
      return '\u001b[1;33m'; // Bold Gold / Yellow (🟨 MYTHIC)
    case 'LAGEND':
      return '\u001b[1;35m'; // Bold Purple / Magenta (🟪 LEGEND)
    case 'EPIC':
      return '\u001b[1;31m'; // Bold Red (🟥 EPIC)
    case 'RARE':
    default:
      return '\u001b[1;36m'; // Bold Cyan / Sky Blue (🟦 RARE)
  }
}

function buildTemplateDescription(
  template: DiscordMessageTemplate,
  item: VaultItem,
  claimLink: string,
  customNote?: string
): string {
  const displayRarity = item.rarity === 'LAGEND' ? 'LEGEND' : item.rarity;
  const ansiColor = getAnsiRarityCode(item.rarity);
  const qty = item.quantity || 1;
  const priceLabel = item.price > 0
    ? `${item.price.toLocaleString()} Diamonds`
    : 'FREE (0 Diamonds)';

  const noteLine = customNote?.trim() ? `\n💬 *Note: ${customNote.trim()}*` : '';
  const actionLine = claimLink
    ? `👉 [**Open Vault to Claim Item**](${claimLink})`
    : `👉 **Log in to Clan Hub to Claim**`;

  let header = '';
  switch (template) {
    case 'war_horn':
      header = `\u001b[1;31m⚔️ [WAR VAULT]\u001b[0m ${ansiColor}[${displayRarity}] ${item.name}\u001b[0m \u001b[1;37m(x${qty})\u001b[0m`;
      break;
    case 'clan_market':
      header = `\u001b[1;36m🏛️ [MARKET]\u001b[0m ${ansiColor}[${displayRarity}] ${item.name}\u001b[0m \u001b[1;37m(x${qty})\u001b[0m`;
      break;
    case 'crystal_minimal':
      header = `${ansiColor}⚔️ [${displayRarity}] ${item.name}\u001b[0m \u001b[1;37m(x${qty})\u001b[0m`;
      break;
    case 'neon_glow':
    default:
      header = `${ansiColor}[${displayRarity}] ${item.name}\u001b[0m \u001b[1;37m(x${qty})\u001b[0m`;
      break;
  }

  const ansiBlock = [
    '```ansi',
    header,
    `\u001b[1;37m💎 Price: ${priceLabel}\u001b[0m`,
    '```'
  ].join('\n');

  return `${ansiBlock}${noteLine}\n${actionLine}`;
}

function getValidDiscordImageUrl(url: string | undefined, rarity?: ItemRarity): string {
  if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.startsWith('data:')) {
    return url;
  }
  // High quality fantasy Lineage 2M / MMORPG style fallback artwork
  switch (rarity) {
    case 'MYTHIC':
      return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80';
    case 'LAGEND':
      return 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=128&auto=format&fit=crop&q=80';
    case 'EPIC':
      return 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80';
    case 'RARE':
    default:
      return 'https://images.unsplash.com/photo-1563089145-599997674d42?w=128&auto=format&fit=crop&q=80';
  }
}

function getItemImageBase64(imageUrl?: string): string {
  if (imageUrl && imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }
  return DEFAULT_ITEM_ICON_BASE64;
}

function getAttachmentExt(dataUrl?: string): string {
  if (!dataUrl) return 'jpg';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'jpg';
  if (dataUrl.startsWith('data:image/webp')) return 'webp';
  if (dataUrl.startsWith('data:image/png')) return 'png';
  return 'jpg';
}

/**
 * Send rich discord notification through backend proxy
 */
export async function sendDiscordNotification(
  settings: DiscordSettings,
  event: 'new_item' | 'distribute' | 'test',
  data?: {
    item?: VaultItem;
    distributeInfo?: DistributedInfo;
    actorName?: string;
    lang?: Language;
    webhookUrl?: string;
    template?: DiscordMessageTemplate;
    customNote?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  const lang = data?.lang || 'th';
  const th = lang === 'th';
  const template = data?.template || settings.messageTemplate || 'neon_glow';

  if (!settings.enabled) {
    return { success: false, message: th ? 'ปิดการใช้งาน Discord Webhook อยู่' : 'Discord Webhook is disabled' };
  }

  let payload: any = null;

  if (event === 'test') {
    const rawRoleId = settings.mentionRoleId ? settings.mentionRoleId.trim().replace(/\D/g, '') : '';
    const mentionType = settings.mentionType || (rawRoleId ? 'role' : settings.mentionEveryone !== false ? 'everyone' : 'none');
    let mentionDesc = 'None (Silent Mode)';
    if (mentionType === 'everyone') mentionDesc = '@everyone';
    else if (mentionType === 'role' && rawRoleId) mentionDesc = `<@&${rawRoleId}> (Role ID: ${rawRoleId})`;

    const templateMeta = DISCORD_TEMPLATES.find((t) => t.id === template) || DISCORD_TEMPLATES[0];

    const testItem: VaultItem = {
      id: 'test-item',
      name: "Breka's Soul",
      rarity: 'EPIC',
      price: 0,
      quantity: 1,
      minPowerLevel: 0,
      hunters: [
        { name: 'Zenkaii', clan: 'VoltZ' },
        { name: 'DVD', clan: 'LevelS' }
      ],
      hunterScreenshots: [],
      imageUrl: DEFAULT_ITEM_ICON_BASE64,
      status: 'available',
      createdAt: Date.now(),
      claimants: []
    };

    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const baseWebUrl = (settings.appBaseUrl || origin || '').replace(/\/$/, '');
    const sampleDesc = buildTemplateDescription(
      template,
      testItem,
      baseWebUrl,
      `Testing Connection (${templateMeta.name.en})`
    );

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: '🔔 Discord Webhook Test Successful!',
          description: sampleDesc,
          color: 0x10b981, // Emerald Green
          thumbnail: { url: 'attachment://item.jpg' },
          fields: [
            {
              name: '🎨 Active Template',
              value: `**${templateMeta.name.en}**`,
              inline: true
            },
            {
              name: '📢 Mention Mode',
              value: mentionDesc,
              inline: true
            },
            {
              name: '👤 Tested by',
              value: data?.actorName || 'Owner',
              inline: true
            }
          ],
          footer: {
            text: 'Lineage 2M Clan Hub • Connection Test'
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
    const displayRarity = item.rarity === 'LAGEND' ? 'LEGEND' : item.rarity;
    const qtyText = item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : '';

    // Direct Webapp claim link
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const baseWebUrl = (settings.appBaseUrl || origin || '').replace(/\/$/, '');
    const claimLink = baseWebUrl ? `${baseWebUrl}/?tab=dashboard&item=${encodeURIComponent(item.id)}` : '';

    // Option 1 Real Item Image Thumbnail logic:
    // 1. If valid web URL, use directly (clean, crisp, no sample overwrite)
    // 2. If data URI, attach binary
    // 3. If empty, use high-resolution rarity artwork
    let thumbnailObj: { url: string };
    if (item.imageUrl && (item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://')) && !item.imageUrl.startsWith('data:')) {
      thumbnailObj = { url: item.imageUrl };
    } else if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
      const itemExt = getAttachmentExt(item.imageUrl);
      thumbnailObj = { url: `attachment://item.${itemExt}` };
    } else {
      thumbnailObj = { url: getValidDiscordImageUrl(item.imageUrl, item.rarity) };
    }

    const description = buildTemplateDescription(template, item, claimLink, data?.customNote);

    // Determine mention strategy: 'everyone', specific 'role', or 'none'
    const rawRoleId = settings.mentionRoleId ? settings.mentionRoleId.trim().replace(/\D/g, '') : '';
    const mentionType = settings.mentionType || (rawRoleId ? 'role' : settings.mentionEveryone !== false ? 'everyone' : 'none');

    let mentionPrefix = '';
    let allowedMentions: { parse?: string[]; roles?: string[] } = { parse: [] };

    if (mentionType === 'everyone') {
      mentionPrefix = '@everyone ';
      allowedMentions = { parse: ['everyone'] };
    } else if (mentionType === 'role' && rawRoleId) {
      mentionPrefix = `<@&${rawRoleId}> `;
      allowedMentions = { roles: [rawRoleId] };
    }

    payload = {
      content: `${mentionPrefix}⚔️ **New Boss Item Added to Vault!**`.trim(),
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      allowed_mentions: allowedMentions,
      embeds: [
        {
          color: color,
          description: description,
          thumbnail: thumbnailObj,
          footer: {
            text: 'Lineage 2M Clan Hub • Guild Vault Alert'
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
    const displayRarity = item.rarity === 'LAGEND' ? 'LEGEND' : item.rarity;

    let thumbnailObj: { url: string };
    if (item.imageUrl && (item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://')) && !item.imageUrl.startsWith('data:')) {
      thumbnailObj = { url: item.imageUrl };
    } else if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
      const distExt = getAttachmentExt(item.imageUrl);
      thumbnailObj = { url: `attachment://item.${distExt}` };
    } else {
      thumbnailObj = { url: getValidDiscordImageUrl(item.imageUrl, item.rarity) };
    }

    const rarityBadge = {
      MYTHIC: '🟨 **MYTHIC**',
      LAGEND: '🪻 **LEGEND**',
      EPIC: '🟥 **EPIC**',
      RARE: '🟦 **RARE**'
    }[item.rarity] || `🟦 **${displayRarity}**`;

    payload = {
      username: settings.botName || 'Lineage 2M Clan Hub',
      avatar_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: `🏆 Item Distribution Result! [${displayRarity}] ${item.name}`,
          description: `Congratulations to **${dist.name}** of **${cleanClanName(dist.clan) || 'Alliance'}**, who received this item!`,
          color: color,
          thumbnail: thumbnailObj,
          fields: [
            {
              name: '👤 Recipient',
              value: `**${dist.name}**\n(${cleanClanName(dist.clan) || 'No Clan'})`,
              inline: true
            },
            {
              name: '📦 Rarity',
              value: rarityBadge,
              inline: true
            },
            {
              name: '💎 Item Value',
              value: item.price > 0
                ? `**${item.price.toLocaleString()} Diamonds**`
                : '**🎁 FREE (0 Diamonds)**',
              inline: true
            },
            {
              name: '👑 Distributed by',
              value: dist.distributedBy || data.actorName || 'Owner/Admin',
              inline: true
            }
          ],
          footer: {
            text: `Distributed at: ${new Date(dist.distributedAt).toLocaleString('en-US')} • Lineage 2M Clan Hub`
          },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else {
    // Non-item Discord notifications are strictly disabled per Rule 5
    return {
      success: true,
      message: th ? 'ปิดการแจ้งเตือนนอกเหนือจากไอเทม (ตามกฎ Rule 5)' : 'Non-item Discord notifications are disabled per Rule 5'
    };
  }

  if (!payload) {
    return { success: false, message: th ? 'เหตุการณ์หรือข้อมูลแจ้งเตือนไม่ถูกต้อง' : 'Invalid notification event or payload' };
  }

  // Determine binary image attachment if available
  let attachedImageBase64: string | undefined;
  const attachTo = 'thumbnail' as const;

  if (event === 'test') {
    attachedImageBase64 = DEFAULT_ITEM_ICON_BASE64;
  } else if ((event === 'new_item' || event === 'distribute') && data?.item) {
    if (data.item.imageUrl && data.item.imageUrl.startsWith('data:image/')) {
      attachedImageBase64 = data.item.imageUrl;
    }
  }

  const candidateWebhookUrl = data?.webhookUrl?.trim() || settings.webhookUrl?.trim() || '';
  let serverErrorMessage = '';

  // 1. Try local/backend proxy first (avoids CORS and uploads binary attachments cleanly)
  try {
    const token = await getCurrentUserIdToken();
    const res = await fetch('/api/discord-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        event,
        payload,
        imageBase64: attachedImageBase64 || undefined,
        attachTo: attachedImageBase64 ? attachTo : undefined,
        webhookUrl: candidateWebhookUrl || undefined
      })
    });

    const resText = await res.text();
    let result: any = null;
    try {
      result = JSON.parse(resText);
    } catch {}

    if (res.ok && result?.success) {
      return { success: true };
    }

    serverErrorMessage = result?.message || (th ? `เซิร์ฟเวอร์ตอบกลับรหัส ${res.status}` : `Server returned HTTP ${res.status}`);
  } catch (backendErr: any) {
    serverErrorMessage = backendErr?.message || (th ? 'ไม่สามารถเรียกใช้งาน Backend Proxy ได้' : 'Cannot reach backend proxy');
  }

  // Helper to convert base64 data URL to Blob for direct client upload
  const dataUrlToBlob = (dataUrl: string) => {
    try {
      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/s);
      if (!match) return null;
      const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
      const binary = atob(match[2]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return { blob: new Blob([array], { type: mime }), fileName: 'item.' + ext };
    } catch {
      return null;
    }
  };

  // 2. Direct browser fetch fallback (if candidate Webhook URL is available on client)
  if (candidateWebhookUrl && (candidateWebhookUrl.startsWith('https://discord.com/api/webhooks/') || candidateWebhookUrl.startsWith('https://discordapp.com/api/webhooks/'))) {
    try {
      let directReqBody: BodyInit;
      const directHeaders: Record<string, string> = {};

      if (attachedImageBase64) {
        const parsed = dataUrlToBlob(attachedImageBase64);
        if (parsed) {
          if (Array.isArray(payload.embeds) && payload.embeds.length > 0) {
            payload.embeds[0].thumbnail = { url: `attachment://${parsed.fileName}` };
          }
          const formData = new FormData();
          formData.append('payload_json', JSON.stringify({
            ...payload,
            allowed_mentions: payload.allowed_mentions !== undefined
              ? payload.allowed_mentions
              : { parse: ['everyone'] }
          }));
          formData.append('files[0]', parsed.blob, parsed.fileName);
          directReqBody = formData;
        } else {
          directHeaders['Content-Type'] = 'application/json';
          directReqBody = JSON.stringify({
            ...payload,
            allowed_mentions: payload.allowed_mentions !== undefined
              ? payload.allowed_mentions
              : { parse: ['everyone'] }
          });
        }
      } else {
        directHeaders['Content-Type'] = 'application/json';
        directReqBody = JSON.stringify({
          ...payload,
          allowed_mentions: payload.allowed_mentions !== undefined
            ? payload.allowed_mentions
            : { parse: ['everyone'] }
        });
      }

      const directRes = await fetch(candidateWebhookUrl, {
        method: 'POST',
        headers: directHeaders,
        body: directReqBody
      });

      if (directRes.ok) {
        return { success: true };
      }

      const directText = await directRes.text();
      console.warn('Direct Discord webhook delivery returned error status:', directRes.status, directText);
      let friendlyDirectMsg = th ? 'ส่งข้อความไป Discord ไม่สำเร็จ' : 'Failed to deliver message to Discord';
      if (directRes.status === 404) {
        friendlyDirectMsg = th
          ? 'ไม่พบ Webhook นี้ในเซิร์ฟเวอร์ Discord (URL อาจถูกลบใน Discord แล้ว)'
          : 'Discord Webhook not found (404) - check if deleted in Discord';
      } else if (directRes.status === 401 || directRes.status === 403) {
        friendlyDirectMsg = th
          ? 'Discord ปฏิเสธการเข้าถึง (Token ของ Webhook ไม่ถูกต้อง)'
          : 'Discord rejected webhook (401/403) - unauthorized';
      } else if (directRes.status === 429) {
        friendlyDirectMsg = th
          ? 'ส่งข้อความถี่เกินไป กรุณารอสักครู่ (Discord Rate Limit 429)'
          : 'Rate limited by Discord (429). Please wait a moment.';
      }
      return {
        success: false,
        message: `${friendlyDirectMsg} (${directRes.status})`
      };
    } catch (directErr: any) {
      console.warn('Direct browser fetch to Discord failed:', directErr);
    }
  }

  // 3. Return explicit server error message if present, or clear bilingual guidance
  if (serverErrorMessage) {
    return { success: false, message: serverErrorMessage };
  }

  return {
    success: false,
    message: th
      ? 'ยังไม่ได้ตั้งค่า Discord Webhook หรือเซิร์ฟเวอร์ปฏิเสธการเชื่อมต่อ (กรุณาตรวจสอบในการตั้งค่า Discord)'
      : 'Discord Webhook is not configured or server rejected the connection (Please check Discord settings).'
  };
}
