"use client";

import { Button, useMindTheme } from "@mind-studio/ui";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Light/dark switch backed by the @mind-studio/ui ThemeProvider (next-themes
 * under the hood). Everything theme-dependent is gated on `mounted` so the
 * hydration render matches the server (which has no resolved theme).
 */
export default function ThemeToggle() {
  const { resolvedMode, setMode } = useMindTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedMode === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setMode(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
