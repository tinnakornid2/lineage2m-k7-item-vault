import { randomUUID } from 'node:crypto';

export const EXPECTED_PRODUCTION_PROJECT_ID = 'k7-item';
export const DEFAULT_DATABASE_ID = 'ai-studio-lineage2mclanhub-4a1794d8-f944-422f-945e-56c12057ad13';

let testAdminSdk: any = null;

export function _setTestAdminSdk(mock: any) {
  testAdminSdk = mock;
}

export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  const encoded = Buffer.from(normalized, 'utf8').toString('hex');
  return `${encoded}@auth.k7-clan.local`;
}

export type RoleVerifySuccess = {
  success: true;
  actor: {
    uid: string;
    role: string;
    username: string;
  };
};

export type RoleVerifyFailure = {
  success: false;
  status: number;
  code: string;
  message: string;
};

export type RoleVerifyResult = RoleVerifySuccess | RoleVerifyFailure;

export function getResolvedProjectId(): string | null {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const isEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);

  if (envProjectId) {
    // Strictly forbid the stale project ID
    if (envProjectId === 'hybrid-box-753bd') {
      return null;
    }
    // In production environment (NODE_ENV === 'production' or VERCEL set), strictly require expected project
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    if (isProduction && !isEmulator && envProjectId !== EXPECTED_PRODUCTION_PROJECT_ID) {
      return null;
    }
    return envProjectId;
  }

  // If emulator is active and no explicit project is set, default to expected project
  if (isEmulator) {
    return EXPECTED_PRODUCTION_PROJECT_ID;
  }

  // In production / non-emulator mode without FIREBASE_PROJECT_ID, fail closed
  return null;
}

export function parseAndValidateServiceAccount(
  rawJson: string | undefined,
  expectedProjectId: string
): { valid: boolean; serviceAccount?: any; error?: string } {
  if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
    return { valid: false, error: 'MISSING_SERVICE_ACCOUNT' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    // Never log rawJson or secrets
    return { valid: false, error: 'MALFORMED_SERVICE_ACCOUNT_JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'INVALID_SERVICE_ACCOUNT_STRUCTURE' };
  }

  // Strictly forbid stale project ID
  if (parsed.project_id === 'hybrid-box-753bd') {
    return { valid: false, error: 'STALE_PROJECT_ID_FORBIDDEN' };
  }

  // Exact match required between service account project and expected project
  if (!parsed.project_id || parsed.project_id !== expectedProjectId) {
    return { valid: false, error: 'SERVICE_ACCOUNT_PROJECT_MISMATCH' };
  }

  if (!parsed.private_key || typeof parsed.private_key !== 'string') {
    return { valid: false, error: 'MISSING_PRIVATE_KEY' };
  }

  if (!parsed.client_email || typeof parsed.client_email !== 'string') {
    return { valid: false, error: 'MISSING_CLIENT_EMAIL' };
  }

  return { valid: true, serviceAccount: parsed };
}

export function getDatabaseId(): string {
  return process.env.FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID;
}

export function getStorageBucketName(projectId: string): string {
  return process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
}

export function hasAdminCredentials(): boolean {
  if (testAdminSdk !== null) return Boolean(testAdminSdk);

  const isEmulator = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST
  );
  if (isEmulator) return true;

  const projectId = getResolvedProjectId();
  if (!projectId) return false;

  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawSa) return false;

  const validation = parseAndValidateServiceAccount(rawSa, projectId);
  return validation.valid;
}

let cachedAdmin: {
  app: any;
  auth: any;
  db: any;
  storage: any;
} | null = null;

export function _resetCachedAdminSdk() {
  cachedAdmin = null;
}

