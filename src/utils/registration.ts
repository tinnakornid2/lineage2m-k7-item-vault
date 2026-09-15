import { Language } from '../types';

export type RegistrationField = 'username' | 'password' | 'inGameName';

export function validateRegistration(
  username: string,
  password: string,
  inGameName: string
): RegistrationField | null {
  const cleanUsername = username.trim();
  const cleanInGameName = inGameName.trim();

  if (!cleanUsername) return 'username';
  if (!password) return 'password';
  if (!cleanInGameName) return 'inGameName';
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(cleanUsername)) return 'username';
  if (password.length < 6 || password.length > 128) return 'password';
  if (cleanInGameName.length > 60 || /[\u0000-\u001F\u007F]/.test(cleanInGameName)) {
    return 'inGameName';
  }
  return null;
}

export function registrationErrorMessage(field: RegistrationField, lang: Language): string {
  if (field === 'username') {
    return lang === 'th'
      ? 'ชื่อผู้ใช้ต้องมี 3–40 ตัว และใช้ได้เฉพาะ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง'
      : 'Username must be 3–40 characters using only a-z, 0-9, dots, hyphens, or underscores.';
  }
  if (field === 'password') {
    return lang === 'th'
      ? 'รหัสผ่านต้องมี 6–128 ตัวอักษร'
      : 'Password must contain 6–128 characters.';
  }
  return lang === 'th'
    ? 'กรุณากรอกชื่อตัวละคร ความยาวไม่เกิน 60 ตัวอักษร'
    : 'Enter an in-game character name of no more than 60 characters.';
}
