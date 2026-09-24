import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
});

const customDbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
  ? config.firestoreDatabaseId
  : undefined;

const db = customDbId ? getFirestore(app, customDbId) : getFirestore(app);

// Diamond Net Calculation Helper
function calculateDiamondNetChange(record) {
  const type = record.type;
  const netAmount = record.netAmount;
  const amount = record.amount;
  if (type === 'credit' || type === 'deposit') {
    return typeof netAmount === 'number' ? netAmount : (typeof amount === 'number' ? amount : 0);
  }
  if (type === 'deduction' || type === 'withdraw' || type === 'expenditure') {
    const raw = typeof netAmount === 'number' ? netAmount : (typeof amount === 'number' ? amount : 0);
    return -Math.abs(raw);
  }
  if (type === 'adjust') {
    return typeof netAmount === 'number' ? netAmount : (typeof amount === 'number' ? amount : 0);
  }
  return 0;
}

async function runProductionForensics() {
  console.log('=== PRODUCTION DIAMOND VAULT FORENSICS (READ-ONLY) ===\n');
  console.log(`Connecting to Project: ${config.projectId}, Database: ${customDbId || '(default)'}`);

  const snap = await getDocs(collection(db, 'diamond_vault'));
  console.log(`\nTotal diamond_vault documents in Production: ${snap.size}`);

  const records = [];
  snap.forEach((docSnap) => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });

  // Sort chronological ascending for balance calculation
  records.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

  let runningBalance = 0;
  console.log('\n--- ALL CURRENT DIAMOND VAULT RECORDS ---');
  for (const r of records) {
    const net = calculateDiamondNetChange(r);
    runningBalance += net;
    const dateStr = new Date(r.timestamp || 0).toISOString();
    console.log(`[${r.id}] Timestamp: ${r.timestamp} (${dateStr}) | Type: ${r.type} | Amount: ${r.amount} (Net: ${net}) | BalanceAfter: ${r.balanceAfter} | Note: "${r.note}" | PerformedBy: ${JSON.stringify(r.performedBy)}`);
  }

  console.log(`\nCalculated Authoritative Total Balance: ${runningBalance.toLocaleString()} Diamonds`);

  if (records.length > 0) {
    const newest = records[records.length - 1];
    console.log(`\nNewest Record: [${newest.id}] at ${newest.timestamp} (${new Date(newest.timestamp).toISOString()})`);
    console.log(`Newest Record Details:`, JSON.stringify(newest, null, 2));
  } else {
    console.log('\nNo records found in diamond_vault collection.');
  }

  // Check if any deduction/withdrawal exists
  const deductions = records.filter((r) => r.type === 'deduction' || r.type === 'withdraw' || r.type === 'expenditure');
  console.log(`\nTotal deduction/withdrawal records found: ${deductions.length}`);
  for (const d of deductions) {
    console.log(`  - [${d.id}] ${d.type} ${d.amount} at ${new Date(d.timestamp).toISOString()} by ${JSON.stringify(d.performedBy)} note: "${d.note}"`);
  }

  // Check app_settings if there's any vault balance override doc
  try {
    const settingsSnap = await getDoc(doc(db, 'app_settings', 'diamond_vault'));
    if (settingsSnap.exists()) {
      console.log('\nFound app_settings/diamond_vault:', JSON.stringify(settingsSnap.data()));
    } else {
      console.log('\nNo app_settings/diamond_vault document.');
    }
  } catch (err) {
    console.log('\nNotice on app_settings check:', err.message);
  }

  // Also check default database if customDbId was used
  if (customDbId) {
    try {
      const defaultDb = getFirestore(app);
      const defaultSnap = await getDocs(collection(defaultDb, 'diamond_vault'));
      console.log(`\n(For comparison) Total diamond_vault documents in '(default)' database: ${defaultSnap.size}`);
    } catch (err) {
      console.log(`\nDefault database check notice:`, err.message);
    }
  }
}

runProductionForensics().catch(console.error);