export async function getAdminSdk() {
  if (testAdminSdk !== null) return testAdminSdk;
  if (!hasAdminCredentials()) return null;
  if (cachedAdmin) return cachedAdmin;

  const projectId = getResolvedProjectId();
  if (!projectId) return null;

  const isEmulator = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST
  );

  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getStorage } = await import('firebase-admin/storage');

    let app = getApps().length ? getApps()[0] : null;
    if (!app) {
      if (isEmulator) {
        app = initializeApp({ projectId });
      } else {
        const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const validation = parseAndValidateServiceAccount(rawSa, projectId);
        if (!validation.valid || !validation.serviceAccount) {
          return null;
        }
        app = initializeApp({
          credential: cert(validation.serviceAccount),
          projectId
        });
      }
    }

    if (!app) return null;

    const databaseId = getDatabaseId();
    const db = process.env.FIRESTORE_EMULATOR_HOST
      ? getFirestore(app)
      : getFirestore(app, databaseId);

    cachedAdmin = {
      app,
      auth: getAuth(app),
      db,
      storage: getStorage(app)
    };
    return cachedAdmin;
  } catch (err) {
    console.warn('Failed to initialize Firebase Admin SDK:', err instanceof Error ? err.message : 'Unknown error');
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
    throw new Error('AUTH_SERVICE_UNAVAILABLE');
  }
  await Promise.race([
    sdk.db.collection('app_settings').doc('gemini_ai').set({
      apiKey,
      updatedBy,
      updatedAt: Date.now()
    }, { merge: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500))
  ]);
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
    throw new Error('AUTH_SERVICE_UNAVAILABLE');
  }
  await Promise.race([
    sdk.db.collection('app_settings').doc('discord_secure').set({
      webhookUrl: webhookUrl.trim(),
      distributeWebhookUrl: distributeWebhookUrl.trim(),
      updatedBy,
      updatedAt: Date.now()
    }, { merge: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500))
  ]);
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
  const projectId = getResolvedProjectId() || EXPECTED_PRODUCTION_PROJECT_ID;
  const bucketName = getStorageBucketName(projectId);
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
): Promise<RoleVerifyResult> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return {
      success: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน / Missing authorization token.'
    };
  }

  // FAIL-CLOSED: No local-dev-* bypass tokens permitted. All tokens must be valid Firebase ID tokens.
  const sdk = await getAdminSdk();
  if (!sdk) {
    return {
      success: false,
      status: 503,
      code: 'AUTH_SERVICE_UNAVAILABLE',
      message: 'ระบบตรวจสอบสิทธิ์ยังไม่พร้อม / Authorization service is unavailable.'
    };
  }

  let decoded: any;
  try {
    decoded = await Promise.race([
      sdk.auth.verifyIdToken(token),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Auth verifyIdToken timeout')), 3500))
    ]);
  } catch (err: any) {
    if (err?.message?.includes('timeout') || err?.code === 'app/network-timeout') {
      return {
        success: false,
        status: 503,
        code: 'AUTH_SERVICE_TIMEOUT',
        message: 'ระบบตรวจสอบสิทธิ์ใช้เวลานานเกินไป / Authorization service timed out.'
      };
    }
    return {
      success: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'โทเค็นไม่ถูกต้องหรือหมดอายุแล้ว / Token is invalid or expired.'
    };
  }

  if (!decoded || !decoded.uid) {
    return {
      success: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'โทเค็นไม่ถูกต้อง / Invalid token claims.'
    };
  }

  let matchedUserId: string | null = null;
  let matchedUserData: any = null;

  // Condition 1: Check document /users/{decoded.uid} first
  try {
    const directDoc = await Promise.race([
      sdk.db.collection('users').doc(decoded.uid).get(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Firestore read timeout')), 3000))
    ]);

    if (directDoc && directDoc.exists) {
      matchedUserId = directDoc.id;
      matchedUserData = directDoc.data();
    }
  } catch (err: any) {
    console.warn('Firestore direct user lookup notice:', err?.message || err);
  }

  // Condition 2: Fallback only when /users/{decoded.uid} does not exist
  if (!matchedUserData) {
    // Condition 3: Fallback requires decoded.email to end with @auth.k7-clan.local
    const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
    const suffix = '@auth.k7-clan.local';
    if (!email.endsWith(suffix)) {
      return {
        success: false,
        status: 403,
        code: 'USER_PROFILE_NOT_FOUND',
        message: 'ไม่พบบัญชีผู้ใช้ที่เชื่อมโยงกับโทเค็นนี้ / No user profile linked to this token.'
      };
    }

    // Condition 4: Fallback requires local-part before @auth.k7-clan.local to be a valid even-length hex string
    const hexPart = email.slice(0, -suffix.length);
    if (!hexPart || hexPart.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hexPart)) {
      return {
        success: false,
        status: 403,
        code: 'INVALID_AUTH_IDENTITY',
        message: 'รูปแบบข้อมูลระบุตัวตนไม่ถูกต้อง / Invalid auth identity format.'
      };
    }

    // Condition 5: Fallback hex-decodes the local-part as UTF-8 to obtain username
    let decodedUsername = '';
    try {
      decodedUsername = Buffer.from(hexPart, 'hex').toString('utf8');
    } catch {
      return {
        success: false,
        status: 403,
        code: 'INVALID_AUTH_IDENTITY',
        message: 'ไม่สามารถแปลงข้อมูลระบุตัวตนได้ / Failed to decode auth identity.'
      };
    }

    if (!decodedUsername) {
      return {
        success: false,
        status: 403,
        code: 'INVALID_AUTH_IDENTITY',
        message: 'ชื่อผู้ใช้ว่างเปล่า / Empty username decoded.'
      };
    }

    // Condition 6: Round-trip check: usernameToAuthEmail(decodedUsername) === decoded.email
    if (usernameToAuthEmail(decodedUsername) !== email) {
      return {
        success: false,
        status: 403,
        code: 'AUTH_IDENTITY_MISMATCH',
        message: 'ข้อมูลระบุตัวตนไม่ตรงกับการตรวจสอบย้อนกลับ / Identity verification mismatch.'
      };
    }

    // Condition 7: Search /users by username case-insensitively
    let usersSnapshot: any;
    try {
      usersSnapshot = await Promise.race([
        sdk.db.collection('users').get(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Firestore users query timeout')), 3000))
      ]);
    } catch (err: any) {
      console.warn('Firestore users collection lookup error:', err?.message || err);
      return {
        success: false,
        status: 503,
        code: 'AUTH_SERVICE_UNAVAILABLE',
        message: 'ไม่สามารถเข้าถึงฐานข้อมูลผู้ใช้ได้ / User database unavailable.'
      };
    }

    if (!usersSnapshot) {
      return {
        success: false,
        status: 503,
        code: 'AUTH_SERVICE_UNAVAILABLE',
        message: 'ไม่สามารถเข้าถึงฐานข้อมูลผู้ใช้ได้ / User database unavailable.'
      };
    }

    const matchingDocs = usersSnapshot.docs.filter((docItem: any) => {
      const data = docItem.data();
      if (!data) return false;
      const uName = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
      return uName === decodedUsername.toLowerCase();
    });

    // Condition 8: Uniqueness check: EXACTLY ONE profile must match
    if (matchingDocs.length !== 1) {
      return {
        success: false,
        status: 403,
        code: matchingDocs.length === 0 ? 'USER_PROFILE_NOT_FOUND' : 'AMBIGUOUS_USER_PROFILE',
        message: matchingDocs.length === 0
          ? 'ไม่พบบัญชีผู้ใช้ในระบบ / User profile not found.'
          : 'พบโปรไฟล์ผู้ใช้ซ้ำกัน / Multiple user profiles found with the same username.'
      };
    }

    matchedUserId = matchingDocs[0].id;
    matchedUserData = matchingDocs[0].data();
  }

  // Condition 9: Status check: Matching user profile must NOT be status === 'deleted' or 'suspended'
  if (!matchedUserData || matchedUserData.status === 'deleted' || matchedUserData.status === 'suspended') {
    return {
      success: false,
      status: 403,
      code: 'USER_ACCOUNT_INACTIVE',
      message: 'บัญชีผู้ใช้นี้ถูกระงับหรือถูกลบแล้ว / User account is deleted or suspended.'
    };
  }

  // Condition 10: Role extraction: Role is read strictly from trusted Firestore document (doc.role)
  const userRole = String(matchedUserData.role || 'member').toLowerCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
  if (!normalizedAllowed.includes(userRole)) {
    return {
      success: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'ไม่มีสิทธิ์ใช้งานฟังก์ชันนี้ / You do not have permission to use this feature.'
    };
  }

  return {
    success: true,
    actor: {
      uid: matchedUserId!,
      role: userRole,
      username: String(matchedUserData.username || '')
    }
  };
}

