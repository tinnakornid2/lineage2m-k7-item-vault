// Isolated UI fixture: no Firebase, credentials, API calls, or production data.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StatRoundPanel } from '../src/components/StatRoundPanel';
import type { StatUpdateSettings, User } from '../src/types';
import '../src/index.css';

const now = Date.now();
const initial: StatUpdateSettings = { allowMemberUpdates: true, round: { id: 'fixture', openedAt: now - 1000, enforceAt: now + 86400000, active: true } };
const members = [
  { id: 'a', inGameName: 'Approved member', status: 'active', approvedStatRequestAt: now, statApprovalAt: now },
  { id: 'b', inGameName: 'Pending member', status: 'active', pendingPowerLevel: 100, pendingPowerLevelRequestedAt: now },
  { id: 'c', inGameName: 'Missing member', status: 'active' },
  { id: 'd', inGameName: 'Rejected member', status: 'active', pendingPowerLevelRequestedAt: now - 500, statRejectionAt: now }
] as User[];
function Preview() {
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const [settings, setSettings] = useState(initial);
  return <main className="min-h-screen bg-slate-950 p-4 text-white">
    <button onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>{lang === 'th' ? 'English' : 'ภาษาไทย'}</button>
    <StatRoundPanel users={members} settings={settings} lang={lang} onChange={async enforceAt => {
      setSettings({ allowMemberUpdates: true, round: enforceAt === null ? { ...settings.round!, active: false } : { id: 'local-preview', openedAt: Date.now(), enforceAt, active: true } });
    }} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
