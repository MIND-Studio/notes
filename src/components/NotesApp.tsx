"use client";

import { Button, Input, Spinner } from "@mind-studio/ui";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { notesContainerFor } from "@/lib/config";
import { idFromUrl, type NoteMeta, relativeTime, titleFromBody } from "@/lib/notes";
import { ensureSession, rememberSignedOutPath } from "@/lib/solid/auth";
import { currentIdentity, isBrokered, signalReady } from "@/lib/solid/broker";
import { isNotFound, readdir, readFileText, unlink, writeFileText } from "@/lib/solid/pod-fs";

type SaveState = "saved" | "saving" | "dirty";

const NEW_NOTE_BODY = "# Untitled\n\n";

/**
 * The whole notes surface: sidebar (list + search + new) and a plain
 * markdown <textarea> editor with an explicit Save. All state lives in the
 * pod — each note is `{podRoot}apps/notes/{id}.md`; the container listing is
 * the index, titles come from each body's first line.
 */
export default function NotesApp() {
  const router = useRouter();

  // session — webId + pod root together, since brokered mode supplies both.
  const [identity, setIdentity] = useState<{
    webId: string;
    podRoot: string;
  } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // list
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [query, setQuery] = useState("");

  // editor
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savedBody, setSavedBody] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const container = useMemo(
    () => (identity ? notesContainerFor(identity.podRoot) : null),
    [identity],
  );

  // --- session gate -------------------------------------------------------
  useEffect(() => {
    ensureSession()
      .then(() => {
        // Identity is brokered-first: inside the Mind shell it's the shell's
        // webId + workspace pod root (no local session); standalone it's the
        // OIDC session.
        const id = currentIdentity();
        if (id) {
          setIdentity(id);
        } else {
          // Remember the deep link so reconnecting returns here.
          rememberSignedOutPath();
          router.replace("/connect");
        }
      })
      .catch(() => router.replace("/connect"))
      .finally(() => setSessionChecked(true));
  }, [router]);

  // --- load the list ------------------------------------------------------
  const loadNotes = useCallback(async (containerUrl: string) => {
    setListLoading(true);
    setError(null);
    try {
      let entries;
      try {
        entries = await readdir(containerUrl);
      } catch (e) {
        if (isNotFound(e)) {
          // Container doesn't exist yet — that IS the empty state, not an
          // error. It gets created lazily on the first write.
          setNotes([]);
          return;
        }
        throw e;
      }
      const files = entries.filter((en) => en.kind === "resource" && en.name.endsWith(".md"));
      // Titles live in the bodies (first line) — fetch each note's text.
      // Notes are small; tolerate individual failures.
      const metas = await Promise.all(
        files.map(async (f): Promise<NoteMeta> => {
          let title = "Untitled";
          try {
            title = titleFromBody(await readFileText(f.url));
          } catch {
            title = "(unreadable note)";
          }
          return { url: f.url, id: idFromUrl(f.url), title, modified: f.modified };
        }),
      );
      metas.sort((a, b) => (b.modified?.getTime() ?? 0) - (a.modified?.getTime() ?? 0));
      setNotes(metas);
    } catch (e) {
      setError(`Couldn't load your notes: ${String(e)}`);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!container) return;
    void (async () => {
      await loadNotes(container);
      // Tell the shell we've rendered so it drops its loading overlay (no-op
      // when standalone).
      if (isBrokered()) signalReady();
    })();
  }, [container, loadNotes]);

  // --- open a note --------------------------------------------------------
  const openNote = useCallback(async (url: string) => {
    setSelectedUrl(url);
    setNoteLoading(true);
    setError(null);
    try {
      const body = await readFileText(url);
      setDraft(body);
      setSavedBody(body);
      setSaveState("saved");
    } catch (e) {
      setError(`Couldn't open that note: ${String(e)}`);
      setSelectedUrl(null);
    } finally {
      setNoteLoading(false);
    }
  }, []);

  // --- create -------------------------------------------------------------
  async function createNote() {
    if (!container) return;
    setCreating(true);
    setError(null);
    const id = crypto.randomUUID();
    const url = `${container}${id}.md`;
    try {
      await writeFileText(url, NEW_NOTE_BODY, "text/markdown");
      const meta: NoteMeta = {
        url,
        id,
        title: titleFromBody(NEW_NOTE_BODY),
        modified: new Date(),
      };
      setNotes((prev) => [meta, ...prev]);
      setSelectedUrl(url);
      setDraft(NEW_NOTE_BODY);
      setSavedBody(NEW_NOTE_BODY);
      setSaveState("saved");
    } catch (e) {
      setError(`Couldn't create the note: ${String(e)}`);
    } finally {
      setCreating(false);
    }
  }

  // --- save ---------------------------------------------------------------
  async function saveNote() {
    if (!selectedUrl || saveState === "saving" || draft === savedBody) return;
    setSaveState("saving");
    setError(null);
    const body = draft;
    try {
      await writeFileText(selectedUrl, body, "text/markdown");
      setSavedBody(body);
      // Re-derive title + bump modified locally; no full reload needed.
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.url === selectedUrl ? { ...n, title: titleFromBody(body), modified: new Date() } : n,
        );
        next.sort((a, b) => (b.modified?.getTime() ?? 0) - (a.modified?.getTime() ?? 0));
        return next;
      });
      // If the user kept typing during the round-trip, the derived `dirty`
      // (draft !== savedBody) re-enables Save on the next render.
      setSaveState("saved");
    } catch (e) {
      setSaveState("dirty");
      setError(`Save failed — your text is still here, try again: ${String(e)}`);
    }
  }

  // --- delete -------------------------------------------------------------
  async function deleteNote() {
    if (!selectedUrl) return;
    setConfirmOpen(false);
    setError(null);
    const url = selectedUrl;
    try {
      await unlink(url);
      setNotes((prev) => prev.filter((n) => n.url !== url));
      setSelectedUrl(null);
      setDraft("");
      setSavedBody("");
      setSaveState("saved");
    } catch (e) {
      setError(`Delete failed: ${String(e)}`);
    }
  }

  function onDraftChange(value: string) {
    setDraft(value);
    setSaveState(value === savedBody ? "saved" : "dirty");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, query]);

  const selected = notes.find((n) => n.url === selectedUrl) ?? null;
  const dirty = draft !== savedBody;

  // --- render -------------------------------------------------------------
  if (!sessionChecked || !identity) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner className="size-4" />
          <span className="text-sm">Connecting to your pod…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
      {error && (
        <div
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-6 md:grid md:grid-cols-[280px_minmax(0,1fr)] md:items-start">
        {/* ---- sidebar ---- */}
        <aside className="flex flex-col gap-3">
          <Button
            onClick={createNote}
            disabled={creating}
            className="w-full justify-center"
            data-testid="new-note"
          >
            {creating ? <Spinner className="size-4" /> : <Plus className="size-4" />}
            New note
          </Button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="pl-9"
              data-testid="search"
            />
          </div>

          <nav
            aria-label="Notes"
            className="max-h-[40vh] overflow-y-auto rounded-lg border md:max-h-[calc(100vh-16rem)]"
          >
            {listLoading ? (
              <ListSkeleton />
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {notes.length === 0 ? "No notes yet." : "No notes match your search."}
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((n) => (
                  <li key={n.url}>
                    <button
                      type="button"
                      onClick={() => void openNote(n.url)}
                      className={`block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                        n.url === selectedUrl ? "bg-muted" : ""
                      }`}
                      data-testid="note-item"
                    >
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                        {relativeTime(n.modified) || "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </aside>

        {/* ---- editor pane ---- */}
        <section className="flex min-h-[50vh] flex-1 flex-col md:min-h-[calc(100vh-12rem)]">
          {noteLoading ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Spinner className="size-4" />
                <span className="text-sm">Opening note…</span>
              </div>
            </div>
          ) : selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] text-muted-foreground" data-testid="save-state">
                  {saveState === "saving" ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={saveNote}
                    disabled={!dirty || saveState === "saving"}
                    data-testid="save-note"
                  >
                    {saveState === "saving" && <Spinner className="size-4" />}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmOpen(true)}
                    className="text-destructive hover:text-destructive"
                    data-testid="delete-note"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </div>
              <textarea
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                spellCheck={false}
                className="min-h-[45vh] flex-1 resize-none rounded-lg border bg-card p-4 font-mono text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="# Title&#10;&#10;Write markdown…"
                data-testid="editor"
              />
              <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                {selected.url}
              </p>
            </>
          ) : notes.length === 0 && !listLoading ? (
            <EmptyState onCreate={createNote} creating={creating} />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">Select a note to start editing.</p>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete “${selected?.title ?? "this note"}”?`}
        description="This permanently removes the markdown file from your pod. There is no trash."
        onConfirm={() => void deleteNote()}
      />
    </div>
  );
}

function EmptyState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center">
      <FileText className="size-8 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold tracking-tight">Create your first note</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Notes are plain markdown files stored in your pod, under{" "}
          <span className="font-mono">apps/notes/</span>.
        </p>
      </div>
      <Button onClick={onCreate} disabled={creating} data-testid="empty-new-note">
        {creating ? <Spinner className="size-4" /> : <Plus className="size-4" />}
        New note
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
