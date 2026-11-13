import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Volume1, Volume2, VolumeX, Settings, PictureInPicture2, Maximize, Minimize, Check, ChevronLeft, ChevronRight } from "lucide-react";
import Hls from "hls.js";
import { useT } from "@/i18n";
import "@/player.css";

// Our own controls for the <video> element (links, HLS, uploads). YouTube and embeds keep their own player UI.
//
// Who may do what: the host has everything. A guest never gets play, pause or seek (no button, no key, no tap, a
// read-only progress bar); sound, quality, subtitles, picture-in-picture and fullscreen are personal and stay.
// Host actions always go through the media element, so the room hears about them from its normal events.
//
// Cost: nothing here renders per frame. Time and progress are written straight to the DOM from `timeupdate`
// (about four times a second) and only while the controls are visible.

const HIDE_MS = 3000;
const SKIP_KEY = 5;
const SKIP_BTN = 10;
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const fmtTime = (s) => {
  const n = Number.isFinite(s) && s > 0 ? Math.floor(s) : 0;
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = String(n % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Remembered on this device only. Private windows and blocked storage must never break the player.
const mem = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, String(v)); } catch { /* storage not available */ } },
};
const levelLabel = (l) => (l.h ? `${l.h}p` : `${Math.max(1, Math.round(l.br / 1000))} kbps`);
const speedLabel = (r) => `${r}×`;
const ROOM_SUB = "room"; // the room's own subtitle file (<track data-room-sub>), listed next to the stream's tracks

/**
 * "ok" while a guest is within a quarter second of the room, "syncing" while it is being corrected. Two samples in a
 * row are needed to change, so the label never flickers. `null` when there is nothing to say (host, paused, no sync).
 */
export function useSyncState(drift, active, resetKey) {
  const [state, setState] = useState("ok");
  const runs = useRef({ bad: 0, good: 0 });
  useEffect(() => {
    runs.current = { bad: 0, good: 0 };
    setState("ok");
  }, [resetKey]);
  useEffect(() => {
    if (!active || drift == null) return;
    const r = runs.current;
    if (Math.abs(drift) > 0.25) {
      r.bad += 1;
      r.good = 0;
      if (r.bad >= 2) setState("syncing");
    } else {
      r.good += 1;
      r.bad = 0;
      if (r.good >= 2) setState("ok");
    }
  }, [drift, active]);
  return active ? state : null;
}

