"use client";

import { clearLastIdentity } from "@mind-studio/core";
import { Button } from "@mind-studio/ui";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { ensureSession } from "@/lib/solid/auth";
import { session } from "@/lib/solid/session";

const APP_NAME = "Notes";

/**
 * App masthead: name, theme toggle, account chip (WebID host) + sign-out.
 * Session state comes from the memoized `ensureSession` — safe to call from
 * many components; the OIDC redirect itself is single-flight in auth.ts.
 */
export default function Header() {
  const router = useRouter();
  const [webId, setWebId] = useState<string | null>(null);

  useEffect(() => {
    ensureSession()
      .then((info) => setWebId(info.webId ?? null))
      .catch(() => setWebId(null));
  }, []);

  async function onSignOut() {
    await session().logout();
    clearLastIdentity(APP_NAME);
    setWebId(null);
    router.replace("/connect");
  }

  const host = (() => {
    if (!webId) return null;
    try {
      return new URL(webId).host;
    } catch {
      return webId;
    }
  })();

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="text-xl font-semibold tracking-tight">Mind Notes</span>
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
            <span className="text-primary">●</span> notes in your pod
          </span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Main">
          {host && (
            <span
              className="hidden rounded-full border bg-muted/40 px-3 py-1 font-mono text-xs text-muted-foreground sm:inline"
              title={webId ?? undefined}
              data-testid="account-chip"
            >
              {host}
            </span>
          )}
          <ThemeToggle />
          {webId && (
            <Button variant="ghost" size="sm" onClick={onSignOut} data-testid="sign-out">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
