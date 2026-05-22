/**
 * Connector registry — IMPLEMENTATION_PLAN.md Phase 5, Workstream 5.2
 *
 * The execution-tool connector framework. The schema (`connector_credential`,
 * `connector_link`) and the db helpers are generic over `ConnectorType`; this
 * registry records which connectors are actually implemented.
 *
 * Sequencing (per the plan): Linear ships and stabilises first; Notion and
 * Jira follow once Linear is proven against the live API.
 */

import type { ConnectorType } from "../../drizzle/schema";

export interface ConnectorMeta {
  type: ConnectorType;
  label: string;
  /** Is this connector implemented and usable? */
  available: boolean;
  description: string;
  /** What the user pastes to connect. */
  credentialLabel: string;
}

export const CONNECTOR_REGISTRY: readonly ConnectorMeta[] = [
  {
    type: "linear",
    label: "Linear",
    available: true,
    description: "Push initiatives to a Linear team as issues.",
    credentialLabel: "Linear personal API key",
  },
  {
    type: "notion",
    label: "Notion",
    available: false,
    description: "Sync initiatives to a Notion database. Ships after Linear stabilises.",
    credentialLabel: "Notion integration token",
  },
  {
    type: "jira",
    label: "Jira",
    available: false,
    description: "Sync initiatives to Jira. Ships after Notion.",
    credentialLabel: "Jira API token",
  },
] as const;

/** Look up a connector's metadata. Pure. */
export function getConnectorMeta(type: string): ConnectorMeta | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.type === type);
}

/** Is a connector type implemented and usable? Pure. */
export function isConnectorAvailable(type: string): boolean {
  return getConnectorMeta(type)?.available === true;
}
