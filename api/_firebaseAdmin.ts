import { randomUUID } from 'node:crypto';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'clan-hub-7645f';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';

export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

let cachedAdmin: {
  app: any;
  auth: any;
  db: any;
  storage: any;
} | null = null;

export async function getAdminSdk() {
  if (!hasAdminCredentials()) return null;
  if (cachedAdmin) return cachedAdmin;

  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getStorage } = await import('firebase-admin/storage');

    let app = getApps().length ? getApps()[0] : null;
    if (!app) {
      const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (rawServiceAccount) {
        try {
          const serviceAccount = JSON.parse(rawServiceAccount);
          app = initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
        } catch (e) {
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
        }
      } else if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        app = initializeApp({ projectId: PROJECT_ID });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        app = initializeApp({ projectId: PROJECT_ID });
      }
    }

    if (!app) return null;

    const db = process.env.FIRESTORE_EMULATOR_HOST || !DATABASE_ID || DATABASE_ID === '(default)'
      ? getFirestore(app)
      : getFirestore(app, DATABASE_ID);

    cachedAdmin = {
      app,
      auth: getAuth(app),
      db,
      storage: getStorage(app)
    };
    return cachedAdmin;
  } catch (err) {
    console.warn('Failed to load firebase-admin dynamically:', err);
    return null;
  }
}

export async function getAdminApp() {
  const sdk = await getAdminSdk();
  return sdk ? sdk.app : null;
}

export async function getStoredGeminiApiKey(): Promise<string> {
  const sdk = await getAdminSdk();
  if (!sdk) return '';
  try {
    const snapshot = await sdk.db.collection('app_settings').doc('gemini_ai').get();
    const apiKey = snapshot.data()?.apiKey;
    return typeof apiKey === 'string' ? apiKey.trim() : '';
  } catch {
    return '';
  }
}

export async function saveStoredGeminiApiKey(apiKey: string, updatedBy: string): Promise<void> {
  const sdk = await getAdminSdk();
  if (!sdk) {
    console.warn('saveStoredGeminiApiKey skipped: No Firebase Admin credentials in environment.');
    return;
  }
  try {
    await sdk.db.collection('app_settings').doc('gemini_ai').set({
      apiKey,
      updatedBy,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err: any) {
    console.warn('Cannot save stored gemini key via Admin SDK:', err?.message || err);
  }
}

export async function getStoredDiscordWebhookUrls(): Promise<{ mainUrl: string; distUrl: string }> {
  const sdk = await getAdminSdk();
  if (!sdk) return { mainUrl: '', distUrl: '' };
  try {
    const snapshot: any = await Promise.race([
      sdk.db.collection('app_settings').doc('discord_secure').get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore read timeout')), 2500))
    ]);
    const data = snapshot?.data();
    const mainUrl = typeof data?.webhookUrl === 'string' ? data.webhookUrl.trim() : '';
    const distUrl = typeof data?.distributeWebhookUrl === 'string' ? data.distributeWebhookUrl.trim() : '';
    return { mainUrl, distUrl };
  } catch {
    return { mainUrl: '', distUrl: '' };
  }
}

export async function getStoredDiscordWebhookUrl(): Promise<string> {
  const { mainUrl } = await getStoredDiscordWebhookUrls();
  return mainUrl;
}

export async function saveStoredDiscordWebhookUrls(webhookUrl: string, distributeWebhookUrl: string, updatedBy: string): Promise<void> {
  const sdk = await getAdminSdk();
  if (!sdk) {
    console.warn('saveStoredDiscordWebhookUrls skipped: No Firebase Admin credentials in environment.');
    return;
  }
  try {
    await Promise.race([
      sdk.db.collection('app_settings').doc('discord_secure').set({
        webhookUrl: webhookUrl.trim(),
        distributeWebhookUrl: distributeWebhookUrl.trim(),
        updatedBy,
        updatedAt: Date.now()
      }, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500))
    ]);
  } catch (err: any) {
    console.warn('Cannot save stored discord webhook via Admin SDK:', err?.message || err);
  }
}

export async function saveStoredDiscordWebhookUrl(webhookUrl: string, updatedBy: string): Promise<void> {
  return saveStoredDiscordWebhookUrls(webhookUrl, '', updatedBy);
}

export async function getKnownMemberProfiles(): Promise<Array<{ inGameName: string; clan: string; powerLevel: number }>> {
  const sdk = await getAdminSdk();
  if (!sdk) return [];
  try {
    const snapshot = await sdk.db.collection('users').limit(1000).get();
    return snapshot.docs
      .map((document: any) => document.data())
      .filter((profile: any) => profile && profile.status === 'active')
      .map((profile: any) => ({
        inGameName: typeof profile.inGameName === 'string' ? profile.inGameName.slice(0, 60) : '',
        clan: typeof profile.clan === 'string' ? profile.clan.slice(0, 60) : '',
        powerLevel: typeof profile.powerLevel === 'number' ? profile.powerLevel : 0
      }))
      .filter((profile: any) => profile.inGameName.length > 0);
  } catch (err: any) {
    console.warn('Cannot fetch member profiles via Admin SDK:', err?.message || err);
    return [];
  }
}

export async function uploadBackgroundImage(buffer: Buffer, contentType: string): Promise<string> {
  const sdk = await getAdminSdk();
  if (!sdk) {
    throw new Error('Firebase Admin credentials not configured for image upload.');
  }
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'k7-item.firebasestorage.app';
  const bucket = sdk.storage.bucket(bucketName);
  const objectName = `app-backgrounds/current-${Date.now()}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
  const downloadToken = randomUUID();
  const file = bucket.file(objectName);
  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: 'public,max-age=3600',
      metadata: { firebaseStorageDownloadTokens: downloadToken }
    }
  });
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`;
}

export async function verifyRoleToken(
  authorization: string | undefined,
  allowedRoles: string[]
): Promise<{ uid: string; role: string } | null> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;

  // Support local dev token generated by the client: e.g. "local-dev-user_owner_eloni-owner"
  if (token.startsWith('local-dev-')) {
    const parts = token.split('-');
    const role = (parts[parts.length - 1] || '').toLowerCase();
    const uid = parts.slice(2, parts.length - 1).join('-');
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (normalizedAllowed.includes(role)) {
      return { uid: uid || 'local-user', role };
    }
    return null;
  }

  const sdk = await getAdminSdk();

  // If no service account, decode JWT payload safely or reject invalid token
  if (!sdk) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const uid = payload.user_id || payload.sub;
        const role = String(payload.role || '').toLowerCase();
        const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
        if (uid && role && normalizedAllowed.includes(role)) {
          return { uid, role };
        }
      }
    } catch {}
    return null;
  }

  try {
    const decoded = await Promise.race([
      sdk.auth.verifyIdToken(token),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Auth verifyIdToken timeout')), 2500))
    ]);
    const profile: any = await Promise.race([
      sdk.db.collection('users').doc(decoded.uid).get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore user profile timeout')), 2500))
    ]).catch(() => null);

    if (!profile || !profile.exists) {
      const defaultRole = 'member';
      const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
      if (normalizedAllowed.includes(defaultRole)) {
        return { uid: decoded.uid, role: defaultRole };
      }
      return null;
    }
    const data = profile.data()!;
    const userRole = String(data.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (data.status === 'suspended' || !normalizedAllowed.includes(userRole)) {
      return null;
    }
    return { uid: decoded.uid, role: userRole };
  } catch (err) {
    console.warn('verifyRoleToken verification notice:', err);
    return null;
  }
}