export async function deleteManagedUser(
  actor: { uid: string; role: string },
  targetUid: string
): Promise<{ allowed: boolean; reason?: string; status?: number }> {
  if (!targetUid || actor.uid === targetUid) {
    return { allowed: false, reason: 'SELF_DELETE_DENIED', status: 403 };
  }

  const sdk = await getAdminSdk();
  if (!sdk) {
    return { allowed: false, reason: 'AUTH_SERVICE_UNAVAILABLE', status: 503 };
  }

  const targetRef = sdk.db.collection('users').doc(targetUid);
  const target = await targetRef.get();
  if (!target.exists) {
    return { allowed: false, reason: 'USER_NOT_FOUND', status: 404 };
  }
  const targetRole = String(target.data()?.role || 'member');
  const allowed = (actor.role === 'owner' && targetRole !== 'owner')
    || (actor.role === 'admin' && ['party_leader', 'member'].includes(targetRole));
  if (!allowed) {
    return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED', status: 403 };
  }

  try {
    await sdk.auth.deleteUser(targetUid);
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }
  await targetRef.delete();
  return { allowed: true, status: 200 };
}

export async function changeManagedUserPassword(
  actor: { uid: string; role: string },
  targetUid: string,
  newPassword: string
): Promise<{ allowed: boolean; reason?: string; status?: number }> {
  if (!targetUid || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
    return { allowed: false, reason: 'INVALID_PASSWORD', status: 400 };
  }

  const isSelf = actor.uid === targetUid;
  const isOwner = actor.role === 'owner';
  const isAdmin = actor.role === 'admin';

  if (!isSelf && !isOwner && !isAdmin) {
    return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED', status: 403 };
  }

  const sdk = await getAdminSdk();
  if (!sdk) {
    return { allowed: false, reason: 'AUTH_SERVICE_UNAVAILABLE', status: 503 };
  }

  const targetRef = sdk.db.collection('users').doc(targetUid);
  const target = await targetRef.get();

  if (target.exists) {
    const targetRole = String(target.data()?.role || 'member');
    if (isAdmin && !isSelf) {
      if (targetRole === 'owner' || targetRole === 'admin') {
        return { allowed: false, reason: 'ROLE_HIERARCHY_DENIED', status: 403 };
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

  return { allowed: true, status: 200 };
}

