import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Theme: "light" | "dark" | "system".
 *
 * Light is the default experience. "system" follows the OS and is the initial
 * value only when the user has never chosen — an explicit choice always wins,
 * which is why themes.css guards its dark media query with
 * :root:not([data-theme="light"]).
 */
const STORAGE_KEY = "devtrack-theme";
const ThemeContext = createContext(null);

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

/** Stamp the root element so CSS can resolve the theme. */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, [theme]);

  // Track OS changes only while following the system.
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next) => setThemeState(next), []);

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const toggle = useCallback(() => {
    setThemeState(resolved === "dark" ? "light" : "dark");
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
