import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

export interface Db {
  sql: (strings: TemplateStringsArray, ...params: any[]) => Promise<any[]>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bounties (
  bounty_id int PRIMARY KEY,
  scope_hash text NOT NULL,
  escrow_wei text NOT NULL,
  deadline bigint NOT NULL,
  business text NOT NULL,
  state int NOT NULL,
  in_dispute boolean NOT NULL,
  dispute_requested boolean NOT NULL,
  first_submission_ts bigint,
  block_confirmed bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS submissions (
  bounty_id int NOT NULL,
  submission_id int NOT NULL,
  hash text NOT NULL,
  submitter text NOT NULL,
  ts bigint NOT NULL,
  state int NOT NULL,
  block_confirmed bigint,
  PRIMARY KEY (bounty_id, submission_id)
);
CREATE TABLE IF NOT EXISTS submission_reports (
  bounty_id int NOT NULL,
  submission_id int NOT NULL,
  content text NOT NULL,
  salt text NOT NULL,
  signature text NOT NULL,
  tx_hash text,
  PRIMARY KEY (bounty_id, submission_id)
);
CREATE TABLE IF NOT EXISTS sync_state (
  key text PRIMARY KEY,
  value text NOT NULL
);
`;

export async function createDb(): Promise<Db> {
  let raw: any;
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL);
    await (sql as any).unsafe(SCHEMA);
    raw = sql;
  } else {
    const pg = new PGlite();
    await (pg as any).exec(SCHEMA);
    raw = (pg as any).sql.bind(pg);
  }
  return {
    sql: async (strings: TemplateStringsArray, ...params: any[]) => {
      const out = await raw(strings, ...params);
      return (Array.isArray(out) ? out : (out?.rows ?? [])) as any[];
    }
  };
}