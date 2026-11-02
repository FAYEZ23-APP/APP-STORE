const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to enforce Android security hardening:
 * - android:allowBackup="false" (prevent unauthorized data extraction via ADB)
 */
module.exports = function withAndroidSecurity(config) {
  return withAndroidManifest(config, (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    mainApplication.$['android:allowBackup'] = 'false';
    return modConfig;
  });
};
