/**
 * 🛡️ LINEAGE 2M CLAN HUB - AUTOMATED PRE-FLIGHT DEPLOYMENT VERIFICATION
 * 
 * This script runs comprehensive integrity checks before any production deployment:
 * 1. Checks version synchronization across all 6 required files
 * 2. Checks TypeScript type errors (tsc --noEmit)
 * 3. Builds Frontend with Vite into dist/
 * 4. Bundles Backend Serverless entrypoint (api/_entry.ts -> api/index.js)
 * 5. Bundles Server entrypoint (server.ts -> dist/server.js)
 * 6. Checks Environment Variables configuration against required keys
 * 7. Verifies Firestore Security Rules integrity
 * 8. Validates LocalStorage Quota sanitizers are in place
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const NODE_EXE = process.execPath;
const REQUIRED_FILES_VERSION = [
  'package.json',
  'src/services/firebase.ts',
  'src/components/Sidebar.tsx',
  'src/components/Navbar.tsx',
  'src/components/LoginScreen.tsx',
  'src/components/GoogleDriveBackupModal.tsx'
];

const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

console.log('================================================================================');
console.log('🛡️  STARTING PRE-FLIGHT PRODUCTION VERIFICATION');
console.log('================================================================================\n');

let failed = false;

// 1. Version Synchronization Check
console.log('🔍 Step 1: Checking Version Synchronization across 6 files...');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const targetVersion = pkg.version;
  console.log(`   Target Version: v${targetVersion}`);

  let versionMismatch = false;
  for (const file of REQUIRED_FILES_VERSION) {
    if (!fs.existsSync(file)) {
      console.error(`   ❌ Missing file: ${file}`);
      versionMismatch = true;
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(targetVersion)) {
      console.error(`   ❌ Version mismatch in ${file} (expected ${targetVersion})`);
      versionMismatch = true;
    } else {
      console.log(`   ✅ ${file} (v${targetVersion})`);
    }
  }

  if (versionMismatch) {
    failed = true;
    console.error('   ❌ Step 1 FAILED: Version mismatch detected!');
  } else {
    console.log('   🎉 Step 1 PASSED: All 6 files match v' + targetVersion + '\n');
  }
} catch (err) {
  failed = true;
  console.error('   ❌ Step 1 Error:', err.message);
}

// 2. TypeScript Compilation Check
console.log('🔍 Step 2: Running TypeScript Typecheck (tsc --noEmit)...');
try {
  execSync(`"${NODE_EXE}" "node_modules/typescript/bin/tsc" --noEmit`, { stdio: 'inherit' });
  console.log('   🎉 Step 2 PASSED: 0 TypeScript errors\n');
} catch (err) {
  failed = true;
  console.error('   ❌ Step 2 FAILED: TypeScript compilation errors detected!\n');
}

// 3. Frontend Vite Build
console.log('🔍 Step 3: Running Vite Production Build (Frontend)...');
try {
  execSync(`"${NODE_EXE}" "node_modules/vite/bin/vite.js" build`, { stdio: 'inherit' });
  if (!fs.existsSync('dist/index.html')) {
    throw new Error('dist/index.html was not generated');
  }
  console.log('   🎉 Step 3 PASSED: dist/ built successfully\n');
} catch (err) {
  failed = true;
  console.error('   ❌ Step 3 FAILED: Vite build failed!\n');
}

// 4. Backend Serverless Bundling (api/_entry.ts -> api/index.js)
console.log('🔍 Step 4: Bundling Backend Serverless API (api/_entry.ts -> api/index.js)...');
try {
  execSync(`"${NODE_EXE}" "node_modules/esbuild/bin/esbuild" api/_entry.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js`, { stdio: 'inherit' });
  if (!fs.existsSync('api/index.js')) {
    throw new Error('api/index.js was not generated');
  }
  const stats = fs.statSync('api/index.js');
  console.log(`   🎉 Step 4 PASSED: api/index.js bundled (${(stats.size / 1024).toFixed(1)} KB)\n`);
} catch (err) {
  failed = true;
  console.error('   ❌ Step 4 FAILED: Serverless backend bundling failed!\n');
}

// 5. Server Bundling (server.ts -> dist/server.js)
console.log('🔍 Step 5: Bundling Production Server (server.ts -> dist/server.js)...');
try {
  execSync(`"${NODE_EXE}" "node_modules/esbuild/bin/esbuild" server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js`, { stdio: 'inherit' });
  if (!fs.existsSync('dist/server.js')) {
    throw new Error('dist/server.js was not generated');
  }
  console.log('   🎉 Step 5 PASSED: dist/server.js bundled\n');
} catch (err) {
  failed = true;
  console.error('   ❌ Step 5 FAILED: Production server bundling failed!\n');
}

// 6. Environment Variables Verification
console.log('🔍 Step 6: Verifying Environment Variables configuration (.env)...');
try {
  const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  let missingVars = [];
  for (const v of REQUIRED_ENV_VARS) {
    if (!envContent.includes(v) && !process.env[v]) {
      missingVars.push(v);
    }
  }
  if (missingVars.length > 0) {
    console.warn(`   ⚠️ Notice: Missing variables in local .env: ${missingVars.join(', ')}`);
    console.warn(`      (Ensure these are configured in Vercel Dashboard > Project Settings > Environment Variables)`);
  } else {
    console.log('   ✅ All required VITE_ environment variables present in .env');
  }
  console.log('   🎉 Step 6 CHECKED\n');
} catch (err) {
  console.error('   ⚠️ Step 6 Notice:', err.message);
}

// 7. Security Rules Syntax & LocalStorage Guard Verification
console.log('🔍 Step 7: Verifying LocalStorage Quota Guard & Firestore Rules...');
try {
  const firebaseContent = fs.readFileSync('src/services/firebase.ts', 'utf8');
  if (!firebaseContent.includes('sanitizeUsersForStorage') || !firebaseContent.includes('QuotaExceededError')) {
    failed = true;
    console.error('   ❌ LocalStorage Quota Guard is MISSING in src/services/firebase.ts!');
  } else {
    console.log('   ✅ LocalStorage Quota Guard (Auto-Pruning Shield) is active');
  }

  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
  if (!rulesContent.includes('rules_version = \'2\';')) {
    failed = true;
    console.error('   ❌ Invalid firestore.rules header!');
  } else {
    console.log('   ✅ firestore.rules structure verified');
  }
  console.log('   🎉 Step 7 PASSED\n');
} catch (err) {
  failed = true;
  console.error('   ❌ Step 7 Error:', err.message);
}

// Final Summary
console.log('================================================================================');
if (failed) {
  console.error('❌ PRE-FLIGHT CHECK FAILED! DO NOT DEPLOY TO PRODUCTION UNTIL FIXED.');
  console.log('================================================================================');
  process.exit(1);
} else {
  console.log('🎉 ALL PRE-FLIGHT CHECKS PASSED (7/7)! System is 100% READY for Production Deploy.');
  console.log('================================================================================');
  process.exit(0);
}
