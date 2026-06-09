# Mind Notes

Your notes, in your pod.

A calm, text-first markdown notes app built on Solid Pods. Every note is a
plain `.md` file at `{podRoot}apps/notes/{id}.md` in **your** pod — there is
no index file (the container listing is the index), no database, and no
server-side storage of any kind. The title of a note is simply the first line
of its body.

Sibling prototype in the Mind workspace (drive, chat, shell, …) — own dir,
own port, own repo.

## Run it

```bash
export NODE_AUTH_TOKEN=<read:packages PAT>   # @mind-studio/* from GitHub Packages
npm install
npm run dev                                   # → http://localhost:3120
```

Dev server runs on port **3120**.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SOLID_ISSUER` | `https://pods.mindpods.org/` | Solid OIDC issuer used by the login card |

## How it works

- `/connect` — sign in with your Solid identity (shared `MindLoginCard`).
- `/notes` — sidebar lists notes (title + relative modified time) with
  search-as-you-filter and a New note button; the right pane is a plain
  monospace `<textarea>` with an explicit Save and a confirmed Delete.
- All pod I/O goes through `@inrupt/solid-client` with the session fetch
  (`src/lib/solid/pod-fs.ts`). The `apps/notes/` container is created lazily
  on the first write; a 404 on first list is the empty state.
