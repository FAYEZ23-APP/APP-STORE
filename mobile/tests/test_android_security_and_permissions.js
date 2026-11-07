const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ─── PATH DEFINITIONS ────────────────────────────────────────────────────────
const MOBILE_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(MOBILE_ROOT, 'android/app/src/main/AndroidManifest.xml');
const DATA_EXTRACTION_RULES_PATH = path.join(
  MOBILE_ROOT,
  'android/app/src/main/res/xml/secure_data_extraction_rules.xml'
);
const FULL_BACKUP_CONTENT_PATH = path.join(
  MOBILE_ROOT,
  'android/app/src/main/res/xml/secure_full_backup_content.xml'
);

console.log('================================================================');
console.log('🧪 TEST SUITE: ANDROID NATIVE SECURITY & PERMISSIONS (MOB-012)');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

const runTest = (desc, fn) => {
  try {
    fn();
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
};

// 1. Final Android Manifest Existence
runTest('1. Generated AndroidManifest.xml exists and is parseable', () => {
  assert.strictEqual(fs.existsSync(MANIFEST_PATH), true, 'AndroidManifest.xml must exist');
});

const manifestContent = fs.existsSync(MANIFEST_PATH)
  ? fs.readFileSync(MANIFEST_PATH, 'utf8')
  : '';

// 2. android:allowBackup="false"
runTest('2. Manifest enforces android:allowBackup="false" under <application>', () => {
  assert.strictEqual(
    manifestContent.includes('android:allowBackup="false"'),
    true,
    'Manifest must have android:allowBackup="false"'
  );
});

// 3. android:dataExtractionRules and android:fullBackupContent
runTest('3. Manifest references dataExtractionRules and fullBackupContent XML resources', () => {
  assert.strictEqual(
    manifestContent.includes('android:dataExtractionRules="@xml/secure_data_extraction_rules"'),
    true,
    'Must reference @xml/secure_data_extraction_rules'
  );
  assert.strictEqual(
    manifestContent.includes('android:fullBackupContent="@xml/secure_full_backup_content"'),
    true,
    'Must reference @xml/secure_full_backup_content'
  );
});

// 4. Secure Data Extraction Rules (Android 12+ / API 31+)
runTest('4. secure_data_extraction_rules.xml excludes both cloud-backup and device-transfer', () => {
  assert.strictEqual(fs.existsSync(DATA_EXTRACTION_RULES_PATH), true);
  const xml = fs.readFileSync(DATA_EXTRACTION_RULES_PATH, 'utf8');

  assert.strictEqual(xml.includes('<cloud-backup>'), true, 'Must define <cloud-backup>');
  assert.strictEqual(xml.includes('<device-transfer>'), true, 'Must define <device-transfer>');

  // Check exclusion of all paths
  const cloudMatch = xml.match(/<cloud-backup>[\s\S]*?<exclude\s+path="\."\s*\/>[\s\S]*?<\/cloud-backup>/);
  assert.notStrictEqual(cloudMatch, null, 'Cloud backup must exclude all paths');

  const transferMatch = xml.match(/<device-transfer>[\s\S]*?<exclude\s+path="\."\s*\/>[\s\S]*?<\/device-transfer>/);
  assert.notStrictEqual(transferMatch, null, 'Device-to-device transfer must exclude all paths');
});

// 5. Secure Full Backup Content (Android 6.0-11 / API 23-30)
runTest('5. secure_full_backup_content.xml excludes sharedpref, database, root, and file storage', () => {
  assert.strictEqual(fs.existsSync(FULL_BACKUP_CONTENT_PATH), true);
  const xml = fs.readFileSync(FULL_BACKUP_CONTENT_PATH, 'utf8');

  assert.strictEqual(
    xml.includes('<exclude domain="sharedpref" path="."'),
    true,
    'Must exclude sharedpref (SecureStore)'
  );
  assert.strictEqual(
    xml.includes('<exclude domain="database" path="."'),
    true,
    'Must exclude database'
  );
  assert.strictEqual(
    xml.includes('<exclude domain="root" path="."'),
    true,
    'Must exclude root'
  );
  assert.strictEqual(
    xml.includes('<exclude domain="file" path="."'),
    true,
    'Must exclude file'
  );
});

// 6. Blocked Permissions with tools:node="remove"
runTest('6. All unneeded permissions are stripped via tools:node="remove" in manifest', () => {
  const blockedList = [
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.RECORD_AUDIO',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_AUDIO',
    'android.permission.ACCESS_BACKGROUND_LOCATION',
  ];

  for (const perm of blockedList) {
    const regex = new RegExp(
      `<uses-permission\\s+android:name="${perm.replace('.', '\\.')}"\\s+tools:node="remove"\\s*\\/>`
    );
    assert.notStrictEqual(
      manifestContent.match(regex),
      null,
      `Permission ${perm} must have tools:node="remove"`
    );
  }
});

// 7. Retained Essential Permissions
runTest('7. Legitimate permissions required for business features are retained', () => {
  const retainedList = [
    'android.permission.INTERNET',
    'android.permission.CAMERA',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.USE_BIOMETRIC',
  ];

  for (const perm of retainedList) {
    const regex = new RegExp(
      `<uses-permission\\s+android:name="${perm.replace('.', '\\.')}"\\s*\\/>`
    );
    assert.notStrictEqual(
      manifestContent.match(regex),
      null,
      `Essential permission ${perm} must be retained without tools:node="remove"`
    );
  }
});

// 8. No duplicate permissions in manifest (Idempotency check)
runTest('8. Manifest has zero duplicate uses-permission tags', () => {
  const matches = manifestContent.match(/<uses-permission[^>]+>/g) || [];
  const permNames = matches.map((m) => {
    const match = m.match(/android:name="([^"]+)"/);
    return match ? match[1] : m;
  });

  const unique = new Set(permNames);
  assert.strictEqual(
    permNames.length,
    unique.size,
    `Duplicate permissions detected: ${permNames.join(', ')}`
  );
});

// 9. iOS Info.plist Security Audit
runTest('9. iOS Info.plist configuration has Face ID and no microphone or background location permissions', () => {
  const appConfig = require('../app.config.js');
  const ios = appConfig.expo?.ios;
  assert.notStrictEqual(ios, undefined, 'expo.ios must be defined in app.config.js');

  const infoPlist = ios.infoPlist || {};

  // Face ID must be present
  assert.strictEqual(
    typeof infoPlist.NSFaceIDUsageDescription === 'string' &&
      infoPlist.NSFaceIDUsageDescription.length > 0,
    true,
    'NSFaceIDUsageDescription must be set'
  );

  // Unnecessary permissions must NOT be in infoPlist
  assert.strictEqual(
    infoPlist.NSMicrophoneUsageDescription,
    undefined,
    'NSMicrophoneUsageDescription must NOT be requested'
  );
  assert.strictEqual(
    infoPlist.NSLocationAlwaysUsageDescription,
    undefined,
    'NSLocationAlwaysUsageDescription must NOT be requested'
  );
  assert.strictEqual(
    infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription,
    undefined,
    'NSLocationAlwaysAndWhenInUseUsageDescription must NOT be requested'
  );
});

console.log('\n================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) process.exit(1);
