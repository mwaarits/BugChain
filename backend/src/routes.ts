import { Hono } from "hono";
import { verifyReceipt, submissionHash } from "./hash";
import type { Admin } from "./admin";
import type { Chain } from "./chain";
import type { Db } from "./db";
import { mapBountyRow, mapSubmissionRow } from "./map";

export function createApp(opts: { db: Db; chain: Chain; admin: Admin; indexer: any; adminToken?: string }) {
  const { db, chain, admin, indexer } = opts;
  const app = new Hono();

  const requireAdmin = (c: any) => {
    const token = opts.adminToken;
    if (!token) return c.json({ error: "admin endpoints disabled (no ADMIN_TOKEN set)" }, 503);
    if (c.req.header("authorization") !== `Bearer ${token}`) return c.json({ error: "unauthorized" }, 401);
    return null;
  };

  const latest = async () => indexer.latestBlock();
  const confirm = (block: unknown) => indexer.confirmationStatus(block ?? null, lastBlockCache);
  let lastBlockCache: bigint = 0n;

  app.use("*", async (_, next) => {
    lastBlockCache = await latest();
    await next();
  });

  app.onError((err, c) => {
    console.error("route error:", err);
    return c.text("Internal Server Error", 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/admin/sync", async (c) => c.json(await indexer.syncSnapshot()));

  app.get("/api/bounties", async (c) => {
    const rows: any[] = await db.sql`SELECT * FROM bounties ORDER BY bounty_id`;
    const bounties = rows.map((r) => mapBountyRow(r, confirm(r.block_confirmed)));
    return c.json({ bounties });
  });

  app.get("/api/bounties/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const [row]: any[] = await db.sql`SELECT * FROM bounties WHERE bounty_id = ${id}`;
    if (!row) return c.json({ error: "bounty not found" }, 404);
    const submissions: any[] = await db.sql`SELECT * FROM submissions WHERE bounty_id = ${id} ORDER BY submission_id`;
    const reports: any[] = await db.sql`SELECT * FROM submission_reports WHERE bounty_id = ${id}`;
    const reportBy = new Map(reports.map((r) => [r.submission_id, r]));
    return c.json({
      ...mapBountyRow(row, confirm(row.block_confirmed)),
      submissions: submissions.map((s) => mapSubmissionRow(s, reportBy.get(s.submission_id) ?? null, confirm(row.block_confirmed)))
    });
  });

  app.get("/api/bounties/:id/submissions/:sid/receipt", async (c) => {
    const id = Number(c.req.param("id"));
    const sid = Number(c.req.param("sid"));
    const [report]: any[] = await db.sql`SELECT * FROM submission_reports WHERE bounty_id = ${id} AND submission_id = ${sid}`;
    if (!report) return c.json({ error: "receipt not found" }, 404);
    const [sub]: any[] = await db.sql`SELECT * FROM submissions WHERE bounty_id = ${id} AND submission_id = ${sid}`;
    const verified = await verifyReceipt(chain.publicClient, {
      bountyId: String(id),
      hash: sub?.hash ?? "",
      content: report.content,
      salt: report.salt,
      signature: report.signature
    }, sub?.submitter);
    return c.json({
      bountyId: id,
      submissionId: sid,
      hash: sub?.hash,
      content: report.content,
      salt: report.salt,
      signature: report.signature,
      txHash: report.tx_hash,
      verified
    });
  });

  app.post("/api/bounties/:id/submissions", async (c) => {
    const id = Number(c.req.param("id"));
    const { submissionId, content, salt, signature, txHash, hash } = await c.req.json();
    if (submissionHash(BigInt(id), content, salt) !== hash) {
      return c.json({ error: "hash does not match content" }, 400);
    }
    await db.sql`
      INSERT INTO submission_reports (bounty_id, submission_id, content, salt, signature, tx_hash)
      VALUES (${id}, ${submissionId}, ${content}, ${salt}, ${signature}, ${txHash ?? null})
      ON CONFLICT (bounty_id, submission_id) DO UPDATE SET
        content = EXCLUDED.content, salt = EXCLUDED.salt,
        signature = EXCLUDED.signature, tx_hash = EXCLUDED.tx_hash
    `;
    return c.json({ ok: true });
  });

  app.post("/api/admin/raise-dispute", async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { bountyId } = await c.req.json();
    return c.json({ txHash: await admin.raiseDispute(bountyId) });
  });

  app.post("/api/admin/dispute/open", async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { bountyId, reason } = await c.req.json();
    const reasonIndex = reason === "ownerSilence" ? 1 : 0;
    return c.json({ txHash: await admin.openDispute(bountyId, reasonIndex) });
  });

  app.post("/api/admin/dispute/close", async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { bountyId } = await c.req.json();
    return c.json({ txHash: await admin.closeDispute(bountyId) });
  });

  return app;
}

export type App = ReturnType<typeof createApp>;