import { randomUUID } from 'node:crypto';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'clan-hub-7645f';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';

export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
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
      const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
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
  if (sdk) {
    try {
      const snapshot: any = await Promise.race([
        sdk.db.collection('app_settings').doc('discord_secure').get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore read timeout')), 2500))
      ]);
      const data = snapshot?.data();
      const mainUrl = typeof data?.webhookUrl === 'string' ? data.webhookUrl.trim() : '';
      const distUrl = typeof data?.distributeWebhookUrl === 'string' ? data.distributeWebhookUrl.trim() : '';
      if (mainUrl || distUrl) return { mainUrl, distUrl };
    } catch {}
  }

  // Fallback: Read from app_settings/discord via Firestore REST API
  try {
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBC1_vvEgxbgpceQaEB8yHzJyGk6nR-ZKM';
    const projectId = process.env.FIREBASE_PROJECT_ID || 'clan-hub-7645f';
    const docRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/app_settings/discord?key=${apiKey}`);
    if (docRes.ok) {
      const docData: any = await docRes.json();
      const fields = docData.fields || {};
      const mainUrl = String(fields.webhookUrl?.stringValue || '').trim();
      const distUrl = String(fields.distributeWebhookUrl?.stringValue || '').trim();
      return { mainUrl, distUrl };
    }
  } catch {}

  return { mainUrl: '', distUrl: '' };
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
  if (token.startsWith('local-dev-') && process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
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

  if (sdk) {
    try {
      const decoded = await Promise.race([
        sdk.auth.verifyIdToken(token),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Auth verifyIdToken timeout')), 2500))
      ]);
      const trustedOwner = ['APsCZzEI4tYdx5UfHuY5Sw10L8B3', 'rbgWddfwUeQiCr5CE3eRD8ZPdZB2'].includes(decoded.uid)
        || decoded.email === '656c6f6e69@auth.k7-clan.local';
      if (trustedOwner && allowedRoles.includes('owner')) return { uid: 'user_owner_eloni', role: 'owner' };
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
      if (!['active', 'pending_approval', 'pending'].includes(data.status) || !normalizedAllowed.includes(userRole)) {
        return null;
      }
      return { uid: decoded.uid, role: userRole };
    } catch (err) {
      console.warn('verifyRoleToken Admin SDK verification notice:', err);
    }
  }

  // Fallback: Verify ID token via Google Identity Toolkit REST API (Works on localhost & cloud without service account key)
  try {
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBC1_vvEgxbgpceQaEB8yHzJyGk6nR-ZKM';
    const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });
    if (lookupRes.ok) {
      const lookupData: any = await lookupRes.json();
      const user = lookupData.users?.[0];
      if (user) {
        const uid = user.localId;
        const email = String(user.email || '').toLowerCase();
        const trustedOwner = ['APsCZzEI4tYdx5UfHuY5Sw10L8B3', 'rbgWddfwUeQiCr5CE3eRD8ZPdZB2'].includes(uid)
          || email === '656c6f6e69@auth.k7-clan.local';
        if (trustedOwner && allowedRoles.includes('owner')) {
          return { uid: 'user_owner_eloni', role: 'owner' };
        }

        // Fetch user document via Firestore REST API to check role
        const projectId = process.env.FIREBASE_PROJECT_ID || 'clan-hub-7645f';
        const userDocRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?key=${apiKey}`);
        if (userDocRes.ok) {
          const userDoc: any = await userDocRes.json();
          const fields = userDoc.fields || {};
          const userRole = String(fields.role?.stringValue || 'member').toLowerCase();
          const userStatus = String(fields.status?.stringValue || 'active');
          const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
          if (['active', 'pending_approval', 'pending'].includes(userStatus) && normalizedAllowed.includes(userRole)) {
            return { uid, role: userRole };
          }
        } else if (allowedRoles.includes('member')) {
          return { uid, role: 'member' };
        }
      }
    }
  } catch (restErr) {
    console.warn('verifyRoleToken REST verification notice:', restErr);
  }

  return null;
}

