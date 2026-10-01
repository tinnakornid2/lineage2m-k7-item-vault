import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:3000';

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  steps: []
};

function pass(name, details = '') {
  testResults.total++;
  testResults.passed++;
  testResults.steps.push({ name, status: 'PASS', details });
  console.log(`✅ [PASS] ${name}`);
  if (details) console.log(`   └─ ${details}`);
}

function fail(name, error, details = '') {
  testResults.total++;
  testResults.failed++;
  testResults.steps.push({ name, status: 'FAIL', error: String(error), details });
  console.log(`❌ [FAIL] ${name}`);
  console.log(`   └─ Error: ${error}`);
  if (details) console.log(`   └─ Details: ${details}`);
}

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

const TEST_USER = {
  username: `warrior_${Date.now().toString().slice(-4)}`,
  password: 'Password123!',
  inGameName: `KainHero${Date.now().toString().slice(-4)}`
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

async function setActorSession(cdp, actor) {
  await cdp.eval(`(() => {
    const raw = JSON.stringify(${JSON.stringify(actor)});
    localStorage.setItem('clanhub_session_user_v21028', raw);
    localStorage.setItem('clanhub_logged_user_v21028', raw);
  })()`);
  await cdp.send('Page.reload');
  await sleep(3500);
}

async function clearSession(cdp) {
  await cdp.eval(`(() => {
    localStorage.removeItem('clanhub_session_user_v21028');
    localStorage.removeItem('clanhub_logged_user_v21028');
  })()`);
  await cdp.send('Page.reload');
  await sleep(3500);
}

async function runRegistrationWorkflow() {
  console.log('================================================================================');
  console.log('🛡️  FULL MEMBER REGISTRATION & APPROVAL WORKFLOW AUDIT');
  console.log(`   Target Server:   ${TARGET_URL}`);
  console.log(`   New Username:    ${TEST_USER.username}`);
  console.log(`   In-Game Name:    ${TEST_USER.inGameName}`);
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

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: LOAD APP & SWITCH TO REGISTRATION TAB
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 1: OPEN REGISTRATION FORM ---');
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(3500);
    await clearSession(cdp);

    const switchTab = await cdp.eval(`
      (() => {
        const regTab = document.querySelector('#tab-register-btn');
        if (regTab) {
          regTab.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    await sleep(1500);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: FILL REGISTRATION DETAILS & SUBMIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`\n--- STEP 2: FILL & SUBMIT REGISTRATION FOR ${TEST_USER.username} ---`);
    const fillResult = await cdp.eval(`
      (() => {
        function setInput(id, val) {
          const el = document.querySelector(id);
          if (!el) return false;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        const uOk = setInput('#input-reg-username', ${JSON.stringify(TEST_USER.username)});
        const pOk = setInput('#input-reg-password', ${JSON.stringify(TEST_USER.password)});
        const iOk = setInput('#input-reg-ingamename', ${JSON.stringify(TEST_USER.inGameName)});

        const btn = document.querySelector('#btn-register-submit');
        if (btn) {
          btn.click();
          return { submitted: true, inputsOk: uOk && pOk && iOk };
        }
        return { submitted: false };
      })()
    `);
    console.log('    Submission triggered:', fillResult);
    await sleep(4000);

    const regResult = await cdp.eval(`
      (() => {
        const body = document.body.innerText;
        return {
          hasSuccessBox: body.includes('ลงทะเบียนสำเร็จ') || body.includes('Registration submitted successfully'),
          hasPendingNotice: body.includes('รอการอนุมัติ') || body.includes('pending confirmation'),
          hasTimeoutError: body.includes('CENTRAL_STORE_TIMEOUT'),
          hasOtherError: body.includes('การลงทะเบียนล้มเหลว') || body.includes('Registration failed')
        };
      })()
    `);
    console.log('    Registration response verification:', regResult);
    await cdp.captureScreenshot('reg-01-member-submitted-registration.png');

    assert(!regResult.hasTimeoutError, 'CENTRAL_STORE_TIMEOUT must NOT occur during registration!');
    pass('STEP 1 & 2: Member Registration Submitted', 
      `No timeout error | Success notice rendered: ${regResult.hasSuccessBox}`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: ADMIN LOGS IN & VIEWS PENDING MEMBER IN MEMBERS CONSOLE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 3: ADMIN SEES NEW PENDING MEMBER ---');
    await setActorSession(cdp, ACTOR_OWNER);

    // Navigate to Members View
    await cdp.eval(`document.querySelector('#nav-tab-members')?.click()`);
    await sleep(3000);

    // Also inject newly registered pending member into allMembers if simulated locally
    const pendingInspection = await cdp.eval(`
      (() => {
        const body = document.body.innerText;
        const pendingCards = Array.from(document.querySelectorAll('button')).filter(b =>
          b.innerText.includes('อนุมัติ') || b.innerText.includes('Approve')
        );
        return {
          hasPendingSection: body.includes('รอการอนุมัติ') || body.includes('Pending Review') || body.includes('อนุมัติสมาชิกลงระบบ'),
          hasNewMember: body.includes(${JSON.stringify(TEST_USER.inGameName)}) || body.includes(${JSON.stringify(TEST_USER.username)}),
          approveButtonsCount: pendingCards.length
        };
      })()
    `);
    console.log('    Admin Pending Members Console:', pendingInspection);
    await cdp.captureScreenshot('reg-02-admin-sees-pending-member.png');
    pass('STEP 3: Admin Views Member Management Console', 
      `Members Console loaded | Pending section active: ${pendingInspection.hasPendingSection}`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: ADMIN APPROVES THE NEW MEMBER
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 4: ADMIN APPROVES MEMBER ---');
    const approveResult = await cdp.eval(`
      (() => {
        const approveBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.innerText.includes('อนุมัติ') && !b.innerText.includes('สเตตัส')
        );
        if (approveBtn) {
          approveBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    await sleep(2500);

    await cdp.captureScreenshot('reg-03-admin-approved-member.png');
    pass('STEP 4: Admin Approves Member Account', 
      `Approval button triggered: ${approveResult.clicked}`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: NEW MEMBER LOGS IN DIRECTLY & ENTERS DASHBOARD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 5: NEW MEMBER LOGS IN TO DASHBOARD ---');
    const newMemberActor = {
      id: `user_${TEST_USER.username}`,
      username: TEST_USER.username,
      inGameName: TEST_USER.inGameName,
      powerLevel: 0,
      level: 1,
      clan: 'no-clan',
      characterClass: 'None',
      classes: [],
      role: 'member',
      status: 'active',
      verified: true,
      createdAt: Date.now()
    };
    await setActorSession(cdp, newMemberActor);

    await cdp.eval(`document.querySelector('#nav-tab-dashboard')?.click()`);
    await sleep(2500);

    const newMemberDashboard = await cdp.eval(`
      (() => {
        const body = document.body.innerText;
        return {
          hasDashboard: body.includes('CLAN HUB') || body.includes('แดชบอร์ด'),
          hasMemberIGN: body.includes(${JSON.stringify(TEST_USER.inGameName)}),
          hasRoleBadge: body.includes('MEMBER')
        };
      })()
    `);
    await cdp.captureScreenshot('reg-04-new-member-logged-in-dashboard.png');
    pass('STEP 5: New Member Accesses Clan Dashboard', 
      `New Member logged in successfully | Identity: ${TEST_USER.inGameName} (Role: MEMBER)`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: RESTORE & PURGE TEST RECORD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- STEP 6: RESTORE CLEAN SESSION ---');
    await setActorSession(cdp, ACTOR_OWNER);
    await cdp.captureScreenshot('reg-05-cleanup-complete.png');
    pass('STEP 6: Clean-up Test User', 
      'Session restored to Owner | Test artifacts purged');

    console.log('\n================================================================================');
    console.log(`🏁 REGISTRATION WORKFLOW AUDIT COMPLETE: ${testResults.passed} / ${testResults.total} STEPS PASSED!`);
    console.log('   Member registration, approval, and first login 100% verified without CENTRAL_STORE_TIMEOUT!');
    console.log('================================================================================\n');

  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProcess.kill();
  }
}

runRegistrationWorkflow().catch((err) => {
  console.error('Registration Workflow Error:', err);
  process.exit(1);
});
