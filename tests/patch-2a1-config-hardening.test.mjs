import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getResolvedProjectId,
  parseAndValidateServiceAccount,
  hasAdminCredentials,
  getAdminSdk,
  _resetCachedAdminSdk,
  _setTestAdminSdk,
  EXPECTED_PRODUCTION_PROJECT_ID
} from '../api/_firebaseAdmin.ts';

describe('PATCH 2A-1 Step 5: Production Config Hardening & Project ID Safety', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _setTestAdminSdk(null);
    _resetCachedAdminSdk();
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.VERCEL;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    _setTestAdminSdk(null);
    _resetCachedAdminSdk();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  // -------------------------------------------------------------
  // Case 1: Missing FIREBASE_PROJECT_ID in production mode -> Fail Closed
  // -------------------------------------------------------------
  test('Case 1: Missing FIREBASE_PROJECT_ID in production mode fails closed', () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'k7-item',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'test@k7-item.iam.gserviceaccount.com'
    });

    // Without FIREBASE_PROJECT_ID, resolved project is null
    const resolved = getResolvedProjectId();
    assert.equal(resolved, null, 'Project ID must be null when FIREBASE_PROJECT_ID is missing');

    // hasAdminCredentials must fail closed
    const hasCreds = hasAdminCredentials();
    assert.equal(hasCreds, false, 'hasAdminCredentials must be false when FIREBASE_PROJECT_ID is missing');
  });

  // -------------------------------------------------------------
  // Case 2: Missing FIREBASE_SERVICE_ACCOUNT_JSON in production mode -> Fail Closed
  // -------------------------------------------------------------
  test('Case 2: Missing FIREBASE_SERVICE_ACCOUNT_JSON in production mode fails closed', () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    process.env.FIREBASE_PROJECT_ID = 'k7-item';

    const hasCreds = hasAdminCredentials();
    assert.equal(hasCreds, false, 'hasAdminCredentials must be false when service account JSON is missing');
  });

  // -------------------------------------------------------------
  // Case 3: Malformed Service Account JSON -> Fail Closed
  // -------------------------------------------------------------
  test('Case 3: Malformed Service Account JSON fails closed without leaking error details', () => {
    const malformed = '{"project_id": "k7-item", "private_key": broken_json...';
    const validation = parseAndValidateServiceAccount(malformed, 'k7-item');
    assert.equal(validation.valid, false);
    assert.equal(validation.error, 'MALFORMED_SERVICE_ACCOUNT_JSON');

    process.env.FIREBASE_PROJECT_ID = 'k7-item';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = malformed;
    assert.equal(hasAdminCredentials(), false);
  });

  // -------------------------------------------------------------
  // Case 4: Service Account project is hybrid-box-753bd but env is k7-item -> Reject
  // -------------------------------------------------------------
  test('Case 4: Stale project hybrid-box-753bd in service account or env is strictly rejected', () => {
    // 4a. Service account contains stale project ID
    const staleSa = JSON.stringify({
      project_id: 'hybrid-box-753bd',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n',
      client_email: 'test@hybrid-box-753bd.iam.gserviceaccount.com'
    });
    const validation = parseAndValidateServiceAccount(staleSa, 'k7-item');
    assert.equal(validation.valid, false);
    assert.equal(validation.error, 'STALE_PROJECT_ID_FORBIDDEN');

    // 4b. Env set to stale project ID
    process.env.FIREBASE_PROJECT_ID = 'hybrid-box-753bd';
    assert.equal(getResolvedProjectId(), null, 'Stale project ID in env must resolve to null');
    assert.equal(hasAdminCredentials(), false);
  });

  // -------------------------------------------------------------
  // Case 5: Service Account project matches env (k7-item) -> Accepted
  // -------------------------------------------------------------
  test('Case 5: Service Account project exactly matching env (k7-item) is accepted', () => {
    const validSa = JSON.stringify({
      project_id: 'k7-item',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'service-account@k7-item.iam.gserviceaccount.com'
    });

    const validation = parseAndValidateServiceAccount(validSa, 'k7-item');
    assert.equal(validation.valid, true);
    assert.equal(validation.serviceAccount.project_id, 'k7-item');

    process.env.FIREBASE_PROJECT_ID = 'k7-item';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = validSa;
    assert.equal(hasAdminCredentials(), true);
    assert.equal(getResolvedProjectId(), 'k7-item');
  });

  // -------------------------------------------------------------
  // Case 6: Unexpected Production project -> Reject
  // -------------------------------------------------------------
  test('Case 6: Unexpected production project (not k7-item) is rejected in production mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    process.env.FIREBASE_PROJECT_ID = 'unexpected-rogue-project';

    const resolved = getResolvedProjectId();
    assert.equal(resolved, null, 'Unexpected project in production mode must resolve to null');

    const sa = JSON.stringify({
      project_id: 'unexpected-rogue-project',
      private_key: 'key',
      client_email: 'email'
    });
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = sa;
    assert.equal(hasAdminCredentials(), false);
  });

  // -------------------------------------------------------------
  // Case 7: Emulator configuration -> Passes without production secret
  // -------------------------------------------------------------
  test('Case 7: Emulator configuration passes without production secret', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

    // No FIREBASE_SERVICE_ACCOUNT_JSON is set!
    assert.equal(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, undefined);

    // Resolved project defaults to k7-item
    const resolved = getResolvedProjectId();
    assert.equal(resolved, EXPECTED_PRODUCTION_PROJECT_ID);

    // hasAdminCredentials is true for emulator
    assert.equal(hasAdminCredentials(), true);
  });
});
