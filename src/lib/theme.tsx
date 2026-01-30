import * as React from "react"

export type ThemeMode = "system" | "light" | "dark"
export type ResolvedTheme = "light" | "dark"

export type ThemeContextValue = {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  setThemeMode: (mode: ThemeMode) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const value = React.useContext(ThemeContext)
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return value
}

export function useThemeState(): ThemeContextValue {
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system"
    const stored = window.localStorage.getItem("theme")
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored
    }
    return "system"
  })
  const [systemDark, setSystemDark] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches)
    }
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem("theme", themeMode)
  }, [themeMode])

  const resolvedTheme: ResolvedTheme =
    themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  return React.useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
    }),
    [themeMode, resolvedTheme]
  )
}

export function ThemeProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: ThemeContextValue
}) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
