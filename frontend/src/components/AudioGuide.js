"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLibrary } from "@/lib/library";
import { buildSpeechPlan, planKeys } from "@/lib/speech";
import { DEFAULT_DIALECTS } from "@/lib/defaults";

// Plays the card out loud. Recorded dialect clips are used where an approved one exists;
// everything else (names, missing clips) is spoken by the device's own voice.
export default function AudioGuide({ card }) {
  const lib = useLibrary();
  const plan = useMemo(() => buildSpeechPlan(lib.phrases, card, lib.ingredients), [card, lib]);
  const keys = useMemo(() => planKeys(plan), [plan]);
  const [manifest, setManifest] = useState(null);
  const [dialect, setDialect] = useState("std");
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("");
  const stop = useRef(false);
  const audioRef = useRef(null);

  useEffect(() => {
    try { setDialect(localStorage.getItem("saathi.dialect") || "std"); } catch {}
    fetch("/api/voices/manifest").then((r) => r.json()).then(setManifest).catch(() => {});
  }, []);

  const clips = manifest?.clips?.[dialect] || {};
  const covered = keys.filter((k) => clips[k]).length;
  const dialects = manifest?.dialects || lib.dialects || DEFAULT_DIALECTS;

  function chooseDialect(d) {
    setDialect(d);
    try { localStorage.setItem("saathi.dialect", d); } catch {}
  }

  const tts = (text) =>
    new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined") return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "bn-BD";
      const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith("bn"));
      if (v) u.voice = v;
      u.rate = 0.9;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });

  const clip = (id) =>
    new Promise((resolve) => {
      const a = new Audio(`/api/voices/${id}/audio`);
      audioRef.current = a;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.play().catch(() => resolve(false));
    });

  async function play() {
    stop.current = false;
    setPlaying(true);
    setNote("");
    const hasBn = typeof speechSynthesis !== "undefined" && speechSynthesis.getVoices().some((v) => v.lang?.toLowerCase().startsWith("bn"));
    if (!hasBn && covered < keys.length) setNote("No Bangla voice found on this device. Read the card words, or install a Bangla voice in device settings.");
    for (const seg of plan) {
      if (stop.current) break;
      const id = seg.key && clips[seg.key];
      if (id && (await clip(id))) continue;
      await tts(seg.text);
    }
    setPlaying(false);
  }

  function halt() {
    stop.current = true;
    audioRef.current?.pause();
    speechSynthesis?.cancel();
    setPlaying(false);
  }

  async function saveOffline() {
    const ids = keys.map((k) => clips[k]).filter(Boolean);
    await Promise.all(ids.map((id) => fetch(`/api/voices/${id}/audio`).catch(() => null)));
    setNote(ids.length ? `Saved ${ids.length} voice clips on this device.` : "No recorded clips for this dialect yet. The device voice will be used.");
  }

  return (
    <div className="card noprint">
      <h3>Listen</h3>
      <div className="row">
        <select value={dialect} onChange={(e) => chooseDialect(e.target.value)} style={{ maxWidth: 220 }} aria-label="Dialect">
          {dialects.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
        {!playing ? <button className="btn" onClick={play}>▶ Play</button> : <button className="btn danger" onClick={halt}>■ Stop</button>}
        <button className="btn secondary small" onClick={saveOffline}>Save voice for offline</button>
      </div>
      <p className="small muted" style={{ marginTop: ".5rem" }}>
        Recorded voice for {covered} of {keys.length} fixed phrases in this dialect. Names and anything missing use the device voice.
      </p>
      {note && <p className="small">{note}</p>}
    </div>
  );
}
