import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBC1_vvEgxbgpceQaEB8yHzJyGk6nR-ZKM';

export interface ManagedAuthRecord {
  uid: string;
  username: string;
  email: string;
  currentPassword?: string;
  adminResetPassword?: string;
  updatedAt: number;
}

export class ManagedAuthStore {
  private filePath: string;
  private records: Map<string, ManagedAuthRecord> = new Map();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'managed-auth.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw)) {
            if (v && typeof v === 'object') {
              this.records.set(k.toLowerCase(), v as ManagedAuthRecord);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load managed-auth.json:', e);
    }
  }

  private save(): void {
    try {
      const obj: Record<string, ManagedAuthRecord> = {};
      for (const [k, v] of this.records.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save managed-auth.json:', e);
    }
  }

  public getByUsername(username: string): ManagedAuthRecord | undefined {
    return this.records.get(username.trim().toLowerCase());
  }

  public getByUid(uid: string): ManagedAuthRecord | undefined {
    for (const record of this.records.values()) {
      if (record.uid === uid) return record;
    }
    return undefined;
  }

  public recordCredential(uid: string, username: string, password: string, email?: string): void {
    const cleanUser = username.trim().toLowerCase();
    const effectiveEmail = email || this.usernameToEmail(cleanUser);
    const existing = this.records.get(cleanUser);
    this.records.set(cleanUser, {
      uid: uid || existing?.uid || '',
      username: cleanUser,
      email: effectiveEmail,
      currentPassword: password,
      adminResetPassword: undefined,
      updatedAt: Date.now()
    });
    this.save();
  }

  public recordAdminReset(uid: string, username: string, newPassword: string): void {
    const cleanUser = username.trim().toLowerCase();
    const existing = this.records.get(cleanUser) || this.getByUid(uid);
    this.records.set(cleanUser, {
      uid: uid || existing?.uid || '',
      username: cleanUser,
      email: existing?.email || this.usernameToEmail(cleanUser),
      currentPassword: existing?.currentPassword,
      adminResetPassword: newPassword,
      updatedAt: Date.now()
    });
    this.save();
  }

  public deleteUser(usernameOrUid: string): void {
    const lower = usernameOrUid.trim().toLowerCase();
    this.records.delete(lower);
    for (const [k, v] of this.records.entries()) {
      if (v.uid === usernameOrUid) {
        this.records.delete(k);
      }
    }
    this.save();
  }

  public usernameToEmail(username: string): string {
    const normalized = username.trim().toLowerCase();
    const encoded = Buffer.from(normalized, 'utf8').toString('hex');
    return `${encoded}@auth.k7-clan.local`;
  }

  /**
   * Attempts to update the password in Firebase Auth using Google Identity Toolkit REST API.
   * If old password is known, signs in and calls accounts:update.
   */
  public async syncPasswordToFirebaseAuth(username: string, newPassword: string): Promise<boolean> {
    const record = this.getByUsername(username);
    if (!record || !record.currentPassword) return false;

    try {
      // 1. Sign in with current known password
      const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: record.email,
          password: record.currentPassword,
          returnSecureToken: true
        })
      });

      if (!signInRes.ok) return false;
      const signInData: any = await signInRes.json();
      const idToken = signInData.idToken;
      if (!idToken) return false;

      // 2. Update password
      const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          password: newPassword,
          returnSecureToken: true
        })
      });

      if (updateRes.ok) {
        record.currentPassword = newPassword;
        record.adminResetPassword = undefined;
        record.updatedAt = Date.now();
        this.save();
        return true;
      }
    } catch (e) {
      console.warn('syncPasswordToFirebaseAuth error:', e);
    }
    return false;
  }

  /**
   * Attempts to claim an orphaned Firebase Auth user account.
   */
  public async claimOrphan(username: string, newPassword: string): Promise<{ allowed: boolean; uid?: string; reason?: string }> {
    const cleanUser = username.trim().toLowerCase();
    const email = this.usernameToEmail(cleanUser);
    const record = this.getByUsername(cleanUser);

    // 1. Try signing in with the known existing password
    if (record?.currentPassword) {
      try {
        const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: record.currentPassword,
            returnSecureToken: true
          })
        });

        if (signInRes.ok) {
          const signInData: any = await signInRes.json();
          const idToken = signInData.idToken;
          if (idToken) {
            const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idToken,
                password: newPassword,
                returnSecureToken: true
              })
            });
            if (updateRes.ok) {
              const updateData: any = await updateRes.json();
              this.recordCredential(updateData.localId || signInData.localId, cleanUser, newPassword, email);
              return { allowed: true, uid: updateData.localId || signInData.localId };
            }
          }
        }
      } catch (err) {
        console.warn('claimOrphan with known password error:', err);
      }
    }

    // 2. Try signing in with the newPassword directly (in case user re-registered with same password)
    try {
      const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: newPassword,
          returnSecureToken: true
        })
      });
      if (signInRes.ok) {
        const signInData: any = await signInRes.json();
        this.recordCredential(signInData.localId, cleanUser, newPassword, email);
        return { allowed: true, uid: signInData.localId };
      }
    } catch (err) {}

    // 3. Try creating account if not already in use
    try {
      const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: newPassword,
          returnSecureToken: true
        })
      });
      if (signUpRes.ok) {
        const signUpData: any = await signUpRes.json();
        this.recordCredential(signUpData.localId, cleanUser, newPassword, email);
        return { allowed: true, uid: signUpData.localId };
      }
    } catch (err) {}

    return { allowed: false, reason: 'ORPHAN_CLAIM_FAILED' };
  }

  /**
   * Attempts to delete a user from Firebase Auth using Google Identity Toolkit REST API
   * by signing in with their known password and deleting the account.
   */
  public async deleteFromFirebaseAuth(username: string): Promise<boolean> {
    const record = this.getByUsername(username);
    if (!record || !record.currentPassword) {
      this.deleteUser(username);
      return false;
    }

    try {
      const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: record.email,
          password: record.currentPassword,
          returnSecureToken: true
        })
      });

      if (signInRes.ok) {
        const signInData: any = await signInRes.json();
        const idToken = signInData.idToken;
        if (idToken) {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
        }
      }
    } catch (e) {
      console.warn('deleteFromFirebaseAuth notice:', e);
    }
    this.deleteUser(username);
    return true;
  }
}

let managedAuthInstance: ManagedAuthStore | null = null;
export function getManagedAuthStore(dataDir = path.join(process.cwd(), 'data')): ManagedAuthStore {
  if (!managedAuthInstance) {
    managedAuthInstance = new ManagedAuthStore(dataDir);
  }
  return managedAuthInstance;
}
