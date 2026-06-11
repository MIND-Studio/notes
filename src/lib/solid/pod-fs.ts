"use client";

import {
  getSolidDataset,
  getContainedResourceUrlAll,
  getThing,
  getDatetime,
  deleteFile,
  overwriteFile,
  getFile,
  createContainerAt,
} from "@inrupt/solid-client";
import { session } from "./session";
import { isBrokered, brokerFetch } from "./broker";

/**
 * Thin wrappers around the Solid LDP HTTP API. All pod I/O in this prototype
 * flows through here with the OIDC session's authed fetch — the pod is the
 * ONLY store.
 *
 * Solid constraints we live with:
 *   - `saveFileInContainer`'s slug is advisory — we avoid it entirely and PUT
 *     to a URL we mint ourselves (overwriteFile), so the URL is ours.
 *   - Always pass `contentType` explicitly; the default is octet-stream.
 *   - No atomic rename / recursive delete (we need neither here).
 */

export type PodEntry = {
  url: string;
  name: string;
  kind: "container" | "resource";
  modified?: Date;
};

/**
 * The fetch every pod call runs through. When Notes is hosted in the Mind
 * shell (brokered mode) this is the shell's scope-checked broker fetch — Notes
 * holds no session of its own; otherwise it's the local OIDC session's authed
 * fetch.
 */
function authedFetch(): typeof fetch {
  return isBrokered() ? brokerFetch : (session().fetch as typeof fetch);
}

/**
 * Wrap the authenticated fetch with `cache: 'no-store'` so CSS containment
 * triples aren't served from the browser cache after a write. Without this,
 * listing right after a save/delete sees stale results.
 */
function noCacheFetch(): typeof fetch {
  const inner = authedFetch();
  return ((url: RequestInfo | URL, init?: RequestInit) =>
    inner(url, { ...init, cache: "no-store" })) as typeof fetch;
}

function ensureSlash(u: string) {
  return u.endsWith("/") ? u : u + "/";
}

function statusOf(e: unknown): number | undefined {
  const maybe = e as { statusCode?: number; response?: { status?: number } };
  return maybe?.statusCode ?? maybe?.response?.status;
}

/** True when the error is a 404 — used to treat a missing container as empty. */
export function isNotFound(e: unknown): boolean {
  return statusOf(e) === 404;
}

/** List a container one level deep. Throws on errors, including 404. */
export async function readdir(containerUrl: string): Promise<PodEntry[]> {
  const parent = ensureSlash(containerUrl);
  const dataset = await getSolidDataset(parent, { fetch: noCacheFetch() });
  const urls = getContainedResourceUrlAll(dataset);
  return urls.map((url): PodEntry => {
    const isContainer = url.endsWith("/");
    const thing = getThing(dataset, url);
    const modified = thing
      ? getDatetime(thing, "http://purl.org/dc/terms/modified") ?? undefined
      : undefined;
    const tail = url.slice(parent.length);
    return {
      url,
      name: isContainer ? tail.slice(0, -1) : tail,
      kind: isContainer ? "container" : "resource",
      modified,
    };
  });
}

export async function readFileText(url: string): Promise<string> {
  const blob = await getFile(url, { fetch: noCacheFetch() });
  return await blob.text();
}

/**
 * PUT text to an exact URL. Creates the parent container lazily on the first
 * write: CSS auto-creates intermediate containers on PUT, but other servers
 * may 404/409 — in that case we create the container explicitly and retry
 * once.
 */
export async function writeFileText(
  url: string,
  contents: string,
  contentType = "text/markdown"
): Promise<void> {
  const put = () =>
    overwriteFile(url, new Blob([contents], { type: contentType }), {
      contentType,
      fetch: authedFetch(),
    });
  try {
    await put();
  } catch (e) {
    const status = statusOf(e);
    if (status !== 404 && status !== 409) throw e;
    const parent = url.slice(0, url.lastIndexOf("/") + 1);
    // 409 from createContainerAt means it already exists — fine either way.
    await createContainerAt(parent, { fetch: authedFetch() }).catch(() => {});
    await put();
  }
}

export async function unlink(url: string): Promise<void> {
  await deleteFile(url, { fetch: authedFetch() });
}
