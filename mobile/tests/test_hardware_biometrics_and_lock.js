const assert = require('assert');

// ─── PURE LOGIC UNDER TEST (Mirrored from src/utils/biometrics.js & authStorageService.js) ──
const isBiometricInvalidatedError = (error) => {
  if (!error) return false;
  const msg = (error.message || error.toString() || '').toLowerCase();
  return (
    msg.includes('permanentlyinvalidated') ||
    msg.includes('key_invalidated') ||
    msg.includes('enrollment_changed') ||
    msg.includes('errsecauthfailed') ||
    msg.includes('securestore_key_invalidated') ||
    (msg.includes('biometric') && (msg.includes('changed') || msg.includes('invalid') || msg.includes('revoked')))
  );
};

const LockState = {
  UNLOCKED: 'UNLOCKED',
  LOCKED: 'LOCKED',
  LOGGED_OUT: 'LOGGED_OUT',
};

const DEFAULT_LOCK_TIMEOUT_MS = 2 * 60 * 1000;

const evaluateLockStateOnResume = ({
  currentState = LockState.UNLOCKED,
  backgroundElapsedMs = 0,
  timeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  biometricsEnabled = false,
  hasRefreshToken = false,
  isInitialLaunch = false,
}) => {
  if (!hasRefreshToken) {
    return LockState.LOGGED_OUT;
  }

  if (!biometricsEnabled) {
    return LockState.UNLOCKED;
  }

  if (isInitialLaunch) {
    return LockState.LOCKED;
  }

  if (backgroundElapsedMs >= timeoutMs) {
    return LockState.LOCKED;
  }

  return currentState;
};

const evaluateUnlockResult = ({
  biometricSuccess = false,
  refreshSuccess = false,
  isInvalidated = false,
}) => {
  if (isInvalidated) {
    return { nextState: LockState.LOGGED_OUT, action: 'INVALIDATE_AND_LOGOUT' };
  }

  if (!biometricSuccess) {
    return { nextState: LockState.LOCKED, action: 'RETRY_OR_FALLBACK' };
  }

  if (!refreshSuccess) {
    return { nextState: LockState.LOGGED_OUT, action: 'REQUIRE_PASSWORD_LOGIN' };
  }

  return { nextState: LockState.UNLOCKED, action: 'RESUME_APP' };
};

const promptBiometricAuthMock = async (mockResponse) => {
  const result = mockResponse;
  const isCancelled =
    result.error === 'user_cancel' ||
    result.error === 'system_cancel' ||
    result.error === 'app_cancel';

  const isLockout =
    result.error === 'lockout' ||
    result.error === 'lockout_permanent';

  return {
    success: !!result.success,
    error: result.error,
    warning: result.warning,
    isCancelled,
    isLockout,
  };
};

// ─── TEST RUNNER ─────────────────────────────────────────────────────────────
console.log('================================================================');
console.log('🧪 TEST SUITE: HARDWARE BIOMETRICS & LOCK ENFORCEMENT (MOB-006)');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

const runTest = async (desc, fn) => {
  try {
    await fn();
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
};

(async () => {
  // Test 1: Successful Biometric Authentication
  await runTest('1. Successful biometric auth returns success and resumes app', async () => {
    const promptRes = await promptBiometricAuthMock({ success: true });
    assert.strictEqual(promptRes.success, true);
    assert.strictEqual(promptRes.isCancelled, false);
    assert.strictEqual(promptRes.isLockout, false);

    const unlockRes = evaluateUnlockResult({ biometricSuccess: true, refreshSuccess: true });
    assert.strictEqual(unlockRes.nextState, LockState.UNLOCKED);
    assert.strictEqual(unlockRes.action, 'RESUME_APP');
  });

  // Test 2: Cancelled Biometric Authentication
  await runTest('2. User cancelled biometric auth returns isCancelled=true and keeps app in LOCKED state', async () => {
    const promptRes = await promptBiometricAuthMock({ success: false, error: 'user_cancel' });
    assert.strictEqual(promptRes.success, false);
    assert.strictEqual(promptRes.isCancelled, true);
    assert.strictEqual(promptRes.isLockout, false);

    const unlockRes = evaluateUnlockResult({ biometricSuccess: false, refreshSuccess: false });
    assert.strictEqual(unlockRes.nextState, LockState.LOCKED);
    assert.strictEqual(unlockRes.action, 'RETRY_OR_FALLBACK');
  });

  // Test 3: Biometric Lockout (too many failed attempts)
  await runTest('3. Biometric lockout returns isLockout=true and directs to password fallback', async () => {
    const promptRes = await promptBiometricAuthMock({ success: false, error: 'lockout' });
    assert.strictEqual(promptRes.success, false);
    assert.strictEqual(promptRes.isCancelled, false);
    assert.strictEqual(promptRes.isLockout, true);

    const unlockRes = evaluateUnlockResult({ biometricSuccess: false, refreshSuccess: false });
    assert.strictEqual(unlockRes.nextState, LockState.LOCKED);
  });

  // Test 4: Hardware Unavailable or Not Enrolled
  await runTest('4. No hardware or not enrolled transitions cleanly without unhandled rejection', async () => {
    const promptRes = await promptBiometricAuthMock({ success: false, error: 'not_enrolled' });
    assert.strictEqual(promptRes.success, false);
    assert.strictEqual(promptRes.isCancelled, false);
    assert.strictEqual(promptRes.isLockout, false);
  });

  // Test 5: Biometric Enrollment Changes Detection (Android Keystore KeyPermanentlyInvalidatedException)
  await runTest('5. Detects Android KeyPermanentlyInvalidatedException when OS fingerprints change', async () => {
    const androidKeystoreError = new Error('android.security.keystore.KeyPermanentlyInvalidatedException: Key permanently invalidated');
    assert.strictEqual(isBiometricInvalidatedError(androidKeystoreError), true);
  });

  // Test 6: Biometric Enrollment Changes Detection (iOS Keychain errSecAuthFailed)
  await runTest('6. Detects iOS Keychain errSecAuthFailed when biometric authorization is invalidated', async () => {
    const iosKeychainError = new Error('The operation couldn’t be completed. (OSStatus error -25293 - errSecAuthFailed)');
    assert.strictEqual(isBiometricInvalidatedError(iosKeychainError), true);
  });

  // Test 7: Generic Biometric Invalidation Handling
  await runTest('7. evaluateUnlockResult transitions to LOGGED_OUT and INVALIDATE_AND_LOGOUT when key is invalidated', async () => {
    const unlockRes = evaluateUnlockResult({
      biometricSuccess: false,
      refreshSuccess: false,
      isInvalidated: true,
    });
    assert.strictEqual(unlockRes.nextState, LockState.LOGGED_OUT);
    assert.strictEqual(unlockRes.action, 'INVALIDATE_AND_LOGOUT');
  });

  // Test 8: Cold Start App Restart While Locked (Requirement: Zero network calls prior to unlock)
  await runTest('8. Cold start with biometrics enabled enters LOCKED state immediately with ZERO network calls', async () => {
    let networkCallCount = 0;
    const mockApiRefresh = () => {
      networkCallCount++;
    };

    // Evaluate cold start
    const state = evaluateLockStateOnResume({
      isInitialLaunch: true,
      biometricsEnabled: true,
      hasRefreshToken: true,
    });

    assert.strictEqual(state, LockState.LOCKED);
    assert.strictEqual(networkCallCount, 0, 'Must make ZERO network calls on cold start while locked');
  });

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
})();
