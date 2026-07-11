"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Theme, ThemeProviderProps } from "./types";
import type { ThemeName } from "./db/schema";

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ThemeName;
  setColorTheme: (colorTheme: ThemeName) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  colorTheme: "default",
  setColorTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  initialColorTheme = "default",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [colorTheme, setColorThemeState] = useState<ThemeName>(initialColorTheme);

  useEffect(() => {
    // Get stored theme or use default
    const storedTheme = localStorage.getItem(storageKey) as Theme;
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, [storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("theme-default", "theme-midnight", "theme-sepia", "theme-forest");
    root.classList.add(`theme-${colorTheme}`);
  }, [colorTheme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    colorTheme,
    setColorTheme: (colorTheme: ThemeName) => {
      setColorThemeState(colorTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};