import { spawn } from 'node:child_process';
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
}

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

async function runBenchmark() {
  console.log('================================================================================');
  console.log('⚡  FULL-STACK LATENCY & MILLISECOND SPEED BENCHMARK');
  console.log(`   Target Server: ${TARGET_URL}`);
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

    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(3500);

    // Set Owner session
    await cdp.eval(`(() => {
      const raw = JSON.stringify(${JSON.stringify(ACTOR_OWNER)});
      localStorage.setItem('clanhub_session_user_v21028', raw);
      localStorage.setItem('clanhub_logged_user_v21028', raw);
    })()`);
    await cdp.send('Page.reload');
    await sleep(3500);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: LocalStorage Cache Read & Write Speed (Client Memory)
    // ─────────────────────────────────────────────────────────────────────────
    const storageBenchmark = await cdp.eval(`
      (() => {
        const iters = 100;
        const testData = JSON.stringify({ test: 'latency_probe', items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: 'Item ' + i })) });
        
        const tWrite0 = performance.now();
        for (let i = 0; i < iters; i++) {
          localStorage.setItem('benchmark_probe', testData);
        }
        const writeMs = (performance.now() - tWrite0) / iters;

        const tRead0 = performance.now();
        for (let i = 0; i < iters; i++) {
          const _ = localStorage.getItem('benchmark_probe');
        }
        const readMs = (performance.now() - tRead0) / iters;
        localStorage.removeItem('benchmark_probe');

        return { writeMs, readMs };
      })()
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Tab Navigation & View Render Latency (DOM React Rendering)
    // ─────────────────────────────────────────────────────────────────────────
    const tabBenchmark = await cdp.eval(`
      (async () => {
        const tabs = ['#nav-tab-vault', '#nav-tab-members', '#nav-tab-clans', '#nav-tab-my_stats', '#nav-tab-dashboard'];
        const results = [];
        for (const sel of tabs) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const t0 = performance.now();
          el.click();
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const renderMs = performance.now() - t0;
          results.push({ tab: sel, renderMs });
        }
        return results;
      })()
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Modal Open & Backdrop Transition Latency
    // ─────────────────────────────────────────────────────────────────────────
    const modalBenchmark = await cdp.eval(`
      (async () => {
        const bell = document.querySelector('button[aria-label*="แจ้งเตือน"]') || 
                     document.querySelector('button[title*="แจ้งเตือน"]');
        if (!bell) return null;
        const t0 = performance.now();
        bell.click();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const openMs = performance.now() - t0;
        
        // Close modal
        const closeBtn = document.querySelector('button[aria-label="Close"]') ||
                         Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ปิด'));
        if (closeBtn) closeBtn.click();
        return { openMs };
      })()
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Live State Relay Round-Trip Latency (Network Sync Layer)
    // ─────────────────────────────────────────────────────────────────────────
    const relayBenchmark = await cdp.eval(`
      (async () => {
        const iters = 5;
        const times = [];
        for (let i = 0; i < iters; i++) {
          const t0 = performance.now();
          const res = await fetch('/api/live-state?v=0&_t=' + Date.now());
          await res.json();
          times.push(performance.now() - t0);
        }
        return {
          avg: times.reduce((a, b) => a + b, 0) / iters,
          min: Math.min(...times),
          max: Math.max(...times)
        };
      })()
    `);

    console.log('📊 BENCHMARK METRICS SUMMARY:');
    console.log('--------------------------------------------------------------------------------');
    console.log(`1. Local Cache Read:          ${storageBenchmark.readMs.toFixed(3)} ms (ระดับไมโครวินาที)`);
    console.log(`2. Local Cache Write:         ${storageBenchmark.writeMs.toFixed(3)} ms (ระดับมิลลิวินาที < 1ms)`);
    console.log('3. React Tab Switching:');
    tabBenchmark.forEach(t => {
      console.log(`   - Tab ${t.tab.padEnd(20)}: ${t.renderMs.toFixed(2)} ms`);
    });
    const avgTab = tabBenchmark.reduce((a, b) => a + b.renderMs, 0) / tabBenchmark.length;
    console.log(`   ➜ เฉลี่ยการสลับหน้าจอ:       ${avgTab.toFixed(2)} ms`);
    if (modalBenchmark) {
      console.log(`4. Modal Popup เปิดทันที:       ${modalBenchmark.openMs.toFixed(2)} ms`);
    }
    console.log(`5. Cloud Live Relay Round-Trip: min ${relayBenchmark.min.toFixed(2)} ms | avg ${relayBenchmark.avg.toFixed(2)} ms`);
    console.log('--------------------------------------------------------------------------------');

  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProcess.kill();
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
