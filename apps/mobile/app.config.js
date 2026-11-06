// Dynamic config on top of app.json: CI sets NEXORA_VERSION_CODE so every build has a higher
// versionCode (required by Google Play), and release signing is injected via a config plugin.
module.exports = ({ config }) => {
  const versionCode = Number(process.env.NEXORA_VERSION_CODE || 0) || config.android.versionCode;
  return {
    ...config,
    android: { ...config.android, versionCode },
    ios: { ...config.ios, buildNumber: String(versionCode) },
    plugins: [...(config.plugins || []), "./plugins/withReleaseSigning"],
  };
};
