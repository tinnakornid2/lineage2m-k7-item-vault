import { HunterRecord, User, cleanClanName } from '../types';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');

export async function scanHuntersLocally(images: string[], members: User[]): Promise<HunterRecord[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const textParts: string[] = [];
    for (const image of images.slice(0, 8)) {
      const result = await worker.recognize(image);
      textParts.push(result.data.text || '');
    }
    const haystack = normalize(textParts.join('\n'));
    const found = new Map<string, HunterRecord>();
    for (const member of members) {
      const name = member.inGameName?.trim();
      const key = normalize(name || '');
      if (key.length >= 3 && haystack.includes(key)) {
        found.set(key, { name, clan: cleanClanName(member.clan) || 'VoltZ' });
      }
    }
    return [...found.values()];
  } finally {
    await worker.terminate();
  }
}
