import React from "react";
import data from "@/i18n/locales";
import { detect } from "@/i18n";
import { reportError } from "@/lib/errors";

// Last line of defence for render errors: reports the crash and shows a reload button instead of a blank page.
// Lives outside the I18nProvider (that may be what crashed), so it reads the texts directly.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    const stack = `${(error && error.stack) || ""}\n--- component stack ---${(info && info.componentStack) || ""}`;
    reportError({ message: (error && error.message) || String(error), stack }, "render");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    let lang = "tr";
    try {
      lang = detect();
    } catch {
      /* default */
    }
    const t = (k) => (data[lang] && data[lang][k]) || data.tr[k];
    return (
      <div data-testid="crash-screen" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", background: "#0b0b12", color: "#f4f4f8", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ margin: 0, fontSize: 18 }}>{t("crash_title")}</p>
        <button type="button" data-testid="crash-reload" onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: 999, border: 0, background: "#7c5cff", color: "#fff", fontSize: 15, cursor: "pointer" }}>
          {t("crash_reload")}
        </button>
      </div>
    );
  }
}
