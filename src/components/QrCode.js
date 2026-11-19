"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrCode({ token }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    QRCode.toDataURL(`${base}/c/${token}`, { margin: 1, width: 280 })
      .then(setSrc)
      .catch(() => {});
  }, [token]);

  return (
    <div className="qr">
      {src ? <img src={src} alt="QR code that replays the audio guide" width={140} height={140} /> : <div className="qr-ph" />}
      <small>QR স্ক্যান করে অডিও আবার শুনুন</small>
    </div>
  );
}
