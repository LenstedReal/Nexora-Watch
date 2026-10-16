import { useState } from "react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";

const f = (v, d = 2) => (v == null ? "–" : Number(v).toFixed(d));

export const SyncHud = ({ code, sync, clock, reconnects }) => {
  const t = useT();
  const [report, setReport] = useState(null);
  return (
    <section className="panel hud" data-testid="sync-hud">
      <div className="ph">{t("sync")}</div>
      <div className="hud-grid">
        <div><span>{t("drift")}</span><b data-testid="hud-drift">{f(sync.stats.drift)} s</b></div>
        <div><span>RTT</span><b data-testid="hud-rtt">{f(clock.rtt, 0)} ms</b></div>
        <div><span>Offset</span><b>{f(clock.offset, 0)} ms</b></div>
        <div><span>{t("corrections")}</span><b>{sync.stats.corrections}</b></div>
        <div><span>{t("reconnects")}</span><b>{reconnects}</b></div>
      </div>
      <button className="btn sm" onClick={() => api.metricsSummary(code).then(setReport)} data-testid="metrics-report-btn">{t("report")}</button>
      {report && (
        <table className="rep" data-testid="metrics-report">
          <thead><tr><th /><th>avg</th><th>max</th><th>&gt;2s</th><th>{t("latency")}</th></tr></thead>
          <tbody>
            {report.participants.map((p) => (
              <tr key={p.participant_id}><td>{p.nickname}</td><td>{f(p.avg_drift_s)}</td><td>{f(p.max_drift_s)}</td><td>{p.over_2s}</td><td>{f(p.avg_command_latency_ms, 0)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
