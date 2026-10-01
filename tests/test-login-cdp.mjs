import { spawn } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'https://lineage2m-k7-item-vault.vercel.app/';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const cp = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu'
  ], { stdio: 'ignore' });

  process.on('exit', () => cp.kill());
  await sleep(1500);

  const tabs = await (await fetch('http://127.0.0.1:9222/json')).json();
  const wsUrl = tabs[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const cur = id++;
    const handler = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === cur) { ws.removeEventListener('message', handler); res(m.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method, params }));
  });

  await send('Page.navigate', { url: TARGET_URL });
  
  // Wait for login inputs
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const r = await send('Runtime.evaluate', { expression: 'Boolean(document.querySelector("#input-login-username"))' });
    if (r.result?.value) {
      ready = true;
      break;
    }
  }
  console.log('Login form ready:', ready);

  // Fill inputs
  const fill = await send('Runtime.evaluate', {
    expression: `(() => {
      const u = document.querySelector('#input-login-username');
      const p = document.querySelector('#input-login-password');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter.call(u, 'eloni');
      u.dispatchEvent(new Event('input', { bubbles: true }));
      u.dispatchEvent(new Event('change', { bubbles: true }));

      setter.call(p, '123456');
      p.dispatchEvent(new Event('input', { bubbles: true }));
      p.dispatchEvent(new Event('change', { bubbles: true }));
      return { uVal: u.value, pVal: p.value };
    })()`,
    returnByValue: true
  });
  console.log('Filled inputs:', fill.result?.value);

  // Submit via form.requestSubmit()
  const sub = await send('Runtime.evaluate', {
    expression: `(() => {
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
        return 'form.requestSubmit() called';
      }
      return 'form not found';
    })()`,
    returnByValue: true
  });
  console.log('Submitted:', sub.result?.value);

  for (let s = 1; s <= 10; s++) {
    await sleep(1000);
    const state = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          aside: Boolean(document.querySelector('aside')),
          nav: Boolean(document.querySelector('nav')),
          tabLogin: Boolean(document.querySelector('#tab-login-btn')),
          err: document.querySelector('.bg-red-950\\/70')?.innerText || null,
          title: document.title
        };
      })()`,
      returnByValue: true
    });
    console.log(`[T+${s}s]`, state.result?.value);
    if (state.result?.value?.aside || state.result?.value?.nav || !state.result?.value?.tabLogin) {
      console.log('✅ LOGGED IN SUCCESSFULLY TO LIVE DASHBOARD!');
      break;
    }
  }

  ws.close();
  cp.kill();
}

test().catch(console.error);
