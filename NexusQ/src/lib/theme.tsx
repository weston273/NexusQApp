import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";

export type AppTheme = "light" | "dark";

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="theme"
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

export function useAppTheme() {
  const { resolvedTheme, setTheme } = useTheme();
  const theme: AppTheme = resolvedTheme === "dark" ? "dark" : "light";

  const setAppTheme = React.useCallback(
    (nextTheme: AppTheme) => {
      setTheme(nextTheme);
    },
    [setTheme]
  );

  const toggleTheme = React.useCallback(() => {
    setAppTheme(theme === "dark" ? "light" : "dark");
  }, [setAppTheme, theme]);

  return {
    theme,
    setTheme: setAppTheme,
    toggleTheme,
  };
}
