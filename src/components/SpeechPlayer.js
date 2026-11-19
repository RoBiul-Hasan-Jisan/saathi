"use client";
import { useEffect, useRef, useState } from "react";

// Reads the Bangla guide aloud with the browser's built-in text-to-speech.
// Works offline when the device has a Bangla voice installed.
export default function SpeechPlayer({ chunks }) {
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [supported, setSupported] = useState(true);
  const [hasBnVoice, setHasBnVoice] = useState(true);
  const runRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const synth = window.speechSynthesis;
    const check = () => {
      const voices = synth.getVoices();
      if (voices.length) setHasBnVoice(voices.some((v) => v.lang?.toLowerCase().startsWith("bn")));
    };
    check();
    synth.addEventListener?.("voiceschanged", check);
    return () => {
      runRef.current++;
      synth.cancel();
      synth.removeEventListener?.("voiceschanged", check);
    };
  }, []);

  function stop() {
    runRef.current++;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }

  function play() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const run = ++runRef.current;
    setPlaying(true);
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("bn"));
    let i = 0;
    const next = () => {
      if (run !== runRef.current) return;
      if (i >= chunks.length) {
        setPlaying(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.lang = voice?.lang || "bn-BD";
      if (voice) u.voice = voice;
      u.rate = slow ? 0.7 : 0.95;
      u.onend = next;
      u.onerror = () => {
        if (run === runRef.current) setPlaying(false);
      };
      synth.speak(u);
    };
    next();
  }

  if (!supported) {
    return <p className="muted">This browser cannot play audio guides. Use the printed card or timetable.</p>;
  }

  return (
    <div className="player no-print">
      <button className="play-btn" onClick={playing ? stop : play} aria-label={playing ? "Stop audio" : "Play audio guide"}>
        {playing ? "■  থামান" : "▶  শুনুন"}
      </button>
      <label className="check">
        <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
        ধীরে পড়ুন (slow)
      </label>
      {!hasBnVoice && (
        <p className="warn">
          No Bangla voice was found on this device, so audio may sound wrong or stay silent. Install a Bangla
          text-to-speech voice in the device settings, or use the printed card.
        </p>
      )}
    </div>
  );
}
