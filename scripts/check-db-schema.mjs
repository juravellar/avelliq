// Fails the production build when the database lacks a column the code
// selects, or an index it relies on (the unique CPF index, for one). It runs
// after scripts/migrate.mjs, as a safety net: deploying code before its
// migration takes every page that reads the new column down.
// A failed build keeps the previous deployment live instead.
//
// Runs only on Vercel production builds, or with CHECK_DB_SCHEMA=1.
import { fileURLToPath } from "node:url";

import pg from "pg";

import { snapshotColumns, snapshotIndexes } from "./snapshot-columns.mjs";

if (process.env.VERCEL_ENV !== "production" && !process.env.CHECK_DB_SCHEMA) {
  process.exit(0);
}

const drizzleDir = fileURLToPath(new URL("../drizzle", import.meta.url));
const expectedColumns = snapshotColumns(drizzleDir);
const expectedIndexes = snapshotIndexes(drizzleDir);

// An unreachable database fails the build within seconds instead of leaving
// it hanging until the platform's build timeout.
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15_000,
  query_timeout: 15_000,
});
await client.connect();
const [columns, indexes] = await Promise.all([
  client.query(
    `select table_name || '.' || column_name as name
       from information_schema.columns
      where table_schema = 'public'`,
  ),
  client.query(
    `select indexname as name from pg_indexes where schemaname = 'public'`,
  ),
]);
await client.end();

const presentColumns = new Set(columns.rows.map((row) => row.name));
const presentIndexes = new Set(indexes.rows.map((row) => row.name));
const missing = [
  ...expectedColumns
    .filter((column) => !presentColumns.has(column))
    .map((column) => `column ${column}`),
  ...expectedIndexes
    .filter((index) => !presentIndexes.has(index))
    .map((index) => `index ${index}`),
];
if (missing.length > 0) {
  console.error(
    `The database is missing ${missing.length} item(s) the code relies on:\n` +
      missing.map((item) => `  - ${item}`).join("\n") +
      "\nApply the pending migrations in drizzle/ before deploying.",
  );
  process.exit(1);
}
console.log(
  `Database schema OK (${expectedColumns.length} columns, ${expectedIndexes.length} indexes checked).`,
);