export const PlayerControls = memo(function PlayerControls({ media, stageRef, isHost, muted, onMuted, app, wide, onRotate, onFullscreen, syncState, rate = 1, onRate }) {
  const t = useT();
  const { el, hls } = media;
  const [shown, setShown] = useState(true);
  const [paused, setPaused] = useState(el.paused);
  const [hasDur, setHasDur] = useState(false);
  const [live, setLive] = useState(false);
  const [menu, setMenu] = useState(null); // null | "main" | "quality" | "subs" | "speed"
  const [levels, setLevels] = useState([]);
  const [level, setLevel] = useState(-1); // -1 = automatic
  const [autoIdx, setAutoIdx] = useState(-1);
  const [tracks, setTracks] = useState([]);
  const [track, setTrack] = useState(-1); // -1 = off, ROOM_SUB = the room's subtitle file
  const [roomSub, setRoomSub] = useState(null); // with hls.js: {label} of the room's <track>, when the room has one
  const trackRef = useRef(-1);
  trackRef.current = track;
  const [pip, setPip] = useState(false);
  const [fs, setFs] = useState(false);
  const [vol, setVol] = useState(() => {
    const v = parseFloat(mem.get("nx:vol"));
    return Number.isFinite(v) ? clamp(v, 0, 1) : 1;
  });
  const [narrow, setNarrow] = useState(() => window.innerWidth < 600);
  const [flash, setFlash] = useState(null);

  const shownRef = useRef(true);
  const menuRef = useRef(null);
  menuRef.current = menu;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const dragRef = useRef(null); // time under the finger while the seek bar is dragged
  const hideTimer = useRef(0);
  const lastMove = useRef(0);
  const nativeTracks = useRef([]);
  const barRef = useRef(null);
  const fillRef = useRef(null);
  const bufRef = useRef(null);
  const thumbRef = useRef(null);
  const curRef = useRef(null);
  const durRef = useRef(null);
  const tipRef = useRef(null);
  const menuEl = useRef(null);
  const gearEl = useRef(null);

  const canPip = typeof document !== "undefined" && !!document.pictureInPictureEnabled && typeof el.requestPictureInPicture === "function";
  const seekable = hasDur && !live;

  // ---- time, progress and buffer: written to the DOM directly ----
  const paint = useCallback(() => {
    const d = el.duration;
    const fin = Number.isFinite(d) && d > 0;
    const at = dragRef.current != null ? dragRef.current : el.currentTime;
    const frac = fin ? clamp(at / d, 0, 1) : 0;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${frac})`;
    if (thumbRef.current) thumbRef.current.style.left = `${frac * 100}%`;
    if (curRef.current) curRef.current.textContent = fmtTime(at);
    if (durRef.current) durRef.current.textContent = fin ? fmtTime(d) : "";
    if (bufRef.current) {
      let end = 0;
      const b = el.buffered;
      for (let i = 0; i < b.length; i += 1) if (b.start(i) <= at + 0.5 && b.end(i) >= at) end = Math.max(end, b.end(i));
      bufRef.current.style.transform = `scaleX(${fin ? clamp(end / d, 0, 1) : 0})`;
    }
    const bar = barRef.current;
    if (bar) {
      bar.setAttribute("aria-valuemax", String(fin ? Math.round(d) : 0));
      bar.setAttribute("aria-valuenow", String(Math.round(at)));
      bar.setAttribute("aria-valuetext", fin ? `${fmtTime(at)} / ${fmtTime(d)}` : fmtTime(at));
    }
  }, [el]);

  // ---- showing and hiding ----
  const armHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (el.paused || menuRef.current || dragRef.current != null) return;
      shownRef.current = false;
      setShown(false);
    }, HIDE_MS);
  }, [el]);
  const show = useCallback(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    setShown(true);
  }, []);
  const poke = useCallback(() => {
    show();
    armHide();
  }, [show, armHide]);
  const hideNow = useCallback(() => {
    clearTimeout(hideTimer.current);
    shownRef.current = false;
    setShown(false);
  }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => {
    const stage = stageRef.current;
    stage?.classList.toggle("ctl-off", !shown);
    if (shown) paint();
    return () => stage?.classList.remove("ctl-off");
  }, [shown, paint, stageRef]);

  // ---- actions ----
  const togglePlay = useCallback(() => {
    if (!el.paused) return el.pause();
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    return undefined;
  }, [el]);
  const skip = useCallback((delta) => {
    const d = el.duration;
    const max = Number.isFinite(d) && d > 0 ? Math.max(0, d - 0.2) : Infinity;
    el.currentTime = clamp(el.currentTime + delta, 0, max);
  }, [el]);
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mem.set("nx:muted", next ? "1" : "0");
    onMuted(next);
  }, [onMuted]);
  const applyVolume = useCallback((v) => {
    const nv = clamp(Math.round(v * 100) / 100, 0, 1);
    try { el.volume = nv; } catch { /* iPhone: the volume belongs to the hardware buttons */ }
    setVol(nv);
    mem.set("nx:vol", nv);
    if (nv > 0 && mutedRef.current) {
      mem.set("nx:muted", "0");
      onMuted(false);
    }
  }, [el, onMuted]);
  const togglePip = useCallback(() => {
    try {
      const p = document.pictureInPictureElement ? document.exitPictureInPicture() : el.requestPictureInPicture();
      if (p && p.catch) p.catch(() => {});
    } catch { /* not allowed right now */ }
  }, [el]);

  // The person's own sound settings come back on this device. A chosen mute is not the browser's autoplay mute.
  useEffect(() => {
    try { el.volume = vol; } catch { /* read-only on iPhone */ }
    if (mem.get("nx:muted") === "1" && !mutedRef.current) onMuted(true);
  }, [el]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- media element ----
  useEffect(() => {
    const tick = () => { if (!document.hidden && (shownRef.current || dragRef.current != null)) paint(); };
    const onPlay = () => { setPaused(false); poke(); };
    const onPause = () => { setPaused(true); clearTimeout(hideTimer.current); show(); };
    const onDur = () => {
      const d = el.duration;
      setHasDur(Number.isFinite(d) && d > 0);
      if (d === Infinity) setLive(true);
      paint();
    };
    const pipIn = () => setPip(true);
    const pipOut = () => setPip(false);
    const evs = [["timeupdate", tick], ["progress", tick], ["seeking", tick], ["seeked", tick], ["play", onPlay], ["pause", onPause],
      ["durationchange", onDur], ["loadedmetadata", onDur], ["enterpictureinpicture", pipIn], ["leavepictureinpicture", pipOut]];
    evs.forEach(([k, f]) => el.addEventListener(k, f));
    setPaused(el.paused);
    onDur();
    if (!el.paused) armHide();
    return () => evs.forEach(([k, f]) => el.removeEventListener(k, f));
  }, [el, paint, poke, show, armHide]);

  // ---- quality and subtitles ----
  useEffect(() => {
    if (!hls) return undefined;
    const readLevels = () => setLevels((hls.levels || []).map((l, i) => ({ i, h: l.height || 0, br: l.bitrate || 0 })).sort((a, b) => b.h - a.h || b.br - a.br));
    const readTracks = () => {
      setTracks((hls.subtitleTracks || []).map((s, i) => ({ i, label: s.name || s.lang || `${i + 1}` })));
      setTrack(typeof hls.subtitleTrack === "number" ? hls.subtitleTrack : -1);
    };
    const onSwitched = (_e, d) => setAutoIdx(typeof d?.level === "number" ? d.level : -1);
    const onLevel = (_e, d) => { if (d?.details?.live) setLive(true); };
    const onSub = (_e, d) => {
      const id = typeof d?.id === "number" ? d.id : -1;
      if (id < 0 && trackRef.current === ROOM_SUB) return; // the stream's tracks went off because the room's file is on
      setTrack(id);
    };
    const subs = [[Hls.Events.MANIFEST_PARSED, readLevels], [Hls.Events.LEVEL_SWITCHED, onSwitched], [Hls.Events.LEVEL_LOADED, onLevel],
      [Hls.Events.SUBTITLE_TRACKS_UPDATED, readTracks], [Hls.Events.SUBTITLE_TRACK_SWITCH, onSub]].filter(([name]) => name);
    subs.forEach(([name, fn]) => hls.on(name, fn));
    readLevels();
    readTracks();
    return () => subs.forEach(([name, fn]) => { try { hls.off(name, fn); } catch { /* already destroyed */ } });
  }, [hls]);
  // With hls.js the room's subtitle file is not one of hls.js's tracks: it gets its own entry.
  const roomTrackEl = useCallback(() => el.querySelector("track[data-room-sub]"), [el]);
  useEffect(() => {
    const list = el.textTracks;
    if (!hls || !list || typeof list.addEventListener !== "function") return undefined;
    const read = () => {
      const tr = roomTrackEl();
      setRoomSub(tr ? { label: tr.label || "1" } : null);
      if (tr && trackRef.current !== ROOM_SUB && tr.track && tr.track.mode === "showing") tr.track.mode = "disabled";
      if (!tr && trackRef.current === ROOM_SUB) setTrack(-1);
    };
    list.addEventListener("addtrack", read);
    list.addEventListener("removetrack", read);
    read();
    return () => {
      list.removeEventListener("addtrack", read);
      list.removeEventListener("removetrack", read);
    };
  }, [el, hls, roomTrackEl]);
  // Without hls.js (plain files, iPhone's built-in HLS) subtitles come from the element's own text tracks, when it has any.
  useEffect(() => {
    const list = el.textTracks;
    if (hls || !list || typeof list.addEventListener !== "function") return undefined;
    const read = () => {
      const idx = [];
      for (let i = 0; i < list.length; i += 1) if (list[i].kind === "subtitles" || list[i].kind === "captions") idx.push(i);
      nativeTracks.current = idx;
      setTracks(idx.map((ti, n) => ({ i: n, label: list[ti].label || list[ti].language || `${n + 1}` })));
      setTrack(idx.findIndex((ti) => list[ti].mode === "showing"));
    };
    list.addEventListener("addtrack", read);
    list.addEventListener("removetrack", read);
    read();
    return () => {
      list.removeEventListener("addtrack", read);
      list.removeEventListener("removetrack", read);
    };
  }, [el, hls]);
  const pickLevel = (i) => {
    try { if (hls) hls.nextLevel = i; } catch { /* stream is gone */ }
    setLevel(i);
    setMenu(null);
    poke();
  };
  const pickTrack = (i) => {
    try {
      if (hls) {
        const own = i === ROOM_SUB;
        hls.subtitleDisplay = !own && i >= 0;
        hls.subtitleTrack = own ? -1 : i;
        const tt = roomTrackEl()?.track;
        if (tt) tt.mode = own ? "showing" : "disabled";
      } else {
        const list = el.textTracks;
        nativeTracks.current.forEach((ti, n) => { list[ti].mode = n === i ? "showing" : "disabled"; });
      }
    } catch { /* stream is gone */ }
    setTrack(i);
    setMenu(null);
    poke();
  };
  const pickSpeed = (r) => {
    onRate?.(r);
    setMenu(null);
    poke();
  };

  // ---- screen state ----
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement && document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFs);
    onFs();
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [stageRef]);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 600);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- a guest's media keys, headset buttons and the picture-in-picture window must not control the room's video ----
  useEffect(() => {
    if (isHost || typeof navigator === "undefined" || !navigator.mediaSession?.setActionHandler) return undefined;
    const acts = ["play", "pause", "stop", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"];
    const set = (h) => acts.forEach((a) => { try { navigator.mediaSession.setActionHandler(a, h); } catch { /* action unknown to this browser */ } });
    set(() => {});
    return () => set(null);
  }, [isHost]);

  // ---- pointer on the picture: mouse = play/pause (host), tap = show/hide, double tap on a side = 10 s (host) ----
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    let ptype = "mouse";
    let lastTap = 0;
    let lastSide = 0;
    const surface = (n) => n === el || n === stage || !!(n.closest && n.closest(".lock"));
    const down = (e) => { ptype = e.pointerType || "mouse"; };
    const move = (e) => {
      if ((e.pointerType || "mouse") !== "mouse") return;
      const now = performance.now();
      if (now - lastMove.current < 200) return;
      lastMove.current = now;
      poke();
    };
    const click = (e) => {
      if (!surface(e.target)) return poke();
      if (menuRef.current) {
        setMenu(null);
        return poke();
      }
      if (ptype === "mouse") {
        poke();
        if (isHost) togglePlay();
        return undefined;
      }
      const now = performance.now();
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / Math.max(1, r.width);
      const side = x < 1 / 3 ? -1 : x > 2 / 3 ? 1 : 0;
      if (isHost && side && side === lastSide && now - lastTap < 320 && Number.isFinite(el.duration)) {
        lastTap = 0;
        skip(side * SKIP_BTN);
        setFlash({ side, id: now });
        return poke();
      }
      lastTap = now;
      lastSide = side;
      if (shownRef.current && !el.paused) return hideNow();
      return poke();
    };
    stage.addEventListener("pointerdown", down, { passive: true });
    stage.addEventListener("pointermove", move, { passive: true });
    stage.addEventListener("click", click);
    return () => {
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("click", click);
    };
  }, [stageRef, el, isHost, poke, hideNow, togglePlay, skip]);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const stage = stageRef.current;
      if (!stage) return;
      const ae = document.activeElement;
      const tag = ae?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || ae?.isContentEditable) return; // typing
      if (document.querySelector('.modal-bg, [aria-modal="true"]')) return; // a question is open
      if (ae && ae !== document.body && ae !== document.documentElement && !stage.contains(ae)) return; // focus is elsewhere on the page
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "Escape") {
        if (!menuRef.current) return;
        setMenu(null);
      } else if (k === "m") toggleMute();
      else if (k === "f" && !app) onFullscreen();
      else if (k === "ArrowUp") applyVolume((mutedRef.current ? 0 : el.volume) + 0.05);
      else if (k === "ArrowDown") applyVolume((mutedRef.current ? 0 : el.volume) - 0.05);
      else if (!isHost) return; // guests: sound and screen only
      else if (k === " " || k === "k") {
        if (k === " " && tag === "BUTTON") return; // the focused button takes the space bar itself
        togglePlay();
      } else if (k === "ArrowLeft") skip(-SKIP_KEY);
      else if (k === "ArrowRight") skip(SKIP_KEY);
      else if (k === "j") skip(-SKIP_BTN);
      else if (k === "l") skip(SKIP_BTN);
      else return;
      e.preventDefault();
      poke();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stageRef, el, isHost, app, onFullscreen, toggleMute, applyVolume, togglePlay, skip, poke]);

  // ---- menu: closes on a press anywhere else ----
  useEffect(() => {
    if (!menu) return undefined;
    const away = (e) => {
      if (menuEl.current?.contains(e.target) || gearEl.current?.contains(e.target)) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [menu]);

  // ---- seek bar (host): preview while dragging, ONE seek when the finger lifts ----
  const timeAt = (e) => {
    const r = barRef.current.getBoundingClientRect();
    return clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1) * el.duration;
  };
  const tipAt = (e, at) => {
    const tip = tipRef.current;
    if (!tip) return;
    const r = barRef.current.getBoundingClientRect();
    tip.textContent = fmtTime(at);
    tip.style.left = `${clamp(e.clientX - r.left, 20, Math.max(20, r.width - 20))}px`;
    tip.classList.add("on");
  };
  const canSeek = isHost && seekable;
  const seekDown = (e) => {
    if (!canSeek || e.button > 0) return;
    e.preventDefault();
    try { barRef.current.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    dragRef.current = timeAt(e);
    barRef.current.classList.add("drag");
    clearTimeout(hideTimer.current);
    tipAt(e, dragRef.current);
    paint();
  };
  const seekMove = (e) => {
    if (!canSeek) return;
    if (dragRef.current != null) {
      dragRef.current = timeAt(e);
      tipAt(e, dragRef.current);
      paint();
    } else if ((e.pointerType || "mouse") === "mouse") tipAt(e, timeAt(e));
  };
  const seekEnd = (commit) => (e) => {
    const at = dragRef.current;
    if (at == null) return;
    dragRef.current = null;
    barRef.current?.classList.remove("drag");
    tipRef.current?.classList.remove("on");
    try { barRef.current.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (commit && Number.isFinite(at)) el.currentTime = clamp(at, 0, Math.max(0, el.duration - 0.2));
    paint();
    poke();
  };
  const seekLeave = () => { if (dragRef.current == null) tipRef.current?.classList.remove("on"); };

  const VolIcon = muted || vol === 0 ? VolumeX : vol < 0.5 ? Volume1 : Volume2;
  const hasQuality = levels.length > 1;
  const subList = hls && roomSub ? [...tracks, { i: ROOM_SUB, label: roomSub.label }] : tracks;
  const hasSubs = subList.length > 0;
  const hasSpeed = isHost && !!onRate && !live;
  const pipInMenu = canPip && narrow;
  const hasMenu = hasQuality || hasSubs || hasSpeed || pipInMenu;
  const auto = levels.find((l) => l.i === autoIdx);
  const chosen = levels.find((l) => l.i === level);
  const qualityText = level === -1 ? `${t("pl_auto")}${auto ? ` · ${levelLabel(auto)}` : ""}` : chosen ? levelLabel(chosen) : t("pl_auto");

  return (
    <div className={`nxp-ui ${isHost ? "host" : "guest"}${shown ? "" : " off"}`} data-testid="player-controls" data-shown={shown ? "1" : "0"} onFocus={poke}>
      <div className="nxp-top">
        {syncState && (
          <span className={`nxp-sync ${syncState}`} role="status" data-testid="sync-pill">{t(syncState === "ok" ? "pl_synced" : "pl_syncing")}</span>
        )}
      </div>
      {isHost && paused && (
        <button className="nxp-big" onClick={togglePlay} aria-label={t("pl_play")} data-testid="big-play-btn"><Play size={30} fill="currentColor" /></button>
      )}
      {flash && (
        <div key={flash.id} className={`nxp-flash ${flash.side < 0 ? "l" : "r"}`} onAnimationEnd={() => setFlash(null)} aria-hidden="true" data-testid="skip-flash">
          {flash.side < 0 ? "−10" : "+10"}
        </div>
      )}
      {menu && (
        <div className="nxp-menu" role="menu" ref={menuEl} data-testid="player-menu">
          {menu === "main" && (
            <>
              {hasQuality && (
                <button role="menuitem" onClick={() => setMenu("quality")} data-testid="menu-quality"><span>{t("pl_quality")}</span><small>{qualityText}</small><ChevronRight size={15} /></button>
              )}
              {hasSubs && (
                <button role="menuitem" onClick={() => setMenu("subs")} data-testid="menu-subs"><span>{t("pl_subtitles")}</span><small>{track === -1 ? t("pl_off") : subList.find((s) => s.i === track)?.label}</small><ChevronRight size={15} /></button>
              )}
              {hasSpeed && (
                <button role="menuitem" onClick={() => setMenu("speed")} data-testid="menu-speed"><span>{t("pl_speed")}</span><small>{rate === 1 ? t("pl_normal") : speedLabel(rate)}</small><ChevronRight size={15} /></button>
              )}
              {pipInMenu && (
                <button role="menuitem" onClick={() => { togglePip(); setMenu(null); }} data-testid="menu-pip"><span>{t("pl_pip")}</span><PictureInPicture2 size={15} /></button>
              )}
            </>
          )}
          {menu === "quality" && (
            <>
              <button className="back" onClick={() => setMenu("main")} data-testid="menu-back"><ChevronLeft size={15} /><span>{t("pl_quality")}</span></button>
              <button role="menuitemradio" aria-checked={level === -1} onClick={() => pickLevel(-1)} data-testid="quality-auto">
                {level === -1 ? <Check size={15} /> : <i />}<span>{t("pl_auto")}</span>{auto && level === -1 && <small>{levelLabel(auto)}</small>}
              </button>
              {levels.map((l) => (
                <button key={l.i} role="menuitemradio" aria-checked={level === l.i} onClick={() => pickLevel(l.i)} data-testid={`quality-${l.i}`}>
                  {level === l.i ? <Check size={15} /> : <i />}<span>{levelLabel(l)}</span>
                </button>
              ))}
            </>
          )}
          {menu === "subs" && (
            <>
              <button className="back" onClick={() => setMenu("main")} data-testid="menu-back"><ChevronLeft size={15} /><span>{t("pl_subtitles")}</span></button>
              <button role="menuitemradio" aria-checked={track === -1} onClick={() => pickTrack(-1)} data-testid="subs-off">{track === -1 ? <Check size={15} /> : <i />}<span>{t("pl_off")}</span></button>
              {subList.map((s) => (
                <button key={s.i} role="menuitemradio" aria-checked={track === s.i} onClick={() => pickTrack(s.i)} data-testid={`subs-${s.i}`}>
                  {track === s.i ? <Check size={15} /> : <i />}<span>{s.label}</span>
                </button>
              ))}
            </>
          )}
          {menu === "speed" && (
            <>
              <button className="back" onClick={() => setMenu("main")} data-testid="menu-back"><ChevronLeft size={15} /><span>{t("pl_speed")}</span></button>
              {SPEEDS.map((r) => (
                <button key={r} role="menuitemradio" aria-checked={rate === r} onClick={() => pickSpeed(r)} data-testid={`speed-${r}`}>
                  {rate === r ? <Check size={15} /> : <i />}<span>{r === 1 ? t("pl_normal") : speedLabel(r)}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <div className="nxp-bottom" data-testid="player-bar">
        <div
          ref={barRef}
          className={`nxp-seek${seekable ? "" : " none"}${isHost ? "" : " ro"}`}
          role={isHost ? "slider" : "progressbar"}
          tabIndex={canSeek ? 0 : -1}
          aria-label={t("pl_seek")}
          aria-valuemin={0}
          aria-disabled={isHost ? undefined : true}
          onPointerDown={seekDown}
          onPointerMove={seekMove}
          onPointerUp={seekEnd(true)}
          onPointerCancel={seekEnd(false)}
          onPointerLeave={seekLeave}
          data-testid="seek-bar"
        >
          <div className="nxp-track"><i ref={bufRef} className="buf" /><i ref={fillRef} className="fill" /></div>
          {isHost && <b ref={thumbRef} className="thumb" />}
          <span ref={tipRef} className="tip" aria-hidden="true" />
        </div>
        <div className="nxp-row">
          {isHost && (
            <button className="nxp-btn" onClick={togglePlay} aria-label={t(paused ? "pl_play" : "pl_pause")} data-testid="play-btn">
              {paused ? <Play size={19} fill="currentColor" /> : <Pause size={19} fill="currentColor" />}
            </button>
          )}
          {canSeek && (
            <button className="nxp-btn nxp-skip" onClick={() => skip(-SKIP_BTN)} aria-label={t("pl_back10")} data-testid="back10-btn"><RotateCcw size={21} /><em>10</em></button>
          )}
          {canSeek && (
            <button className="nxp-btn nxp-skip" onClick={() => skip(SKIP_BTN)} aria-label={t("pl_fwd10")} data-testid="fwd10-btn"><RotateCw size={21} /><em>10</em></button>
          )}
          <div className="nxp-vol">
            <button className="nxp-btn" onClick={toggleMute} aria-label={t(muted ? "unmute" : "mute")} data-testid={isHost ? "mute-btn" : "guest-mute-btn"}><VolIcon size={19} /></button>
            <input className="nxp-range" type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol} onChange={(e) => applyVolume(parseFloat(e.target.value))} aria-label={t("pl_volume")} data-testid="volume-range" />
          </div>
          {live ? (
            <span className="nxp-live" data-testid="live-badge">{t("pl_live")}</span>
          ) : (
            <span className="nxp-time" data-testid="time-display"><span ref={curRef}>0:00</span><span className="sep">/</span><span ref={durRef} /></span>
          )}
          <span className="nxp-space" />
          {hasMenu && (
            <button ref={gearEl} className="nxp-btn" onClick={() => { setMenu(menu ? null : "main"); poke(); }} aria-label={t("pl_settings")} aria-haspopup="menu" aria-expanded={!!menu} data-testid="settings-btn"><Settings size={19} /></button>
          )}
          {canPip && !narrow && (
            <button className={`nxp-btn${pip ? " on" : ""}`} onClick={togglePip} aria-label={t("pl_pip")} aria-pressed={pip} data-testid="pip-btn"><PictureInPicture2 size={19} /></button>
          )}
          {app ? (
            <button className="nxp-btn" onClick={onRotate} aria-label={t(wide ? "portrait" : "rotate")} data-testid="rotate-btn">{wide ? <Minimize size={19} /> : <Maximize size={19} />}</button>
          ) : (
            <button className="nxp-btn" onClick={onFullscreen} aria-label={t(fs ? "pl_exit_fullscreen" : "fullscreen")} title={t(fs ? "pl_exit_fullscreen" : "fullscreen")} data-testid="fullscreen-btn">
              {fs ? <Minimize size={19} /> : <Maximize size={19} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
