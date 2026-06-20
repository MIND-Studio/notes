"use client";

import type { BrokerIdentity, BrokerTheme } from "@mind-studio/core/solid";
import { solid } from "./client";

/**
 * Thin re-exports over the shared {@link solid} client's broker (see
 * `client.ts`). The Mind shell capability bridge — handshake, brokered fetch
 * tunnel, theme sync, ready signal — now lives in `@mind-studio/core/solid`;
 * these shims keep the app's existing import paths stable.
 */
export type { BrokerIdentity, BrokerTheme };

export function isBrokered(): boolean {
  return solid.broker.isBrokered();
}

export function brokeredIdentity(): BrokerIdentity | null {
  return solid.broker.brokeredIdentity();
}

export function currentBrokeredTheme(): BrokerTheme | null {
  return solid.broker.currentBrokeredTheme();
}

export function subscribeBrokeredTheme(fn: () => void): () => void {
  return solid.broker.subscribeBrokeredTheme(fn);
}

export const brokerFetch: typeof fetch = solid.broker.brokerFetch;

export function initBroker(): Promise<BrokerIdentity | null> {
  return solid.broker.initBroker();
}

export function signalReady(): void {
  solid.broker.signalReady();
}

/**
 * The active identity, brokered-first. Lives at the top level of the shared
 * client (not the broker) since it merges brokered + local-OIDC identity.
 */
export function currentIdentity(): { webId: string; podRoot: string } | null {
  return solid.currentIdentity();
}
