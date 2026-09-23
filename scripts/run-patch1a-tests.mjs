import { spawn } from 'node:child_process';

const nodePath = process.execPath;
const firebaseBin = 'node_modules/firebase-tools/lib/bin/firebase.js';
const testScript = 'tests/patch-1a-verification.test.mjs';

const cmd = `"${nodePath}" node_modules/tsx/dist/cli.mjs --test ${testScript}`;

const child = spawn(nodePath, [firebaseBin, 'emulators:exec', '--only', 'firestore', cmd], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_USE_FIREBASE_EMULATORS: 'true',
    VITE_LOCAL_SAFE_MODE: 'true',
    LOCAL_SAFE_MODE: 'true',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'
  }
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
