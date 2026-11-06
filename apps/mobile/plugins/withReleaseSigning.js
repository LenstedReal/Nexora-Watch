// Expo config plugin: sign release builds (APK + AAB) with the Play upload key when the
// NEXORA_UPLOAD_* environment variables are present (GitHub Actions secrets). Without them the
// release build falls back to the debug key so local/test builds still work.
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes("NEXORA_UPLOAD_STORE_FILE")) return cfg;
    const releaseConfig = `signingConfigs {
        release {
            if (System.getenv("NEXORA_UPLOAD_STORE_FILE")) {
                storeFile file(System.getenv("NEXORA_UPLOAD_STORE_FILE"))
                storePassword System.getenv("NEXORA_UPLOAD_STORE_PASSWORD")
                keyAlias System.getenv("NEXORA_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("NEXORA_UPLOAD_KEY_PASSWORD")
            }
        }`;
    if (!/signingConfigs\s*\{/.test(g)) throw new Error("withReleaseSigning: signingConfigs block not found in app/build.gradle");
    g = g.replace(/signingConfigs\s*\{/, releaseConfig);
    const before = g;
    g = g.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig(System.getenv("NEXORA_UPLOAD_STORE_FILE") ? signingConfigs.release : signingConfigs.debug)',
    );
    if (g === before) throw new Error("withReleaseSigning: release signingConfig line not found in app/build.gradle");
    cfg.modResults.contents = g;
    return cfg;
  });
};
