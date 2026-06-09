/**
 * Note model helpers. A note is a markdown file at
 * `{podRoot}apps/notes/{id}.md` (id = crypto.randomUUID()). There is no index
 * file — the container listing IS the index. The title is derived from the
 * first non-empty line of the body (leading `#`s stripped).
 */

export type NoteMeta = {
  /** Full pod URL of the note resource. */
  url: string;
  /** The `{id}` part of `{id}.md`. */
  id: string;
  /** Derived from the body's first non-empty line. */
  title: string;
  /** Server-reported dc:modified from the container listing, if exposed. */
  modified?: Date;
};

export function titleFromBody(body: string): string {
  const first =
    body.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const stripped = first.replace(/^#+\s*/, "").trim();
  return stripped || "Untitled";
}

export function idFromUrl(url: string): string {
  const tail = url.slice(url.lastIndexOf("/") + 1);
  return tail.endsWith(".md") ? tail.slice(0, -3) : tail;
}

/** "just now" · "5m ago" · "3h ago" · "2d ago" · "Mar 4, 2026" */
export function relativeTime(date: Date | undefined, now = new Date()): string {
  if (!date) return "";
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
