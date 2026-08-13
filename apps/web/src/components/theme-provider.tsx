"use client"

/**
 * Lightweight theme provider (no next-themes).
 * Avoids React 19 / Next 16: "Encountered a script tag while rendering".
 * FOUC script lives in layout.tsx <head>.
 */
import * as React from "react"

export type Theme = "dark" | "light"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (theme: Theme | string) => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined,
)

const STORAGE_KEY = "theme"

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
    root.classList.remove("light")
  } else {
    root.classList.remove("dark")
    root.classList.add("light")
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  attribute: _attribute = "class",
  enableSystem: _enableSystem = false,
  disableTransitionOnChange: _disableTransitionOnChange = false,
}: {
  children: React.ReactNode
  defaultTheme?: Theme | string
  attribute?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}) {
  const initial =
    defaultTheme === "light" || defaultTheme === "dark"
      ? defaultTheme
      : "dark"

  const [theme, setThemeState] = React.useState<Theme>(initial)

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const next: Theme =
        stored === "light" || stored === "dark" ? stored : initial
      setThemeState(next)
      applyThemeClass(next)
    } catch {
      applyThemeClass(initial)
    }
  }, [initial])

  const setTheme = React.useCallback((value: Theme | string) => {
    const next: Theme = value === "light" ? "light" : "dark"
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    applyThemeClass(next)
  }, [])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme: theme, setTheme }),
    [theme, setTheme],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: () => {},
    }
  }
  return ctx
}
