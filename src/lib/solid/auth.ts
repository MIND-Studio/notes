"use client";

import {
  handleIncomingRedirect,
  type ISessionInfo,
} from "@inrupt/solid-client-authn-browser";
import { session } from "./session";

const RETURN_TO_KEY = "mind-notes:return-to";

/**
 * The URL users should land on after the OIDC dance — set right before
 * triggering login(), read by /login/callback once the code is consumed.
 *
 * We deliberately do NOT use `restorePreviousSession: true` anywhere. In the
 * @inrupt browser SDK that flag is not a token-based silent restore — it is a
 * full-page redirect to the IdP. On CSS, calling it on every page load creates
 * an infinite /login/callback ↔ /notes loop, and even in the happy path it
 * round-trips through the IdP and discards the deep link. The price is that a
 * hard refresh lands on the signed-out prompt; we soften that by remembering
 * the attempted path (see `rememberSignedOutPath`) so reconnecting returns
 * there.
 */
export function rememberReturnTo(url: string) {
  if (typeof window === "undefined") return;
  if (url.startsWith("/login/callback") || url.startsWith("/connect")) return;
  try {
    sessionStorage.setItem(RETURN_TO_KEY, url);
  } catch {}
}

/**
 * Set the post-login destination ONLY if one isn't already remembered. The
 * signed-out view on a deep link records that path; the /connect form then
 * uses this to fall back to /notes without clobbering it.
 */
export function rememberReturnToDefault(url: string) {
  if (typeof window === "undefined") return;
  try {
    if (!sessionStorage.getItem(RETURN_TO_KEY)) rememberReturnTo(url);
  } catch {}
}

/**
 * Called by signed-out screens on mount to capture where the user was trying
 * to go, so a subsequent "Connect a pod" → login returns them there.
 */
export function rememberSignedOutPath() {
  if (typeof window === "undefined") return;
  rememberReturnTo(window.location.pathname + window.location.search);
}

export function consumeReturnTo(): string {
  if (typeof window === "undefined") return "/notes";
  try {
    const v = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  } catch {}
  return "/notes";
}

/**
 * Single-flight wrapper around `handleIncomingRedirect`. The OIDC
 * authorization code is one-time-use: redeeming it twice makes the token
 * endpoint return `invalid_grant`, which resets the @inrupt session back to
 * signed-out. The shell mounts several session-aware components at once
 * (header chip, callback page, notes surface), so memoizing the call to a
 * module-level promise guarantees the redirect is handled exactly once per
 * page load no matter how many components ask for the session.
 *
 * This is the ONLY call site of `handleIncomingRedirect` in the app. Never
 * add a second one.
 */
let redirectHandled: Promise<void> | null = null;

function handleRedirectOnce(): Promise<void> {
  if (!redirectHandled) {
    redirectHandled = handleIncomingRedirect({
      url: typeof window !== "undefined" ? window.location.href : undefined,
    })
      .then(() => undefined)
      // Swallow: a stale/replayed code rejects here, but the first (winning)
      // call already established the session. Callers re-read session().info.
      .catch(() => undefined);
  }
  return redirectHandled;
}

/**
 * Idempotent session check on page load. Consumes an OIDC code if the URL has
 * one (from a fresh redirect), but does NOT trigger silent re-auth. Returns
 * the current session info — caller is responsible for handling signed-out.
 */
export async function ensureSession(): Promise<ISessionInfo> {
  const s = session();
  if (s.info.isLoggedIn) return s.info;
  await handleRedirectOnce();
  return session().info;
}

/**
 * Completes the OIDC redirect on the /login/callback route. Shares the same
 * single-flight redemption as `ensureSession`, so the callback page and any
 * concurrently-mounted component never redeem the code twice.
 */
export async function completeLoginRedirect(): Promise<ISessionInfo> {
  await handleRedirectOnce();
  return session().info;
}
