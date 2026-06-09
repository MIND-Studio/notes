# AGENTS.md — notes

Orientation rules for agents working in this prototype. **Read this before
editing any file here.**

## What it is

Mind Notes — a markdown notes app on Solid Pods. Each note is a plain `.md`
file at `{podRoot}apps/notes/{id}.md` (id = `crypto.randomUUID()`); the title
is the first line of the body; the container listing is the index (no index
file). Dev port **3120**. Sibling of drive/chat/shell — do not unify with
sibling prototypes.

## NOT the Next.js you know

Next.js **16.2.6** + React **19.2.4**. APIs have shifted from training-cutoff
knowledge. Read `node_modules/next/dist/docs/` before relying on what you
"know".

## Hard rules

1. **Pod is the ONLY store.** No API routes that persist anything, no DB, no
   server-side state. All reads/writes go through `@inrupt/solid-client` with
   the session fetch (`src/lib/solid/pod-fs.ts`). The `/api/client-id` route
   serves a static OIDC client document — it stores nothing.
2. **Single-flight OIDC.** `handleIncomingRedirect` is memoized in
   `src/lib/solid/auth.ts` and called exactly once per page load. Never add a
   second call site — a replayed one-time code wipes the session.
3. **Never log** tokens or secrets. WebID, route, status are fine.
4. **Solid gotchas:** `saveFileInContainer`'s slug is advisory (we PUT to
   minted URLs instead); always pass `contentType` explicitly; no atomic
   rename or recursive delete; CSS v7 is WAC.

## Design system

Entirely `@mind-studio/ui` (shadcn-native), Mind brand, **dark** default.
`globals.css` imports `@mind-studio/ui/dist/styles.css` + `@source`s its dist.
Semantic tokens only (`bg-background`, `text-muted-foreground`, `border`,
`bg-primary`, …) — no bespoke palette. RSC gotcha: don't import
`Card`/`Badge`/`cn` into server components; pages stay `"use client"` or plain
markup + `Button asChild`. `@mind-studio/*` install from GitHub Packages —
`export NODE_AUTH_TOKEN=<read:packages PAT>` before `npm install`.

## Layout

- `src/lib/solid/` — `auth.ts` (single-flight OIDC), `session.ts` (issuer +
  default session), `pod-fs.ts` (readdir / read / write / unlink).
- `src/lib/config.ts` — `podRootFromWebId`, `notesContainerFor`.
- `src/lib/notes.ts` — note model (`titleFromBody`, `relativeTime`).
- `src/components/NotesApp.tsx` — the whole `/notes` surface.

## Never commit

`node_modules/`, `.next/`, `.css-data/`, `.env*`.

## Ask before doing

- Any server-side persistence (the pod is the only store).
- Adding third-party SDKs that phone home.
- Touching sibling prototypes — they have their own `AGENTS.md`.
