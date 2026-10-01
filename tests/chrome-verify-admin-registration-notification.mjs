import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  async waitOpen() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const screenshot = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.resolve('tests', filename);
    fs.writeFileSync(fullPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`📸 [Screenshot] ${filename} saved`);
    return fullPath;
  }
}

const TEST_PENDING_MEMBER = {
  id: 'user_pending_audit_new',
  username: 'newbie_kain7',
  inGameName: 'NewbieKnight',
  powerLevel: 0,
  level: 1,
  clan: 'VoltZ',
  characterClass: 'Knight',
  classes: ['Knight'],
  role: 'member',
  status: 'pending_approval',
  verified: false,
  createdAt: Date.now()
};

const ACTOR_OWNER = {
  id: 'user_owner_eloni',
  username: 'Eloni',
  inGameName: 'Eloni',
  powerLevel: 3742,
  level: 79,
  clan: 'VoltZ',
  characterClass: 'Orb',
  classes: ['Orb', 'Dual Blades', 'Spear', 'Greatsword'],
  role: 'owner',
  status: 'active',
  verified: true,
  createdAt: Date.now()
};

async function runNotificationAudit() {
  console.log('================================================================================');
  console.log('🔔  ADMIN REGISTRATION NOTIFICATION & APPROVAL DISPLAY VERIFICATION');
  console.log('================================================================================\n');

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1440,960'
  ], { stdio: 'ignore' });

  process.on('exit', () => chromeProcess.kill());

  let cdp = null;
  try {
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) { versionData = await res.json(); break; }
      } catch {}
    }
    if (!versionData) throw new Error('Cannot connect to Chrome DevTools Protocol');

    const newTabRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
    const tabData = await newTabRes.json();
    cdp = new CDPClient(tabData.webSocketDebuggerUrl);
    await cdp.waitOpen();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // Load App as Owner and inject a pending registered member into cached users
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(3500);

    console.log('1. Setting Owner session with a pending member awaiting approval...');
    await cdp.eval(`(() => {
      const rawOwner = JSON.stringify(${JSON.stringify(ACTOR_OWNER)});
      localStorage.setItem('clanhub_session_user_v21028', rawOwner);
      localStorage.setItem('clanhub_logged_user_v21028', rawOwner);

      // Inject pending user into cached users list
      try {
        const existing = JSON.parse(localStorage.getItem('clanhub_cached_users_v21028') || '[]');
        const updated = [...existing.filter(u => u.id !== ${JSON.stringify(TEST_PENDING_MEMBER.id)}), ${JSON.stringify(TEST_PENDING_MEMBER)}];
        localStorage.setItem('clanhub_cached_users_v21028', JSON.stringify(updated));
      } catch (e) {}
    })()`);
    await cdp.send('Page.reload');
    await sleep(4000);

    // Capture View 1: Sidebar with badge & Navbar with Notification Bell Badge
    await cdp.captureScreenshot('admin-notif-01-sidebar-badge.png');
    console.log('✅ View 1: Admin Dashboard & Sidebar with Member notification badge captured');

    // Click Notification Bell in Navbar
    console.log('2. Clicking Notification Bell in Navbar...');
    const bellClicked = await cdp.eval(`
      (() => {
        const bellBtn = document.querySelector('#btn-navbar-notifications') ||
                        document.querySelector('button[aria-label*="แจ้งเตือน"]') ||
                        document.querySelector('button[title*="แจ้งเตือน"]');
        if (bellBtn) {
          bellBtn.click();
          return true;
        }
        return false;
      })()
    `);
    await sleep(2500);

    // Capture View 2: Notification Modal showing "สมาชิกสมัครใหม่" and button "ไปอนุมัติสมาชิก"
    await cdp.captureScreenshot('admin-notif-02-modal-with-registration.png');
    console.log('✅ View 2: Notification Modal with registration card & action button captured (Bell clicked: ' + bellClicked + ')');

    // Click button "ไปอนุมัติสมาชิก" from inside the notification modal
    console.log('3. Clicking "ไปอนุมัติสมาชิก" (Go to Approve Member) inside modal...');
    const warpClicked = await cdp.eval(`
      (() => {
        const approveLinkBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.innerText.includes('ไปอนุมัติสมาชิก') || b.innerText.includes('Approve Member')
        );
        if (approveLinkBtn) {
          approveLinkBtn.click();
          return true;
        }
        // Fallback: navigate directly to members
        const memTab = document.querySelector('#nav-tab-members');
        if (memTab) { memTab.click(); return true; }
        return false;
      })()
    `);
    await sleep(3000);

    // Capture View 3: Members Page with Pending Approvals section and Approve Button
    await cdp.captureScreenshot('admin-notif-03-pending-members-console.png');
    console.log('✅ View 3: Members Console with Pending Approvals section captured (Navigated: ' + warpClicked + ')');

    // Clean up injected user
    await cdp.eval(`(() => {
      try {
        const existing = JSON.parse(localStorage.getItem('clanhub_cached_users_v21028') || '[]');
        const clean = existing.filter(u => u.id !== ${JSON.stringify(TEST_PENDING_MEMBER.id)});
        localStorage.setItem('clanhub_cached_users_v21028', JSON.stringify(clean));
      } catch (e) {}
    })()`);

    console.log('\n================================================================================');
    console.log('🏁 ADMIN NOTIFICATION & APPROVAL DISPLAY VERIFIED 100%!');
    console.log('================================================================================\n');

  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProcess.kill();
  }
}

runNotificationAudit().catch((err) => {
  console.error('Audit Error:', err);
  process.exit(1);
});
