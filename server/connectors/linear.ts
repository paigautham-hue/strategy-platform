/**
 * Linear connector — IMPLEMENTATION_PLAN.md Phase 5, Workstream 5.2
 *
 * The first execution-tool connector. Linear exposes a GraphQL API; a personal
 * API key is passed directly in the `Authorization` header. This module is a
 * thin, defensive client — connection test, team listing, and issue creation —
 * with every call wrapped so a connector failure never throws into the caller.
 *
 * The exact GraphQL field shapes are verified against the live API on the
 * first deployment (the connector cannot be exercised without a real token).
 */

const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

export interface LinearTeam {
  id: string;
  name: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  url: string;
  state: string;
}

export interface LinearResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function linearGraphql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<LinearResult<T>> {
  try {
    const resp = await fetch(LINEAR_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Linear personal API keys go directly in the Authorization header.
        Authorization: token,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await resp.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (!resp.ok) {
      return { ok: false, error: `Linear API returned ${resp.status}` };
    }
    if (json.errors && json.errors.length > 0) {
      return { ok: false, error: json.errors.map((e) => e.message).join("; ") };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verify a token by fetching the authenticated Linear user. */
export async function testLinearConnection(
  token: string,
): Promise<{ ok: boolean; name?: string; error?: string }> {
  const result = await linearGraphql<{ viewer: { id: string; name: string } }>(
    token,
    "query { viewer { id name } }",
  );
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? "Could not reach Linear." };
  }
  return { ok: true, name: result.data.viewer.name };
}

/** List the Linear teams the token can see — the user picks one to push into. */
export async function listLinearTeams(
  token: string,
): Promise<{ ok: boolean; teams?: LinearTeam[]; error?: string }> {
  const result = await linearGraphql<{ teams: { nodes: LinearTeam[] } }>(
    token,
    "query { teams { nodes { id name } } }",
  );
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? "Could not list Linear teams." };
  }
  return { ok: true, teams: result.data.teams.nodes };
}

/** Create a Linear issue in a team from an initiative. */
export async function createLinearIssue(
  token: string,
  teamId: string,
  title: string,
  description: string,
): Promise<{ ok: boolean; issue?: LinearIssue; error?: string }> {
  const result = await linearGraphql<{
    issueCreate: {
      success: boolean;
      issue: {
        id: string;
        identifier: string;
        url: string;
        state: { name: string } | null;
      } | null;
    };
  }>(
    token,
    `mutation CreateIssue($input: IssueCreateInput!) {
       issueCreate(input: $input) {
         success
         issue { id identifier url state { name } }
       }
     }`,
    { input: { teamId, title, description } },
  );

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? "Could not create the Linear issue." };
  }
  const created = result.data.issueCreate;
  if (!created.success || !created.issue) {
    return { ok: false, error: "Linear rejected the issue creation." };
  }
  return {
    ok: true,
    issue: {
      id: created.issue.id,
      identifier: created.issue.identifier,
      url: created.issue.url,
      state: created.issue.state?.name ?? "Todo",
    },
  };
}