export async function deleteManagedUser(
  actor: { uid: string; role: string },
  targetUid: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!targetUid || actor.uid === targetUid) return { allowed: false, reason: 'SELF_DELETE_DENIED' };

  const sdk = await getAdminSdk();
  if (!sdk) {
    return { allowed: false, reason: 'AUTH_SERVICE_UNAVAILABLE' };
  }

  const targetRef = sdk.db.collection('users').doc(targetUid);
  const target = await targetRef.get();
  let username = '';
  let targetRole = 'member';

  if (target.exists) {
    const data = target.data();
    username = data?.username || '';
    targetRole = String(data?.role || 'member');
  } else {
    try {
      const authUser = await sdk.auth.getUser(targetUid);
      if (authUser?.email) {
        if (authUser.email === '656c6f6e69@auth.k7-clan.local' || targetUid === 'APsCZzEI4tYdx5UfHuY5Sw10L8B3') {
          targetRole = 'owner';
        }
      }
    } catch (e: any) {
      if (e?.code === 'auth/user-not-found') {
        return { allowed: false, reason: 'USER_NOT_FOUND' };
      }
      throw e;
    }
  }

  if (targetRole === 'owner' || targetUid === 'user_owner_eloni' || username.toLowerCase() === 'eloni') {
    return { allowed: false, reason: 'OWNER_IMMUTABLE' };
  }

  if (actor.role === 'admin') {
    if (targetRole === 'owner' || targetRole === 'admin') {
      return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED' };
    }
  } else if (actor.role !== 'owner') {
    return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED' };
  }

  let authUidToDelete: string | null = null;
  try {
    const directUser = await sdk.auth.getUser(targetUid);
    if (directUser) authUidToDelete = directUser.uid;
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  if (!authUidToDelete && username) {
    try {
      const emailUser = await sdk.auth.getUserByEmail(usernameToAuthEmail(username));
      if (emailUser) authUidToDelete = emailUser.uid;
    } catch (err: any) {
      if (err?.code !== 'auth/user-not-found') throw err;
    }
  }

  if (authUidToDelete) {
    await sdk.auth.deleteUser(authUidToDelete);
  }

  if (target.exists) {
    await targetRef.delete();
  }

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

  if (!isSelf && !isOwner && !isAdmin) {
    return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED' };
  }

  const sdk = await getAdminSdk();
  if (!sdk) {
    return { allowed: false, reason: 'AUTH_SERVICE_UNAVAILABLE' };
  }

  const targetRef = sdk.db.collection('users').doc(targetUid);
  const target = await targetRef.get();
  let username = '';
  let targetRole = 'member';

  if (target.exists) {
    const data = target.data();
    username = data?.username || '';
    targetRole = String(data?.role || 'member');
  } else {
    try {
      const authUser = await sdk.auth.getUser(targetUid);
      if (authUser?.email === '656c6f6e69@auth.k7-clan.local' || targetUid === 'APsCZzEI4tYdx5UfHuY5Sw10L8B3') {
        targetRole = 'owner';
      }
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        return { allowed: false, reason: 'USER_NOT_FOUND' };
      }
      throw err;
    }
  }

  if (isAdmin && !isSelf) {
    if (targetRole === 'owner' || targetRole === 'admin') {
      return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED' };
    }
  }

  const isOwnerUser = targetUid === 'user_owner_eloni' || username.toLowerCase() === 'eloni' || targetRole === 'owner';
  const ownerAuthUid = 'APsCZzEI4tYdx5UfHuY5Sw10L8B3';

  let authUser: any = null;
  if (isOwnerUser) {
    try {
      authUser = await sdk.auth.getUser(ownerAuthUid);
    } catch {}
  }

  if (!authUser) {
    try {
      authUser = await sdk.auth.getUser(targetUid);
    } catch (err: any) {
      if (err?.code !== 'auth/user-not-found') throw err;
    }
  }

  if (!authUser && username) {
    try {
      authUser = await sdk.auth.getUserByEmail(usernameToAuthEmail(username));
    } catch (err: any) {
      if (err?.code !== 'auth/user-not-found') throw err;
    }
  }

  if (!authUser) {
    return { allowed: false, reason: 'AUTH_USER_NOT_FOUND' };
  }

  try {
    await sdk.auth.updateUser(authUser.uid, { password: newPassword });
  } catch (err: any) {
    return { allowed: false, reason: err?.code || 'AUTH_UPDATE_FAILED' };
  }

  try {
    if (target.exists) {
      const { FieldValue } = await import('firebase-admin/firestore');
      await targetRef.update({ password: FieldValue.delete(), updatedAt: Date.now() });
    }
  } catch (dbErr) {
    console.warn('Firestore password cleanup notice:', dbErr);
  }

  if (isOwnerUser) {
    try {
      await sdk.db.collection('app_settings').doc('owner_auth').delete();
    } catch {}
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

export async function claimOrphanAuthUser(username: string): Promise<{ allowed: boolean; orphanDeleted?: boolean; reason?: string }> {
  const cleanUsername = username.trim();
  const lowerUser = cleanUsername.toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 40) {
    return { allowed: false, reason: 'INVALID_USERNAME' };
  }

  if (lowerUser === 'eloni' || lowerUser === 'owner') {
    return { allowed: false, reason: 'OWNER_RESERVED' };
  }

  const sdk = await getAdminSdk();
  if (!sdk) {
    return { allowed: false, reason: 'NO_ADMIN_SDK' };
  }

  const existingDoc = await sdk.db.collection('users').where('username', '==', cleanUsername).limit(1).get();
  if (!existingDoc.empty) {
    return { allowed: false, reason: 'USERNAME_IN_USE' };
  }

  const allUsersSnap = await sdk.db.collection('users').limit(500).get();
  for (const uDoc of allUsersSnap.docs) {
    const data = uDoc.data();
    if (data && typeof data.username === 'string' && data.username.toLowerCase() === lowerUser) {
      return { allowed: false, reason: 'USERNAME_IN_USE' };
    }
  }

  const email = usernameToAuthEmail(cleanUsername);
  let authUser: any = null;
  try {
    authUser = await sdk.auth.getUserByEmail(email);
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  if (!authUser) {
    return { allowed: false, reason: 'AUTH_USER_NOT_FOUND' };
  }

  try {
    await sdk.auth.deleteUser(authUser.uid);
    return { allowed: true, orphanDeleted: true };
  } catch (deleteErr: any) {
    return { allowed: false, reason: deleteErr?.code || 'AUTH_DELETE_FAILED' };
  }
}
