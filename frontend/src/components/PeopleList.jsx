import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { getDevice } from "@/lib/device";

// Home page: the people this device watched with; each can be forgotten (or all at once).
export function PeopleList() {
  const t = useT();
  const [people, setPeople] = useState([]);
  useEffect(() => {
    if (!getDevice().reg) return undefined;
    let alive = true;
    api.people().then((r) => alive && setPeople(r.people || [])).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!people.length) return null;
  const forget = (id) => api.forgetPerson(id).then(() => setPeople((l) => l.filter((p) => p.device_id !== id))).catch(() => {});
  const all = () => api.forgetAll().then(() => setPeople([])).catch(() => {});
  return (
    <section className="recent lp-recent forget-list" data-testid="people-list">
      <div className="recent-h"><UserPlus size={14} /> {t("together_title")}</div>
      {people.map((p) => (
        <div className="inv-row" key={p.device_id} data-testid="people-row">
          <div className="inv-who"><b>{p.nickname}</b><span>{new Date(p.last).toLocaleDateString()}</span></div>
          <button type="button" onClick={() => forget(p.device_id)} data-testid="people-forget-btn">{t("forget")}</button>
        </div>
      ))}
      <button type="button" className="inv-mut" onClick={all} data-testid="people-forget-all">{t("forget_all")}</button>
    </section>
  );
}
