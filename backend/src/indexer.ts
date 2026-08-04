import type { Chain } from "./chain";
import { latestBlock, readBounty, readBountyCount, readSubmission, readSubmissionCount } from "./chain";
import type { Db } from "./db";

export const CONFIRMATIONS = 5n;

export function confirmationStatus(rowBlock: bigint | string | null, latest: bigint): "pending" | "confirmed" {
  const rb = rowBlock == null ? null : BigInt(rowBlock);
  if (rb === null) return "pending";
  if (latest - rb < CONFIRMATIONS) return "pending";
  return "confirmed";
}

export function createIndexer({ db, chain }: { db: Db; chain: Chain }) {
  async function syncSnapshot(): Promise<{ bounties: number; submissions: number }> {
    const observedAt = await latestBlock(chain);
    const count = Number(await readBountyCount(chain));
    let nSub = 0;
    for (let id = 0; id < count; id++) {
      nSub += await upsertBounty(BigInt(id), observedAt);
    }
    // self-heal: a reorg that shrinks bountyCount would otherwise leave ghost rows readable
    await db.sql`DELETE FROM submissions WHERE bounty_id >= ${count}`;
    await db.sql`DELETE FROM bounties WHERE bounty_id >= ${count}`;
    await db.sql`
      INSERT INTO sync_state (key, value) VALUES ('last_block', ${observedAt.toString()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    return { bounties: count, submissions: nSub };
  }

  async function upsertBounty(bountyId: bigint, confirmedAt: bigint): Promise<number> {
    const b = await readBounty(chain, bountyId);
    await db.sql`
      INSERT INTO bounties (
        bounty_id, scope_hash, escrow_wei, deadline, business, state,
        in_dispute, dispute_requested, first_submission_ts, block_confirmed
      ) VALUES (
        ${Number(bountyId)}, ${b.scopeHash}, ${b.escrow.toString()}, ${Number(b.deadline)},
        ${b.business.toLowerCase()}, ${Number(b.state)}, ${b.inDispute},
        ${b.disputeRequested}, ${b.firstSubmissionTs === 0n ? null : Number(b.firstSubmissionTs)},
        ${confirmedAt.toString()}
      )
      ON CONFLICT (bounty_id) DO UPDATE SET
        scope_hash = EXCLUDED.scope_hash,
        escrow_wei = EXCLUDED.escrow_wei,
        deadline = EXCLUDED.deadline,
        business = EXCLUDED.business,
        state = EXCLUDED.state,
        in_dispute = EXCLUDED.in_dispute,
        dispute_requested = EXCLUDED.dispute_requested,
        first_submission_ts = EXCLUDED.first_submission_ts,
        block_confirmed = EXCLUDED.block_confirmed
    `;
    return syncSubmissions(bountyId, confirmedAt);
  }

  async function syncSubmissions(bountyId: bigint, confirmedAt: bigint): Promise<number> {
    const n = Number(await readSubmissionCount(chain, bountyId));
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const s = await readSubmission(chain, bountyId, BigInt(i));
      await db.sql`
        INSERT INTO submissions (bounty_id, submission_id, hash, submitter, ts, state, block_confirmed)
        VALUES (${Number(bountyId)}, ${i}, ${s.hash}, ${s.submitter.toLowerCase()}, ${Number(s.timestamp)}, ${Number(s.state)}, ${confirmedAt.toString()})
        ON CONFLICT (bounty_id, submission_id) DO UPDATE SET
          hash = EXCLUDED.hash, submitter = EXCLUDED.submitter,
          ts = EXCLUDED.ts, state = EXCLUDED.state, block_confirmed = EXCLUDED.block_confirmed
      `;
      changed++;
    }
    return changed;
  }

  async function rescanBounty(bountyId: bigint): Promise<void> {
    const observedAt = await latestBlock(chain);
    await db.sql`DELETE FROM submissions WHERE bounty_id = ${Number(bountyId)}`;
    await upsertBounty(bountyId, observedAt);
  }

  return {
    syncSnapshot,
    rescanBounty,
    latestBlock: () => latestBlock(chain),
    confirmationStatus
  };
}