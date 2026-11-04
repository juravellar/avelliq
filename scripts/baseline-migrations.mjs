// Run once on a database created with drizzle-kit push (production): records
// every migration in drizzle/ as applied, so scripts/migrate.mjs only runs
// the ones that come after. `npm run db:baseline` first checks that the
// database really has every column and index of the schema: baselining a
// database that lacks a migration would skip it for good.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import pg from "pg";

const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
const journal = JSON.parse(
  readFileSync(`${folder}/meta/_journal.json`, "utf8"),
);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15_000,
});
await client.connect();
try {
  await client.query("begin");
  await client.query('create schema if not exists "drizzle"');
  await client.query(`create table if not exists "drizzle"."__drizzle_migrations" (
    id serial primary key,
    hash text not null,
    created_at bigint
  )`);
  const {
    rows: [{ total }],
  } = await client.query(
    'select count(*)::int as total from "drizzle"."__drizzle_migrations"',
  );
  if (total > 0) {
    throw new Error(
      `Already baselined (${total} migrations recorded); nothing was changed.`,
    );
  }
  for (const { tag, when } of journal.entries) {
    // The same hash the migrator records: sha256 of the file as written.
    const hash = createHash("sha256")
      .update(readFileSync(`${folder}/${tag}.sql`).toString())
      .digest("hex");
    await client.query(
      'insert into "drizzle"."__drizzle_migrations" (hash, created_at) values ($1, $2)',
      [hash, when],
    );
  }
  await client.query("commit");
  console.log(
    `Recorded ${journal.entries.length} migrations as applied, up to ${journal.entries.at(-1).tag}.`,
  );
} catch (error) {
  await client.query("rollback");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
