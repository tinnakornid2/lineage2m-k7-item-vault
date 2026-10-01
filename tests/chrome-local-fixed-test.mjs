import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:3000/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
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

async function runBrowserTest() {
  console.log('================================================================================');
  console.log('🖥️  GOOGLE CHROME BROWSER TEST (TESTING FIX ON LOCAL SERVER v2.10.69)');
  console.log(`   Browser Executable: ${CHROME_PATH}`);
  console.log(`   Navigating to:      ${TARGET_URL}`);
  console.log('================================================================================\n');

  // 1. Launch Chrome
  console.log('[1] Launching Google Chrome process on port 9222...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,900'
  ], { stdio: 'ignore' });

  process.on('exit', () => chromeProcess.kill());

  let cdp = null;
  try {
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch {}
    }

    if (!versionData) {
      throw new Error('Failed to connect to Chrome DevTools Protocol at http://127.0.0.1:9222');
    }
    console.log(`✅ Connected to Google Chrome! Browser: ${versionData.Browser}`);

    const newTabRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
    const tabData = await newTabRes.json();
    console.log(`✅ Created Browser Tab: ${tabData.id}`);

    cdp = new CDPClient(tabData.webSocketDebuggerUrl);
    await cdp.waitOpen();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // 2. Navigate to Local Site
    console.log(`\n[2] Navigating Chrome to: ${TARGET_URL}...`);
    await cdp.send('Page.navigate', { url: TARGET_URL });

    console.log('    Waiting for page render & React mounting...');
    let isReady = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const ready = await cdp.eval('Boolean(document.querySelector("#tab-register-btn"))');
      if (ready) {
        isReady = true;
        break;
      }
    }

    const pageTitle = await cdp.eval('document.title');
    console.log(`✅ Page Title in browser: "${pageTitle}"`);

    const appVersion = await cdp.eval(`
      (() => {
        const badges = Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim());
        return badges.find(b => b.startsWith('v2.10.')) || 'unknown';
      })()
    `);
    console.log(`   App Version displayed on screen: "${appVersion}"`);

    // 3. Switch to Register Mode
    console.log('\n[3] Clicking "สมัครสมาชิก" (Register Tab) button...');
    const switchTab = await cdp.eval(`
      (() => {
        const btn = document.querySelector('#tab-register-btn') || 
          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('สมัครสมาชิก') || b.innerText.includes('Register'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    assert.ok(switchTab, 'Register tab button must exist');
    await sleep(800);

    // 4. Fill in Registration Form
    const randomSuffix = Math.floor(Math.random() * 89999 + 10000);
    const testUsername = `fixed_${randomSuffix}`;
    const testPassword = `FixedPass_${randomSuffix}!`;
    const testIGN = `HeroFixed_${randomSuffix}`;

    console.log(`\n[4] Typing form inputs on screen:`);
    console.log(`    - Username:    ${testUsername}`);
    console.log(`    - IGN:         ${testIGN}`);
    console.log(`    - Password:    ${testPassword.replace(/./g, '*')}`);

    const fillResult = await cdp.eval(`
      (() => {
        function setInput(selector, val) {
          const el = document.querySelector(selector);
          if (!el) return false;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        const u = setInput('#input-reg-username', ${JSON.stringify(testUsername)});
        const p = setInput('#input-reg-password', ${JSON.stringify(testPassword)});
        const ign = setInput('#input-reg-ingamename', ${JSON.stringify(testIGN)});
        return { u, p, ign };
      })()
    `);
    console.log(`   Input Fields filled:`, fillResult);

    // 5. Click Submit Button
    console.log('\n[5] Clicking "ยืนยันการสมัครสมาชิก" (Submit Registration) button...');
    const submitResult = await cdp.eval(`
      (() => {
        const btn = document.querySelector('#btn-register-submit') || 
          Array.from(document.querySelectorAll('button[type="submit"]')).find(b => b.innerText.includes('สมัคร') || b.innerText.includes('Register'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log(`   Submit button clicked: ${submitResult}`);

    // 6. Observe Response on Screen with high-resolution timer
    console.log('\n[6] Observing real-time response on screen...');
    const startTime = Date.now();
    let finalState = null;
    let elapsedMs = 0;

    for (let check = 1; check <= 30; check++) {
      await sleep(200);
      elapsedMs = Date.now() - startTime;
      const state = await cdp.eval(`
        (() => {
          const successBox = document.querySelector('.bg-emerald-950\\\\/70');
          const errorBox = document.querySelector('.bg-red-950\\\\/70');
          const submitBtn = document.querySelector('#btn-register-submit');
          return {
            hasSuccess: Boolean(successBox),
            successText: successBox ? successBox.innerText : null,
            hasError: Boolean(errorBox),
            errorText: errorBox ? errorBox.innerText : null,
            isSubmitting: submitBtn ? submitBtn.innerText.includes('กำลัง') || submitBtn.innerText.includes('Loading') : false
          };
        })()
      `);
      console.log(`   [T+${elapsedMs}ms] UI State: isSubmitting=${state.isSubmitting}, hasSuccess=${state.hasSuccess}, hasError=${state.hasError}`);
      if (state.hasSuccess || state.hasError) {
        finalState = state;
        break;
      }
    }
    console.log(`⏱️ Total round-trip registration time: ${elapsedMs}ms (~${(elapsedMs / 1000).toFixed(2)} seconds)`);

    // 7. Capture Full Page Screenshot
    console.log('\n[7] Capturing screenshot of fixed version...');
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.resolve('tests/local-fixed-registration-result.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // 8. Capture Final Result Analysis
    const finalDomState = await cdp.eval(`
      (() => {
        const text = document.body.innerText;
        return {
          includesCentralStoreTimeout: text.includes('CENTRAL_STORE_TIMEOUT'),
          includesSuccess: text.includes('ลงทะเบียนสำเร็จ') || text.includes('Registration submitted successfully'),
          bodySnippet: text.substring(0, 400)
        };
      })()
    `);

    console.log('\n================================================================================');
    console.log('🏁 BROWSER OBSERVATION SUMMARY (WITH FIX APPLIED):');
    console.log(`   App Version:                    ${appVersion}`);
    console.log(`   CENTRAL_STORE_TIMEOUT observed: ${finalDomState.includesCentralStoreTimeout ? 'YES' : '✅ NO (ZERO ERROR)'}`);
    console.log(`   Success message observed:       ${finalDomState.includesSuccess ? '✅ YES (SUCCESS BOX DISPLAYED)' : 'NO'}`);
    console.log('================================================================================\n');

  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProcess.kill();
  }
}

runBrowserTest().catch((e) => {
  console.error('Browser Test Error:', e);
  process.exit(1);
});
