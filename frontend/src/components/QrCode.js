"use client";
import { useEffect, useState } from "react";

// Made on the device itself, so it works with no internet.
export default function QrCode({ text, size = 180 }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let off = false;
    import("qrcode").then((m) => m.default.toDataURL(text, { width: size * 2, margin: 1 })).then((u) => !off && setSrc(u)).catch(() => {});
    return () => {
      off = true;
    };
  }, [text, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt="QR code for this medicine card" /> : <div className="qr" style={{ width: size, height: size }} />;
}
