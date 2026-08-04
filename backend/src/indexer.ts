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
  let stopWatching: (() => void) | undefined;
  let syncQueue = Promise.resolve();

  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = syncQueue.then(work, work);
    syncQueue = result.then(() => undefined, () => undefined);
    return result;
  }
  async function syncSnapshot(): Promise<{ bounties: number; submissions: number }> {
    const observedAt = await latestBlock(chain);
    const count = Number(await readBountyCount(chain, observedAt));
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
    const b = await readBounty(chain, bountyId, confirmedAt);
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
        scope_text = CASE WHEN bounties.scope_hash = EXCLUDED.scope_hash THEN bounties.scope_text ELSE NULL END,
        scope_hash = EXCLUDED.scope_hash,
        escrow_wei = EXCLUDED.escrow_wei,
        deadline = EXCLUDED.deadline,
        business = EXCLUDED.business,
        state = EXCLUDED.state,
        in_dispute = EXCLUDED.in_dispute,
        dispute_requested = EXCLUDED.dispute_requested,
        first_submission_ts = EXCLUDED.first_submission_ts,
        block_confirmed = CASE WHEN
          bounties.scope_hash IS DISTINCT FROM EXCLUDED.scope_hash OR
          bounties.escrow_wei IS DISTINCT FROM EXCLUDED.escrow_wei OR
          bounties.deadline IS DISTINCT FROM EXCLUDED.deadline OR
          bounties.business IS DISTINCT FROM EXCLUDED.business OR
          bounties.state IS DISTINCT FROM EXCLUDED.state OR
          bounties.in_dispute IS DISTINCT FROM EXCLUDED.in_dispute OR
          bounties.dispute_requested IS DISTINCT FROM EXCLUDED.dispute_requested OR
          bounties.first_submission_ts IS DISTINCT FROM EXCLUDED.first_submission_ts
        THEN EXCLUDED.block_confirmed ELSE bounties.block_confirmed END
    `;
    return syncSubmissions(bountyId, confirmedAt);
  }

  async function syncSubmissions(bountyId: bigint, confirmedAt: bigint): Promise<number> {
    const n = Number(await readSubmissionCount(chain, bountyId, confirmedAt));
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const s = await readSubmission(chain, bountyId, BigInt(i), confirmedAt);
      await db.sql`
        INSERT INTO submissions (bounty_id, submission_id, hash, submitter, ts, state, block_confirmed)
        VALUES (${Number(bountyId)}, ${i}, ${s.hash}, ${s.submitter.toLowerCase()}, ${Number(s.timestamp)}, ${Number(s.state)}, ${confirmedAt.toString()})
        ON CONFLICT (bounty_id, submission_id) DO UPDATE SET
          hash = EXCLUDED.hash, submitter = EXCLUDED.submitter,
          ts = EXCLUDED.ts, state = EXCLUDED.state,
          block_confirmed = CASE WHEN
            submissions.hash IS DISTINCT FROM EXCLUDED.hash OR
            submissions.submitter IS DISTINCT FROM EXCLUDED.submitter OR
            submissions.ts IS DISTINCT FROM EXCLUDED.ts OR
            submissions.state IS DISTINCT FROM EXCLUDED.state
          THEN EXCLUDED.block_confirmed ELSE submissions.block_confirmed END
      `;
      changed++;
    }
    await db.sql`DELETE FROM submissions WHERE bounty_id = ${Number(bountyId)} AND submission_id >= ${n}`;
    return changed;
  }

  async function rescanBounty(bountyId: bigint): Promise<void> {
    const observedAt = await latestBlock(chain);
    const count = await readBountyCount(chain, observedAt);
    if (bountyId >= count) {
      await db.sql`DELETE FROM submissions WHERE bounty_id = ${Number(bountyId)}`;
      await db.sql`DELETE FROM bounties WHERE bounty_id = ${Number(bountyId)}`;
      return;
    }
    await db.sql`DELETE FROM submissions WHERE bounty_id = ${Number(bountyId)}`;
    await upsertBounty(bountyId, observedAt);
  }

  async function startLiveSync(): Promise<boolean> {
    if (!chain.eventClient || stopWatching) return !!stopWatching;
    try {
      const block = await latestBlock(chain);
      await chain.eventClient.getContractEvents({
        address: chain.contractAddress as `0x${string}`,
        abi: chain.abi,
        fromBlock: block,
        toBlock: block
      });
      stopWatching = chain.eventClient.watchContractEvent({
        address: chain.contractAddress as `0x${string}`,
        abi: chain.abi,
        onLogs: (logs) => {
          const ids = new Set(logs.map((log: any) => log.args?.bountyId).filter((id) => id !== undefined));
          Promise.all([...ids].map((id) => serialize(() => rescanBounty(BigInt(id))))).catch((err) =>
            console.error("live sync failed", err)
          );
        },
        onError: (err) => console.error("live feed failed; snapshot polling remains active", err)
      });
      return true;
    } catch (err) {
      console.warn("live feed unavailable; snapshot polling remains active", err);
      return false;
    }
  }

  function stopLiveSync(): void {
    stopWatching?.();
    stopWatching = undefined;
  }

  return {
    syncSnapshot: () => serialize(syncSnapshot),
    rescanBounty: (bountyId: bigint) => serialize(() => rescanBounty(bountyId)),
    startLiveSync,
    stopLiveSync,
    latestBlock: () => latestBlock(chain),
    confirmationStatus
  };
}
