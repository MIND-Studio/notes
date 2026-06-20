"use client";

import { Spinner } from "@mind-studio/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ensureSession } from "@/lib/solid/auth";

/**
 * Root route: logged in → /notes, signed out → /connect. The session check
 * goes through the single-flight `ensureSession`, so a fresh OIDC code in the
 * URL is consumed exactly once even with the header mounted alongside.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    ensureSession()
      .then((info) => {
        router.replace(info.isLoggedIn ? "/notes" : "/connect");
      })
      .catch(() => router.replace("/connect"));
  }, [router]);

  return (
    <section className="flex flex-1 items-center justify-center py-24">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Spinner className="size-4" />
        <span className="text-sm">Checking your session…</span>
      </div>
    </section>
  );
}
