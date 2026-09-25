import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'k7-item';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-lineage2mclanhub-4a1794d8-f944-422f-945e-56c12057ad13';
const useEmulators = process.env.K7_USE_EMULATORS === 'true';
const apply = process.argv.includes('--apply');

if (apply && process.env.K7_MIGRATION_CONFIRM !== 'MIGRATE_AUTH_AND_CLAIMS') {
  throw new Error('Set K7_MIGRATION_CONFIRM=MIGRATE_AUTH_AND_CLAIMS before using --apply.');
}

if (useEmulators) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
}

const app = initializeApp(
  useEmulators
    ? { projectId: PROJECT_ID }
    : { credential: applicationDefault(), projectId: PROJECT_ID },
  `k7-migration-${Date.now()}`
);
const auth = getAuth(app);
const db = useEmulators ? getFirestore(app) : getFirestore(app, DATABASE_ID);

function usernameToAuthEmail(username) {
  return `${Buffer.from(username.trim().toLowerCase(), 'utf8').toString('hex')}@auth.k7-clan.local`;
}

async function findAuthUser(uid) {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  usersScanned: 0,
  authUsersToCreate: 0,
  authUsersCreated: 0,
  existingAuthUsers: 0,
  existingAuthUsersUpdated: 0,
  usersMissingPassword: 0,
  passwordsRemoved: 0,
  managerRolesDowngraded: 0,
  legacyClaimsFound: 0,
  claimDocumentsCreated: 0,
  itemClaimArraysCleared: 0,
  warnings: []
};

try {
  const usersSnapshot = await db.collection('users').get();
  summary.usersScanned = usersSnapshot.size;

  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data();
    if (data.role === 'manager') {
      summary.managerRolesDowngraded++;
      if (apply) await userDoc.ref.update({ role: 'member' });
    }
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (!username) {
      summary.warnings.push(`User ${userDoc.id} has no username and was skipped.`);
      continue;
    }

    const expectedEmail = usernameToAuthEmail(username);
    const existingAuthUser = await findAuthUser(userDoc.id);
    if (existingAuthUser) {
      summary.existingAuthUsers++;
      if (apply && (existingAuthUser.email !== expectedEmail || password.length >= 6)) {
        await auth.updateUser(userDoc.id, {
          email: expectedEmail,
          ...(password.length >= 6 ? { password } : {}),
          displayName: data.inGameName || username,
          disabled: false
        });
        summary.existingAuthUsersUpdated++;
      }
    } else if (!password || password.length < 6) {
      summary.usersMissingPassword++;
      summary.warnings.push(`User ${userDoc.id} needs a password reset before migration.`);
      continue;
    } else {
      summary.authUsersToCreate++;
      if (apply) {
        await auth.createUser({
          uid: userDoc.id,
          email: expectedEmail,
          password,
          displayName: data.inGameName || username,
          disabled: false
        });
        summary.authUsersCreated++;
      }
    }

    if (apply && 'password' in data) {
      await userDoc.ref.update({ password: FieldValue.delete() });
      summary.passwordsRemoved++;
    }
  }

  const itemsSnapshot = await db.collection('items').get();
  for (const itemDoc of itemsSnapshot.docs) {
    const claims = Array.isArray(itemDoc.data().claimants) ? itemDoc.data().claimants : [];
    summary.legacyClaimsFound += claims.length;
    if (!apply || claims.length === 0) continue;

    const batch = db.batch();
    for (const claim of claims) {
      if (!claim?.userId) {
        summary.warnings.push(`Item ${itemDoc.id} contains a claimant without userId.`);
        continue;
      }
      const claimId = `${itemDoc.id}__${claim.userId}`;
      batch.set(db.collection('item_claims').doc(claimId), {
        itemId: itemDoc.id,
        userId: claim.userId,
        inGameName: claim.inGameName || '',
        clan: claim.clan || 'no-clan',
        powerLevel: Number(claim.powerLevel) || 0,
        claimedAt: Number(claim.claimedAt) || Date.now()
      }, { merge: false });
      summary.claimDocumentsCreated++;
    }
    batch.update(itemDoc.ref, { claimants: [] });
    await batch.commit();
    summary.itemClaimArraysCleared++;
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log('Dry run only. No Firebase data was changed.');
  }
} finally {
  await deleteApp(app);
}
