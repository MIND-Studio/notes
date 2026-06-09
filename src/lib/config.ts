/**
 * Single source of truth for pod URLs. Every Solid call in this prototype
 * flows through here.
 */

/**
 * Given a WebID like `https://pods.mindpods.org/alice/profile/card#me`,
 * return the pod root `https://pods.mindpods.org/alice/`. CSS layouts vary
 * across providers; for the prototype we assume the WebID lives one level
 * under the pod.
 */
export function podRootFromWebId(webId: string): string {
  const url = new URL(webId);
  url.hash = "";
  url.search = "";
  const parts = url.pathname.split("/").filter(Boolean);
  // profile/card → drop the last two segments to get the pod root path
  if (parts.length >= 2 && parts[parts.length - 1].startsWith("card")) {
    parts.pop();
    parts.pop();
  }
  url.pathname = "/" + parts.join("/") + (parts.length ? "/" : "");
  return url.toString();
}

/** `{podRoot}apps/notes/` — the container all notes live in. */
export function notesContainerFor(podRoot: string): string {
  const root = podRoot.endsWith("/") ? podRoot : podRoot + "/";
  return `${root}apps/notes/`;
}
