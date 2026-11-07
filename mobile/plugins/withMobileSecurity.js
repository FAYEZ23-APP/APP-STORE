const {
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
  createRunOncePlugin,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Security Reference: MOB-012 & MOB-013
 * - Android Native Security, Backup Protection, and Network Hardening
 */

const BLOCKED_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
];

const DATA_EXTRACTION_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- Security Reference: MOB-012 Android 12+ (API 31+) Data Extraction Rules -->
<data-extraction-rules>
    <cloud-backup>
        <!-- Explicitly disallow cloud backup of all files and shared preferences -->
        <exclude path="." />
    </cloud-backup>
    <device-transfer>
        <!-- Explicitly disallow device-to-device migration/transfer of all files and shared preferences -->
        <exclude path="." />
    </device-transfer>
</data-extraction-rules>
`;

const FULL_BACKUP_CONTENT_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- Security Reference: MOB-012 Android 6.0-11 (API 23-30) Full Backup Content Rules -->
<full-backup-content>
    <!-- Exclude all shared preferences, including SecureStore and Expo SecureStore -->
    <exclude domain="sharedpref" path="." />
    <!-- Exclude all databases, root, and file storage -->
    <exclude domain="database" path="." />
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
</full-backup-content>
`;

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- Security Reference: MOB-013 Android Network Security Configuration -->
<network-security-config>
    <!-- Deny cleartext HTTP traffic across entire application -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.marketplace.eg</domain>
        <domain includeSubdomains="true">marketplace.eg</domain>
    </domain-config>
</network-security-config>
`;

/**
 * Generates security XML resources under android/app/src/main/res/xml/
 */
function withSecurityXmlResources(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const resXmlDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );

      if (!fs.existsSync(resXmlDir)) {
        fs.mkdirSync(resXmlDir, { recursive: true });
      }

      // 1. Data extraction rules
      fs.writeFileSync(
        path.join(resXmlDir, 'secure_data_extraction_rules.xml'),
        DATA_EXTRACTION_RULES_XML,
        'utf8'
      );

      // 2. Full backup content
      fs.writeFileSync(
        path.join(resXmlDir, 'secure_full_backup_content.xml'),
        FULL_BACKUP_CONTENT_XML,
        'utf8'
      );

      // 3. Network security config (MOB-013)
      fs.writeFileSync(
        path.join(resXmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG_XML,
        'utf8'
      );

      return modConfig;
    },
  ]);
}

/**
 * Hardens AndroidManifest.xml:
 * - Configures allowBackup="false"
 * - Configures dataExtractionRules and fullBackupContent
 * - Configures networkSecurityConfig and usesCleartextTraffic="false"
 * - Removes unnecessary permissions with tools:node="remove"
 */
function withSecurityManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    // 1. Ensure xmlns:tools namespace is present on <manifest>
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);

    // 2. Set backup configuration on <application>
    mainApplication.$['android:allowBackup'] = 'false';
    mainApplication.$['android:dataExtractionRules'] = '@xml/secure_data_extraction_rules';
    mainApplication.$['android:fullBackupContent'] = '@xml/secure_full_backup_content';

    // 3. Network Security Configuration (MOB-013)
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.APP_ENV === 'production' ||
      process.env.EAS_BUILD_PROFILE === 'production';

    const allowCleartext = process.env.ALLOW_CLEARTEXT === '1';

    // In production, usesCleartextTraffic MUST be strictly false
    if (isProduction || !allowCleartext) {
      mainApplication.$['android:usesCleartextTraffic'] = 'false';
      mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    } else {
      // In development with explicit ALLOW_CLEARTEXT opt-in
      mainApplication.$['android:usesCleartextTraffic'] = 'true';
    }

    // 4. Ensure uses-permission array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    // 5. Enforce tools:node="remove" for each blocked permission
    for (const perm of BLOCKED_PERMISSIONS) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => p.$ && p.$['android:name'] !== perm
      );

      manifest['uses-permission'].push({
        $: {
          'android:name': perm,
          'tools:node': 'remove',
        },
      });
    }

    return modConfig;
  });
}

/**
 * Reviews and hardens iOS Info.plist:
 * - Configures App Transport Security (ATS) to deny arbitrary loads
 * - Ensures Face ID usage description is set
 * - Removes unnecessary permission usage keys (microphone, background location)
 */
function withSecurityInfoPlist(config) {
  return withInfoPlist(config, (modConfig) => {
    // 1. App Transport Security (MOB-013)
    modConfig.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
    };

    // 2. Delete unneeded usage descriptions
    delete modConfig.modResults.NSMicrophoneUsageDescription;
    delete modConfig.modResults.NSLocationAlwaysUsageDescription;
    delete modConfig.modResults.NSLocationAlwaysAndWhenInUseUsageDescription;

    // 3. Ensure Face ID description is present
    if (!modConfig.modResults.NSFaceIDUsageDescription) {
      modConfig.modResults.NSFaceIDUsageDescription =
        'السماح بالدخول السريع والآمن بالبصمة / Allow Face ID for quick and secure biometric login';
    }

    return modConfig;
  });
}

function withMobileSecurity(config) {
  let cfg = withSecurityXmlResources(config);
  cfg = withSecurityManifest(cfg);
  cfg = withSecurityInfoPlist(cfg);
  return cfg;
}

module.exports = createRunOncePlugin(withMobileSecurity, 'withMobileSecurity', '1.0.0');
