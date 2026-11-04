// Applies the pending migrations in drizzle/ before the production build, so
// a merge no longer needs psql by hand. A failed migration fails the build
// and the previous deployment stays live; the pending ones run in a single
// transaction, so none is half applied.
//
// Runs only on Vercel production builds, or with RUN_MIGRATIONS=1. The
// database must have been baselined once (npm run db:baseline): it was
// created with drizzle-kit push, and without a record of what is applied the
// migrator would replay everything from 0000.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (process.env.VERCEL_ENV !== "production" && !process.env.RUN_MIGRATIONS) {
  process.exit(0);
}

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const journal = JSON.parse(
  readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"),
);

// Arbitrary constant shared by every build that migrates this database.
const MIGRATION_LOCK_ID = 7_351_902_448;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15_000,
});
await client.connect();

const fail = async (message) => {
  console.error(message);
  await client.end();
  process.exit(1);
};

const {
  rows: [{ table }],
} = await client.query(
  "select to_regclass('drizzle.__drizzle_migrations') as table",
);
const {
  rows: [{ last }],
} = table
  ? await client.query(
      "select max(created_at) as last from drizzle.__drizzle_migrations",
    )
  : { rows: [{ last: null }] };
if (last === null) {
  await fail(
    "The database has no record of applied migrations. Run `npm run db:baseline` once (see the README) before deploying.",
  );
}

const pending = journal.entries.filter((entry) => entry.when > Number(last));
if (pending.length === 0) {
  console.log("No pending migrations.");
  await client.end();
  process.exit(0);
}

// A migration waiting behind a busy table would hold up every query queued
// after it; giving up after 10 seconds fails the build instead. This is a
// session-level SET, which holds because the client is one plain connection
// (not a transaction-mode pooler) that also runs the migration statements.
await client.query("set lock_timeout = '10s'");
console.log(`Applying ${pending.map(({ tag }) => tag).join(", ")}...`);
// The migrator reads what is already applied before it opens its transaction,
// so two overlapping builds could both see the same pending set. The advisory
// lock makes the second one wait, then find nothing left to apply. It belongs
// to this session, so it is also released if the connection drops.
await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
try {
  await migrate(drizzle(client), { migrationsFolder });
} catch (error) {
  await fail(`Migration failed, nothing was applied: ${error.message}`);
} finally {
  await client
    .query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID])
    .catch(() => {});
}
console.log("Migrations applied.");
await client.end();
