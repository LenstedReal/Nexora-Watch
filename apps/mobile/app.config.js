// Dynamic config on top of app.json: CI sets NEXORA_VERSION_CODE so every build has a higher
// versionCode (required by Google Play), and release signing is injected via a config plugin.
//
// InMobi ads: the three IDs come from the build environment (GitHub repository variables
// INMOBI_ACCOUNT_ID / INMOBI_BANNER_ID / INMOBI_INTERSTITIAL_ID -> android.yml env). PLACEHOLDERS:
// nothing is hard-coded here. With any ID empty, ads are off and no AD_ID permission is added.
module.exports = ({ config }) => {
  const versionCode = Number(process.env.NEXORA_VERSION_CODE || 0) || config.android.versionCode;
  const inmobi = {
    accountId: (process.env.EXPO_PUBLIC_INMOBI_ACCOUNT_ID || "").trim(),
    bannerId: (process.env.EXPO_PUBLIC_INMOBI_BANNER_ID || "").trim(),
    interstitialId: (process.env.EXPO_PUBLIC_INMOBI_INTERSTITIAL_ID || "").trim(),
  };
  const adsOn = Boolean(inmobi.accountId && inmobi.bannerId && inmobi.interstitialId);
  const permissions = [...(config.android.permissions || [])];
  // Needed for the advertising ID on Android 13+ (InMobi getting-started guide).
  // play-services-ads-identifier merges AD_ID into the manifest by itself, so block it when ads are off.
  const blockedPermissions = [...(config.android.blockedPermissions || [])];
  if (adsOn) permissions.push("com.google.android.gms.permission.AD_ID");
  else blockedPermissions.push("com.google.android.gms.permission.AD_ID");
  // Push (docs/PUSH.md): google-services.json is provided later by the owner (CI secret GOOGLE_SERVICES_JSON).
  // Only referenced when the file exists, so the build works without it (push simply off).
  const gsj = require("path").join(__dirname, "google-services.json");
  const googleServicesFile = require("fs").existsSync(gsj) ? "./google-services.json" : undefined;
  const pushPlugin = ["expo-notifications", { color: "#7c3aed", defaultChannel: "invites" }];
  return {
    ...config,
    android: { ...config.android, versionCode, permissions, blockedPermissions, ...(googleServicesFile ? { googleServicesFile } : {}) },
    ios: { ...config.ios, buildNumber: String(versionCode) },
    extra: { ...(config.extra || {}), inmobi },
    plugins: [...(config.plugins || []), pushPlugin, "./plugins/withReleaseSigning"],
  };
};
