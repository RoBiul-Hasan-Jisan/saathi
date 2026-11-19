"use client";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth";
import { LibraryProvider } from "@/lib/library";

// Registers the offline helper (service worker) in production builds only.
function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <LibraryProvider>
        <RegisterSW />
        {children}
      </LibraryProvider>
    </AuthProvider>
  );
}
