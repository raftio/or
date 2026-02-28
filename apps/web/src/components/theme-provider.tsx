"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark";
export type Accent = "cyan" | "pink";

const STORAGE_KEY = "orca_theme";
const ACCENT_KEY = "orca_accent";
const VALID_ACCENTS: Accent[] = ["cyan", "pink"];

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
} | null>(null);

function applyAccent(accent: Accent) {
  if (accent === "cyan") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", accent);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [accent, setAccentState] = useState<Accent>("cyan");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const doc = document.documentElement.getAttribute("data-theme") as
      | Theme
      | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      if (stored === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else if (doc === "light" || doc === "dark") {
      setThemeState(doc);
      if (doc === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    const storedAccent = localStorage.getItem(ACCENT_KEY) as Accent | null;
    if (storedAccent && VALID_ACCENTS.includes(storedAccent)) {
      setAccentState(storedAccent);
      applyAccent(storedAccent);
    } else {
      const docAccent = document.documentElement.getAttribute("data-accent") as Accent | null;
      if (docAccent && VALID_ACCENTS.includes(docAccent)) {
        setAccentState(docAccent);
      }
    }

    setMounted(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  }, [theme, setTheme]);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    applyAccent(next);
    localStorage.setItem(ACCENT_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: mounted ? theme : "light",
        setTheme,
        toggleTheme,
        accent: mounted ? accent : "cyan",
        setAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
