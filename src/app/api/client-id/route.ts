import { NextResponse } from "next/server";

/**
 * Solid-OIDC **Client Identifier Document** for Mind Notes.
 *
 * Without a fixed `client_id`, the @inrupt browser SDK does a fresh *dynamic*
 * client registration on every login, minting a new client id each time —
 * CSS's "Remember this client" is keyed on the client id, so the consent
 * screen reappears on every sign-in. Pointing `login({ clientId })` at this
 * stable, dereferenceable document gives the app one durable identity.
 *
 * This route persists nothing — it serves a static, request-derived JSON-LD
 * document. The pod remains the only store.
 *
 * The document MUST be public JSON-LD whose `client_id` equals its own URL
 * and whose `redirect_uris` exactly match what we pass to `login()` (see
 * ConnectForm). NOTE: a containerised dev IdP can't dereference a `localhost`
 * URL, so the client only uses this on non-localhost origins.
 */
export const dynamic = "force-dynamic";

function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.includes("localhost") || host.includes("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const origin = publicOrigin(req);
  const doc = {
    "@context": ["https://www.w3.org/ns/solid/oidc-context.jsonld"],
    client_id: `${origin}/api/client-id`,
    client_name: "Mind Notes",
    redirect_uris: [`${origin}/login/callback`],
    post_logout_redirect_uris: [`${origin}/`],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "openid webid offline_access",
    token_endpoint_auth_method: "none",
    application_type: "web",
  };
  return new NextResponse(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/ld+json",
      "cache-control": "public, max-age=3600",
    },
  });
}
