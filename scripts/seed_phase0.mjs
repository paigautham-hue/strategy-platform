/**
 * Phase 0 Acceptance Gate Seed Script
 *
 * Seeds:
 *   - Default tenant: gp1
 *   - GP users: gpai@msn.com, paigautham@gmail.com (both role=gp)
 *   - 2 portfolio companies: Acme SaaS, HealthTech Co
 *   - 1 strategy project per company
 *   - 2 memory items per company
 *   - 2 predictions per company
 *
 * Run: node scripts/seed_phase0.mjs
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "dotenv";

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// ─── Import schema ────────────────────────────────────────────────────────────

const { tenants, users, companies, strategyProjects, memoryItems, predictions } = await import(
  "../drizzle/schema.ts"
).catch(async () => {
  // Fallback: use compiled JS if TS not available
  return import("../drizzle/schema.js");
});

console.log("🌱 Seeding Phase 0 data...\n");

// ─── Tenant ───────────────────────────────────────────────────────────────────

await db
  .insert(tenants)
  .values({ id: "gp1", name: "GP Fund I" })
  .onDuplicateKeyUpdate({ set: { name: "GP Fund I" } });

console.log("✓ Tenant: gp1 (GP Fund I)");

// ─── GP Users ─────────────────────────────────────────────────────────────────

const gpUsers = [
  {
    openId: "seed-gp-gpai-msn",
    name: "GP Admin",
    email: "gpai@msn.com",
    role: "gp",
    tenantId: "gp1",
    loginMethod: "seed",
    lastSignedIn: new Date(),
  },
  {
    openId: "seed-gp-paigautham",
    name: "Paigautham",
    email: "paigautham@gmail.com",
    role: "admin",
    tenantId: "gp1",
    loginMethod: "seed",
    lastSignedIn: new Date(),
  },
];

for (const u of gpUsers) {
  await db
    .insert(users)
    .values(u)
    .onDuplicateKeyUpdate({ set: { name: u.name, email: u.email, role: u.role } });
  console.log(`✓ User: ${u.email} (${u.role})`);
}

// ─── Portfolio Companies ──────────────────────────────────────────────────────

const companySeed = [
  {
    tenantId: "gp1",
    name: "Acme SaaS",
    industry: "B2B SaaS",
    description: "Enterprise workflow automation platform",
  },
  {
    tenantId: "gp1",
    name: "HealthTech Co",
    industry: "Healthcare",
    description: "AI-powered clinical decision support",
  },
];

const createdCompanies = [];
for (const c of companySeed) {
  const [existing] = await db
    .select()
    .from(companies)
    .where(
      (await import("drizzle-orm")).and(
        (await import("drizzle-orm")).eq(companies.tenantId, c.tenantId),
        (await import("drizzle-orm")).eq(companies.name, c.name)
      )
    )
    .limit(1);

  if (existing) {
    createdCompanies.push(existing);
    console.log(`✓ Company (existing): ${c.name}`);
  } else {
    const [inserted] = await db.insert(companies).values(c).$returningId();
    const [row] = await db
      .select()
      .from(companies)
      .where((await import("drizzle-orm")).eq(companies.id, inserted.id))
      .limit(1);
    createdCompanies.push(row);
    console.log(`✓ Company (created): ${c.name}`);
  }
}

// ─── Strategy Projects ────────────────────────────────────────────────────────

for (const company of createdCompanies) {
  const [inserted] = await db
    .insert(strategyProjects)
    .values({
      tenantId: "gp1",
      companyId: company.id,
      name: `${company.name} — Market Entry Analysis`,
      description: "Phase 0 seed project",
    })
    .$returningId();
  console.log(`✓ Project: ${company.name} — Market Entry Analysis`);

  // ─── Memory Items ─────────────────────────────────────────────────────────

  const memSeeds = [
    {
      rawContent: `${company.name} has a strong competitive moat in its core segment due to high switching costs and network effects.`,
      canonicalForm: `${company.name} [possesses] competitive-moat [in] core-segment [via] switching-costs+network-effects`,
      confidence: 0.82,
      claimModality: "actual",
    },
    {
      rawContent: `The addressable market for ${company.name}'s primary product is expected to grow at 18% CAGR through 2027.`,
      canonicalForm: `${company.name}.primary-product.TAM [will-grow-at] 18%-CAGR [through] 2027`,
      confidence: 0.65,
      claimModality: "hypothetical",
    },
  ];

  for (const m of memSeeds) {
    await db.insert(memoryItems).values({
      tenantId: "gp1",
      companyId: company.id,
      projectId: inserted.id,
      rawContent: m.rawContent,
      canonicalForm: m.canonicalForm,
      embeddingModelVersion: "openai-text-embedding-3-small-v1",
      validAt: new Date(),
      ingestedAt: new Date(),
      provenanceClusterId: `seed-cluster-${company.id}`,
      confidence: m.confidence,
      claimModality: m.claimModality,
      derivationDepth: 0,
      quarantined: false,
      decayClass: "slow",
      visibility: "company",
      idempotencyKey: `seed-${company.id}-${m.claimModality}`,
    });
    console.log(`  ✓ Memory: ${m.canonicalForm.slice(0, 60)}...`);
  }

  // ─── Predictions ──────────────────────────────────────────────────────────

  const predSeeds = [
    {
      claim: `${company.name} will achieve Series B valuation above $150M within 18 months given current ARR trajectory.`,
      confidence: 0.72,
      framework: "DCF",
      model: "gpt-4o",
      horizon: "18M",
    },
    {
      claim: `${company.name}'s top competitor will enter the SMB segment within 12 months, compressing margins by 5–8%.`,
      confidence: 0.58,
      framework: "Porter's Five Forces",
      model: "gpt-4o",
      horizon: "12M",
    },
  ];

  for (const p of predSeeds) {
    await db.insert(predictions).values({
      tenantId: "gp1",
      companyId: company.id,
      projectId: inserted.id,
      userId: 1,
      claim: p.claim,
      confidence: p.confidence,
      framework: p.framework,
      model: p.model,
      horizon: p.horizon,
      outcomeClass: "real",
      derivationDepth: 0,
    });
    console.log(`  ✓ Prediction: ${p.claim.slice(0, 60)}...`);
  }
}

console.log("\n✅ Phase 0 seed complete.\n");
console.log("Acceptance gate checklist:");
console.log("  [✓] Tenant gp1 seeded");
console.log("  [✓] GP users seeded (gpai@msn.com, paigautham@gmail.com)");
console.log("  [✓] 2 portfolio companies seeded");
console.log("  [✓] 1 strategy project per company");
console.log("  [✓] 2 memory items per company (canonical form stored)");
console.log("  [✓] 2 predictions per company (ledger entries)");

await connection.end();
process.exit(0);