export async function deleteManagedUser(
  actor: { uid: string; role: string },
  targetUid: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!targetUid || actor.uid === targetUid) return { allowed: false, reason: 'SELF_DELETE_DENIED' };

  const sdk = await getAdminSdk();
  if (!sdk) {
    console.warn('deleteManagedUser: No Firebase Admin credentials in environment, returning local success.');
    return { allowed: true };
  }

  const targetRef = sdk.db.collection('users').doc(targetUid);
  const target = await targetRef.get();
  if (!target.exists) return { allowed: false, reason: 'USER_NOT_FOUND' };
  const targetRole = String(target.data()?.role || 'member');
  const allowed = (actor.role === 'owner' && targetRole !== 'owner')
    || (actor.role === 'admin' && ['party_leader', 'member'].includes(targetRole));
  if (!allowed) return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED' };

  try {
    await sdk.auth.deleteUser(targetUid);
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }
  await targetRef.delete();
  return { allowed: true };
}

export async function changeManagedUserPassword(
  actor: { uid: string; role: string },
  targetUid: string,
  newPassword: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!targetUid || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
    return { allowed: false, reason: 'INVALID_PASSWORD' };
  }

  const isSelf = actor.uid === targetUid;
  const isOwner = actor.role === 'owner';
  const isAdmin = actor.role === 'admin';

  // 1. Check basic permissions:
  // Must be either self, owner, or admin. Regular members cannot change anyone else's password.
  if (!isSelf && !isOwner && !isAdmin) {
    return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED' };
  }

  const sdk = await getAdminSdk();
  if (!sdk) {
    console.warn('changeManagedUserPassword: No Firebase Admin credentials in environment, returning local success.');
    return { allowed: true };
  }

  const targetRef = sdk.db.collection('users').doc(targetUid);
  const target = await targetRef.get();

  if (target.exists) {
    const targetRole = String(target.data()?.role || 'member');
    // If admin is changing someone else's password:
    // Admin can ONLY change member and party_leader (cannot change owner or other admins)
    if (isAdmin && !isSelf) {
      if (targetRole === 'owner' || targetRole === 'admin') {
        return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED' };
      }
    }
  }

  // Update in Firebase Auth
  try {
    await sdk.auth.updateUser(targetUid, { password: newPassword });
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') {
      console.warn('Firebase Auth updateUser notice:', error?.message || error);
    }
  }

  // Update in Firestore users collection
  try {
    if (target.exists) {
      await targetRef.set({
        password: newPassword,
        updatedAt: Date.now()
      }, { merge: true });
    }
  } catch (dbErr) {
    console.warn('Firestore set password notice:', dbErr);
  }

  // If this is eloni (owner), also save to app_settings/owner_auth
  if (targetUid === 'user_owner_eloni' || target.data()?.username?.toLowerCase() === 'eloni') {
    try {
      await sdk.db.collection('app_settings').doc('owner_auth').set({
        password: newPassword,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {}
  }

  return { allowed: true };
}

export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  const encoded = Buffer.from(normalized, 'utf8').toString('hex');
  return `${encoded}@auth.k7-clan.local`;
}

export async function purgeOrphanAuthUsers(preserveUids: string[] = ['APsCZzEI4tYdx5UfHuY5Sw10L8B3']): Promise<{ deletedCount: number; deletedUids: string[] }> {
  const sdk = await getAdminSdk();
  if (!sdk) return { deletedCount: 0, deletedUids: [] };

  const list = await sdk.auth.listUsers(1000);
  const preserveSet = new Set(preserveUids);
  preserveSet.add('APsCZzEI4tYdx5UfHuY5Sw10L8B3');

  const uidsToDelete: string[] = [];
  for (const user of list.users) {
    if (
      !preserveSet.has(user.uid) &&
      user.email !== '656c6f6e69@auth.k7-clan.local' &&
      user.email !== 'tinnakornid2@gmail.com'
    ) {
      uidsToDelete.push(user.uid);
    }
  }

  if (uidsToDelete.length > 0) {
    for (let i = 0; i < uidsToDelete.length; i += 100) {
      const chunk = uidsToDelete.slice(i, i + 100);
      await sdk.auth.deleteUsers(chunk);
    }
  }

  return { deletedCount: uidsToDelete.length, deletedUids: uidsToDelete };
}

export async function claimOrphanAuthUser(username: string, newPassword: string): Promise<{ allowed: boolean; uid?: string; reason?: string }> {
  const cleanUsername = username.trim();
  const lowerUser = cleanUsername.toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 40) {
    return { allowed: false, reason: 'INVALID_USERNAME' };
  }
  if (!newPassword || newPassword.length < 6 || newPassword.length > 128) {
    return { allowed: false, reason: 'INVALID_PASSWORD' };
  }

  if (lowerUser === 'eloni' || lowerUser === 'owner') {
    return { allowed: false, reason: 'OWNER_RESERVED' };
  }

  const sdk = await getAdminSdk();
  if (!sdk) {
    return { allowed: false, reason: 'NO_ADMIN_SDK' };
  }

  // Check if user already exists as active in Firestore users collection
  const existingDoc = await sdk.db.collection('users').where('username', '==', cleanUsername).limit(1).get();
  if (!existingDoc.empty) {
    const data = existingDoc.docs[0].data();
    if (data && data.status !== 'suspended') {
      return { allowed: false, reason: 'USERNAME_IN_USE' };
    }
  }

  // Also check all documents for case-insensitive match
  const allUsersSnap = await sdk.db.collection('users').limit(500).get();
  for (const uDoc of allUsersSnap.docs) {
    const data = uDoc.data();
    if (data && typeof data.username === 'string' && data.username.toLowerCase() === lowerUser) {
      if (uDoc.id === 'user_owner_eloni' || uDoc.id === 'APsCZzEI4tYdx5UfHuY5Sw10L8B3' || data.role === 'owner') {
        return { allowed: false, reason: 'OWNER_RESERVED' };
      }
      return { allowed: false, reason: 'USERNAME_IN_USE' };
    }
  }

  // Locate user in Firebase Auth
  const email = usernameToAuthEmail(cleanUsername);
  let authUser: any = null;
  try {
    authUser = await sdk.auth.getUserByEmail(email);
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  if (!authUser) {
    try {
      authUser = await sdk.auth.createUser({
        email,
        password: newPassword,
        displayName: cleanUsername
      });
      return { allowed: true, uid: authUser.uid };
    } catch (createErr: any) {
      return { allowed: false, reason: createErr?.code || 'AUTH_CREATE_FAILED' };
    }
  }

  // User exists in Auth but NOT in Firestore -> orphaned account!
  try {
    await sdk.auth.updateUser(authUser.uid, { password: newPassword });
    return { allowed: true, uid: authUser.uid };
  } catch (updateErr: any) {
    return { allowed: false, reason: updateErr?.code || 'AUTH_UPDATE_FAILED' };
  }
}


