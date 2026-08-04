import { randomBytes } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { keccak256, recoverMessageAddress, toBytes } from "viem";
import { verifyReceipt, submissionHash } from "./hash";
import type { Admin } from "./admin";
import type { Chain } from "./chain";
import type { Db } from "./db";
import type { createIndexer } from "./indexer";
import { BOUNTY_STATES, mapBountyRow, mapSubmissionRow } from "./map";
import { createRateLimiter } from "./rate";

type Indexer = ReturnType<typeof createIndexer>;

const DISPUTE_REASON: Record<string, number> = { researcherFlag: 0, ownerSilence: 1 };
// ponytail: flags are permanent on-chain, so a per-day ceiling is generous; the
// gate is a UI deterrent — real enforcement moved on-chain at raiseDispute.
const disputeRaiseLimiter = createRateLimiter({ limit: 5, windowMs: 24 * 60 * 60 * 1000 });

const SCOPE_MESSAGE = (bountyId: number) => `Save scope for BugChain bounty #${bountyId}`;
const SESSION_TTL_MS = 15 * 60 * 1000;
const NONCE_TTL_MS = 5 * 60 * 1000;

interface Session { address: string; expiresAt: number }

export function createApp(opts: { db: Db; chain: Chain; admin: Admin; indexer: Indexer; adminToken?: string; operator?: string }) {
  const { db, chain, admin, indexer } = opts;
  const app = new Hono();
  const sessions = new Map<string, Session>();
  const nonces = new Map<string, { nonce: string; expiresAt: number }>();

  app.use("/api/*", cors());

  const requireAdmin = (c: Context) => {
    const header = c.req.header("authorization");
    if (header?.startsWith("Bearer ")) {
      const token = header.slice("Bearer ".length);
      if (opts.adminToken && token === opts.adminToken) return null;
      const session = sessions.get(token);
      if (session && session.expiresAt > Date.now()) return null;
      sessions.delete(token);
    }
    if (!opts.adminToken && !opts.operator) return c.json({ error: "admin endpoints disabled (no ADMIN_TOKEN/ADMIN_OPERATOR set)" }, 503);
    return c.json({ error: "unauthorized" }, 401);
  };

  app.onError((err, c) => {
    console.error("route error:", err);
    return c.text("Internal Server Error", 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/admin/sync", async (c) => c.json(await indexer.syncSnapshot()));

  app.get("/api/bounties", async (c) => {
    const latest = await indexer.latestBlock();
    const confirm = (block: bigint | string | null | undefined) => indexer.confirmationStatus(block ?? null, latest);
    const rows: any[] = await db.sql`SELECT * FROM bounties ORDER BY bounty_id`;
    const bounties = rows.map((r) => mapBountyRow(r, confirm(r.block_confirmed)));
    return c.json({ bounties });
  });

  app.get("/api/bounties/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const [row]: any[] = await db.sql`SELECT * FROM bounties WHERE bounty_id = ${id}`;
    if (!row) return c.json({ error: "bounty not found" }, 404);
    const latest = await indexer.latestBlock();
    const confirm = (block: bigint | string | null | undefined) => indexer.confirmationStatus(block ?? null, latest);
    const submissions: any[] = await db.sql`SELECT * FROM submissions WHERE bounty_id = ${id} ORDER BY submission_id`;
    const reports: any[] = await db.sql`SELECT * FROM submission_reports WHERE bounty_id = ${id}`;
    const reportBy = new Map(reports.map((r) => [r.submission_id, r]));
    return c.json({
      ...mapBountyRow(row, confirm(row.block_confirmed)),
      submissions: submissions.map((s) => mapSubmissionRow(s, reportBy.get(s.submission_id) ?? null, confirm(s.block_confirmed)))
    });
  });

  app.get("/api/submissions", async (c) => {
    const submitter = c.req.query("submitter")?.trim();
    if (!submitter) return c.json({ error: "submitter required" }, 400);
    const requestedLimit = Number(c.req.query("limit") ?? 50);
    const requestedOffset = Number(c.req.query("offset") ?? 0);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
    const [countRow]: any[] = await db.sql`
      SELECT COUNT(*)::int AS n FROM submissions WHERE lower(submitter) = lower(${submitter})
    `;
    const rows: any[] = await db.sql`
      SELECT s.*, b.scope_hash, b.scope_text, b.escrow_wei, b.deadline, b.business, b.state AS bounty_state
      FROM submissions s JOIN bounties b ON b.bounty_id = s.bounty_id
      WHERE lower(s.submitter) = lower(${submitter})
      ORDER BY s.ts DESC, s.bounty_id DESC, s.submission_id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const latest = await indexer.latestBlock();
    const confirm = (block: bigint | string | null | undefined) => indexer.confirmationStatus(block ?? null, latest);
    return c.json({ total: countRow.n, submissions: rows.map((row) => ({
      bountyId: row.bounty_id,
      submissionId: row.submission_id,
      hash: row.hash,
      timestamp: Number(row.ts),
      submissionState: mapSubmissionRow(row, null, confirm(row.block_confirmed)).state,
      confirmation: confirm(row.block_confirmed),
      bountyState: BOUNTY_STATES[row.bounty_state],
      scope: row.scope_text ?? null,
      scopeHash: row.scope_hash,
      escrowWei: row.escrow_wei,
      deadline: Number(row.deadline),
      business: row.business
    })) });
  });

  app.post("/api/bounties/:id/scope", async (c) => {
    const id = Number(c.req.param("id"));
    const { scope, signature } = await c.req.json();
    if (!Number.isInteger(id) || typeof scope !== "string" || !scope.trim()) return c.json({ error: "scope required" }, 400);
    if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return c.json({ error: "signature required" }, 400);
    const [row]: any[] = await db.sql`SELECT scope_hash, business FROM bounties WHERE bounty_id = ${id}`;
    if (!row) return c.json({ error: "bounty not found" }, 404);
    if (keccak256(toBytes(scope)).toLowerCase() !== row.scope_hash.toLowerCase()) return c.json({ error: "scope does not match onchain commitment" }, 400);
    // hash integrity is not write ownership: only the bounty's business wallet may save metadata
    const signer = await recoverMessageAddress({ message: SCOPE_MESSAGE(id), signature: signature as `0x${string}` }).catch(() => "");
    if (signer.toLowerCase() !== row.business.toLowerCase()) return c.json({ error: "signature is not from the bounty business" }, 403);
    await db.sql`UPDATE bounties SET scope_text = ${scope} WHERE bounty_id = ${id}`;
    return c.json({ ok: true });
  });

  app.get("/api/bounties/:id/submissions/:sid/receipt", async (c) => {
    const id = Number(c.req.param("id"));
    const sid = Number(c.req.param("sid"));
    const [report]: any[] = await db.sql`SELECT * FROM submission_reports WHERE bounty_id = ${id} AND submission_id = ${sid}`;
    if (!report) return c.json({ error: "receipt not found" }, 404);
    const [sub]: any[] = await db.sql`SELECT * FROM submissions WHERE bounty_id = ${id} AND submission_id = ${sid}`;
    const verified = await verifyReceipt({
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
    const [submission]: any[] = await db.sql`SELECT hash FROM submissions WHERE bounty_id = ${id} AND submission_id = ${submissionId}`;
    if (!submission) return c.json({ error: "submission not indexed" }, 404);
    if (submission.hash.toLowerCase() !== hash.toLowerCase()) return c.json({ error: "hash does not match indexed submission" }, 400);
    await db.sql`
      INSERT INTO submission_reports (bounty_id, submission_id, content, salt, signature, tx_hash)
      VALUES (${id}, ${submissionId}, ${content}, ${salt}, ${signature}, ${txHash ?? null})
      ON CONFLICT (bounty_id, submission_id) DO UPDATE SET
        content = EXCLUDED.content, salt = EXCLUDED.salt,
        signature = EXCLUDED.signature, tx_hash = EXCLUDED.tx_hash
    `;
    return c.json({ ok: true });
  });

  app.get("/api/admin/auth/operator", (c) => c.json({ address: opts.operator ?? null }));

  app.post("/api/admin/auth/challenge", async (c) => {
    const { address } = await c.req.json();
    if (!opts.operator) return c.json({ error: "operator auth disabled (no ADMIN_OPERATOR set)" }, 503);
    if (typeof address !== "string" || address.toLowerCase() !== opts.operator.toLowerCase()) {
      return c.json({ error: "not the platform operator" }, 403);
    }
    const nonce = `0x${randomBytes(32).toString("hex")}`;
    nonces.set(opts.operator.toLowerCase(), { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
    return c.json({ nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  });

  app.post("/api/admin/auth/login", async (c) => {
    const { address, nonce, signature } = await c.req.json();
    if (!opts.operator) return c.json({ error: "operator auth disabled (no ADMIN_OPERATOR set)" }, 503);
    const pending = nonces.get(opts.operator.toLowerCase());
    if (!pending || pending.expiresAt < Date.now() || String(address ?? "").toLowerCase() !== opts.operator.toLowerCase() || pending.nonce !== nonce) {
      return c.json({ error: "invalid or expired challenge" }, 401);
    }
    const signer = await recoverMessageAddress({ message: nonce, signature }).catch(() => "");
    if (signer.toLowerCase() !== opts.operator.toLowerCase()) return c.json({ error: "signature is not from the platform operator" }, 401);
    nonces.delete(opts.operator.toLowerCase());
    const token = `0x${randomBytes(32).toString("hex")}`;
    const expiresAt = Date.now() + SESSION_TTL_MS;
    sessions.set(token, { address: signer, expiresAt });
    return c.json({ token, expiresAt });
  });

  app.post("/api/admin/raise-dispute", async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { bountyId, reason } = await c.req.json();
    const reasonIndex = DISPUTE_REASON[reason as string];
    if (reasonIndex === undefined) return c.json({ error: `unknown dispute reason: ${reason}` }, 400);
    return c.json({ txHash: await admin.raiseDispute(bountyId, reasonIndex) });
  });

  app.post("/api/dispute/raise", async (c) => {
    const { address } = await c.req.json();
    if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return c.json({ error: "address required" }, 400);
    }
    const verdict = disputeRaiseLimiter.take(address.toLowerCase());
    if (!verdict.allowed) {
      return c.json({ error: "rate limit exceeded", retryAfterSeconds: verdict.retryAfterSeconds }, 429);
    }
    return c.json({ ok: true });
  });

  app.post("/api/admin/dispute/open", async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { bountyId, reason } = await c.req.json();
    const reasonIndex = DISPUTE_REASON[reason as string];
    if (reasonIndex === undefined) return c.json({ error: `unknown dispute reason: ${reason}` }, 400);
    return c.json({ txHash: await admin.openDispute(bountyId, reasonIndex) });
  });

  app.post("/api/admin/dispute/close", async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { bountyId } = await c.req.json();
    return c.json({ txHash: await admin.closeDispute(bountyId) });
  });

  const judge = (fn: (bountyId: number, submissionId: number) => Promise<unknown>, needsSubmission: boolean) =>
    async (c: Context) => {
      const denied = requireAdmin(c);
      if (denied) return denied;
      const { bountyId, submissionId } = await c.req.json();
      if (needsSubmission && submissionId === undefined) return c.json({ error: "submissionId required" }, 400);
      return c.json({ txHash: await fn(bountyId, submissionId ?? 0) });
    };

  app.post("/api/admin/judge/accept", judge(admin.acceptSubmission, true));
  app.post("/api/admin/judge/reject", judge(admin.rejectSubmission, true));
  app.post("/api/admin/judge/mark-all-invalid", judge(admin.markAllInvalid, false));
  app.post("/api/admin/judge/confirm-refund", judge(admin.confirmRefund, false));

  const isHexAddress = (value: unknown) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);

  app.post("/api/admin/transfer-admin", async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { address } = await c.req.json();
    if (!isHexAddress(address)) return c.json({ error: "address required" }, 400);
    return c.json({ txHash: await admin.transferAdmin(address) });
  });

  const paramSetter = (fn: (value: number) => Promise<unknown>) => async (c: Context) => {
    const denied = requireAdmin(c);
    if (denied) return denied;
    const { seconds } = await c.req.json();
    if (!Number.isInteger(seconds) || seconds < 0) return c.json({ error: "seconds required" }, 400);
    return c.json({ txHash: await fn(seconds) });
  };

  app.post("/api/admin/config/silence-window", paramSetter((s) => admin.setSilenceWindow(s)));
  app.post("/api/admin/config/raise-cooldown", paramSetter((s) => admin.setRaiseCooldown(s)));

  return app;
}

export type App = ReturnType<typeof createApp>;
