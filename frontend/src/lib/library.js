"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { DEFAULT_DIALECTS, DEFAULT_INFO_PANEL, DEFAULT_PHRASES } from "./defaults";

const KEY = "saathi.library";
const initial = { phrases: DEFAULT_PHRASES, infoPanel: DEFAULT_INFO_PANEL, ingredients: [], meta: null, dialects: DEFAULT_DIALECTS };

const Ctx = createContext(initial);
export const useLibrary = () => useContext(Ctx);

export function LibraryProvider({ children }) {
  const [lib, setLib] = useState(initial);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(KEY) || "null");
      if (cached) setLib({ ...initial, ...cached });
    } catch {
      /* ignore */
    }
    api("/api/library/active")
      .then((d) => {
        setLib({ ...initial, ...d });
        try {
          localStorage.setItem(KEY, JSON.stringify(d));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);

  return <Ctx.Provider value={lib}>{children}</Ctx.Provider>;
}
