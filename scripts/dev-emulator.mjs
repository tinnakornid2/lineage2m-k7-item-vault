import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VITE_USE_FIREBASE_EMULATORS: 'true',
    VITE_LOCAL_SAFE_MODE: 'true',
    LOCAL_SAFE_MODE: 'true',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'
  },
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
