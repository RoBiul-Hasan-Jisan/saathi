"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { clearAllPins } from "./pin";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const USER_KEY = "saathi.user"; // minimal: id, name, role, org. Lets the staff screens open while offline.
const LOGOUT_KEY = "saathi.pendingLogout";

const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null");
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked: the app still works, just without the offline shortcut */
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [offline, setOffline] = useState(false);

  const wipeLocal = useCallback(() => {
    write(USER_KEY, null);
    clearAllPins();
    navigator.serviceWorker?.controller?.postMessage({ type: "clear-private" });
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (read(LOGOUT_KEY)) {
        // A logout that could not reach the server earlier: finish it now.
        await api("/api/auth/logout", { method: "POST" });
        write(LOGOUT_KEY, null);
        wipeLocal();
        setUser(null);
        return;
      }
      const d = await api("/api/auth/me");
      setUser(d.user);
      setOffline(false);
      write(USER_KEY, d.user);
    } catch (e) {
      if (e instanceof ApiError && e.unreachable) {
        setOffline(true);
        setUser(read(LOGOUT_KEY) ? null : read(USER_KEY));
      } else setUser(null);
    }
  }, [wipeLocal]);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => setUser(null);
    const onOnline = () => refresh();
    window.addEventListener("saathi:unauthorized", onUnauthorized);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("saathi:unauthorized", onUnauthorized);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      write(LOGOUT_KEY, true); // sign out for real as soon as we are online again
    }
    wipeLocal();
    setUser(null);
    window.location.href = "/";
  }, [wipeLocal]);

  const logoutEverywhere = useCallback(async () => {
    await api("/api/auth/logout-all", { method: "POST" });
    wipeLocal();
    setUser(null);
    window.location.href = "/";
  }, [wipeLocal]);

  return (
    <Ctx.Provider value={{ user, setUser, loading: user === undefined, offline, refresh, logout, logoutEverywhere }}>
      {children}
    </Ctx.Provider>
  );
}
