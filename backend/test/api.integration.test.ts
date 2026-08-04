import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Abi,
  type PublicClient
} from "viem";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { createChain } from "../src/chain";
import { createDb } from "../src/db";
import { createIndexer } from "../src/indexer";
import { createAdmin } from "../src/admin";
import { createApp } from "../src/routes";
import { randomSalt, submissionHash } from "../src/hash";

const RPC = "http://127.0.0.1:3137";
const CONTRACTS_DIR = path.resolve(__dirname, "../../contracts");
const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ADMIN_TOKEN = "test-admin-token";
const BUSINESS_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const RESEARCHER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

interface Ctx {
  abi: Abi;
  contractAddress: string;
  publicClient: PublicClient;
  db: Awaited<ReturnType<typeof createDb>>;
  indexer: ReturnType<typeof createIndexer>;
  app: ReturnType<typeof createApp>;
  business: LocalAccount;
  researcher: LocalAccount;
  adminAccount: LocalAccount;
  stopLiveSync: () => void;
}

let ctx: Ctx;
let node: ChildProcess | undefined;

async function waitForRpc(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] })
      });
      const data = (await res.json()) as { result?: string };
      if (data.result) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("hardhat node did not start");
}

function getApi(pathname: string): Promise<any> {
  return ctx.app.request(pathname).then((r) => r.json());
}

function postApi(pathname: string, body?: unknown): Promise<any> {
  return ctx.app.request(pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then((r) => r.json());
}

function postAdmin(pathname: string, body?: unknown): Promise<any> {
  return ctx.app.request(pathname, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body)
  }).then((r) => r.json());
}

function write(
  account: LocalAccount,
  functionName: string,
  args: unknown[],
  value?: bigint
): Promise<`0x${string}`> {
  const wallet = createWalletClient({ account, transport: http(RPC) });
  return wallet.writeContract({
    address: ctx.contractAddress as `0x${string}`,
    abi: ctx.abi,
    account,
    functionName,
    args,
    value,
    chain: null as never
  } as never) as Promise<`0x${string}`>;
}

async function mine(n: number): Promise<void> {
  const start = await ctx.publicClient.getBlockNumber();
  for (let i = 0; i < n; i++) {
    await ctx.publicClient.request({ method: "evm_mine" });
  }
  const target = start + BigInt(n);
  for (;;) {
    if ((await ctx.publicClient.getBlockNumber()) >= target) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function waitUntil(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("condition was not met");
}

const DEADLINE = () => {
  return BigInt(Math.floor(Date.now() / 1000) + 3600);
};

beforeAll(async () => {
  node = spawn("npx", ["hardhat", "node", "--port", "3137"], {
    cwd: CONTRACTS_DIR,
    stdio: "ignore",
    detached: true
  });
  await waitForRpc();

  const artifact = JSON.parse(
    readFileSync(path.resolve(__dirname, "../../abis/BountyEscrow.json"), "utf8")
  ) as { abi: Abi; bytecode: string };

  const publicClient = createPublicClient({ transport: http(RPC) });
  const adminAccount = privateKeyToAccount(ADMIN_KEY as `0x${string}`) as LocalAccount;
  const deployWallet = createWalletClient({ account: adminAccount, transport: http(RPC) });
  const deployHash = await deployWallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [60]
  });
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = deployReceipt.contractAddress!;

  const db = await createDb();
  const chain = createChain({ rpcUrl: RPC, wsUrl: "ws://127.0.0.1:3137", contractAddress });
  const indexer = createIndexer({ db, chain });
  expect(await indexer.startLiveSync()).toBe(true);
  const admin = createAdmin({ privateKey: ADMIN_KEY, rpcUrl: RPC, chain });
  const app = createApp({ db, chain, admin, indexer, adminToken: ADMIN_TOKEN });

  ctx = {
    abi: artifact.abi,
    contractAddress,
    publicClient,
    db,
    indexer,
    app,
    business: privateKeyToAccount(BUSINESS_KEY as `0x${string}`) as LocalAccount,
    researcher: privateKeyToAccount(RESEARCHER_KEY as `0x${string}`) as LocalAccount,
    adminAccount: adminAccount,
    stopLiveSync: indexer.stopLiveSync
  };
});

afterAll(() => {
  ctx?.stopLiveSync();
  if (node?.pid) {
    try {
      process.kill(-node.pid, "SIGKILL");
    } catch {
      node.kill();
    }
  }
});

describe("Bug bounty backend — Seam 2 (real local EVM)", () => {
  it("create → index → read: a funded bounty shows through the API", async () => {
    const scope = keccak256(toBytes("scope-a"));
    const tx = await write(ctx.business, "createBounty", [scope, DEADLINE()], 1_000_000_000_000_000_000n);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });

    await waitUntil(async () => (await getApi("/api/bounties")).bounties.some((b: any) => b.scopeHash === scope));
    const { bounties } = await getApi("/api/bounties");
    const b = bounties.find((x: any) => x.scopeHash === scope);
    expect(b).toBeTruthy();
    expect(b.state).toBe("Active");
    expect(b.escrowWei).toBe("1000000000000000000");
    expect(b.business.toLowerCase()).toBe(ctx.business.address.toLowerCase());
  });

  it("submit → store report → read receipt that re-hashes and verifies authorship", async () => {
    const content = "# Report\r\nline one  \r\nline two\n\n";
    const salt = randomSalt();
    const hash = submissionHash(0, content, salt);
    const signature = await ctx.researcher.signMessage({ message: { raw: hash } });
    const tx = await write(ctx.researcher, "submitSubmission", [0n, hash]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    await postApi("/admin/sync");

    await postApi("/api/bounties/0/submissions", {
      submissionId: 0,
      content,
      salt,
      signature,
      txHash: tx,
      hash
    });

    const detail = await getApi("/api/bounties/0");
    expect(detail.submissions[0].hash).toBe(hash);

    const receipt = await getApi("/api/bounties/0/submissions/0/receipt");
    expect(receipt.hash).toBe(hash);
    expect(receipt.verified.hashMatches).toBe(true);
    expect(receipt.verified.signer.toLowerCase()).toBe(ctx.researcher.address.toLowerCase());
    expect(receipt.verified.signerIsSubmitter).toBe(true);
  });

  it("forged content is rejected at the API (hash gate) and a wrong-key receipt fails authorship", async () => {
    const rejected = await postApi("/api/bounties/0/submissions", {
      submissionId: 0,
      content: "forged content",
      salt: randomSalt(),
      signature: "0x",
      txHash: "0x",
      hash: "0x" + "11".repeat(32)
    });
    expect(rejected.error).toBeTruthy();
    const [report] = await ctx.db.sql`SELECT content FROM submission_reports WHERE bounty_id = 0 AND submission_id = 0`;
    expect(report.content).not.toBe("forged content");

    const content = "replay-attack report";
    const salt = randomSalt();
    const hash = submissionHash(0, content, salt);
    const realSig = await ctx.researcher.signMessage({ message: { raw: hash } });
    const tx = await write(ctx.researcher, "submitSubmission", [0n, hash]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    await postApi("/admin/sync");
    const wrongSignature = await ctx.business.signMessage({ message: { raw: hash } });
    await postApi("/api/bounties/0/submissions", {
      submissionId: 1,
      content,
      salt,
      signature: wrongSignature,
      txHash: "0x",
      hash
    });
    const receipt = await getApi("/api/bounties/0/submissions/1/receipt");
    expect(receipt.verified.hashMatches).toBe(true);
    expect(receipt.verified.signerIsSubmitter).toBe(false);
    expect(receipt.verified.signer.toLowerCase()).toBe(ctx.business.address.toLowerCase());
    expect(realSig).not.toBe(wrongSignature);
  });

  it("judgment accept → exact payout → bounty Closed(paid)", async () => {
    const tx = await write(ctx.business, "acceptSubmission", [0n, 0n]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    await postApi("/admin/sync");

    const detail = await getApi("/api/bounties/0");
    expect(detail.state).toBe("Closed");
    expect(detail.submissions[0].state).toBe("Accepted");
    expect(await ctx.publicClient.getBalance({ address: ctx.contractAddress as `0x${string}` })).toBe(0n);
  });

  it("refund path: reject all → request → confirm → Closed(refunded)", async () => {
    const scope = keccak256(toBytes("scope-b"));
    const tx = await write(ctx.business, "createBounty", [scope, DEADLINE()], 2_000_000_000_000_000_000n);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    const hash = submissionHash(1, "boom", randomSalt());
    const s = await write(ctx.researcher, "submitSubmission", [1n, hash]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: s });
    const r = await write(ctx.business, "rejectSubmission", [1n, 0n]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: r });
    const q = await write(ctx.business, "requestRefund", [1n]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: q });
    const c = await write(ctx.business, "confirmRefund", [1n]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: c });
    await postApi("/admin/sync");

    const detail = await getApi("/api/bounties/1");
    expect(detail.state).toBe("Closed");
  });

  it("idempotent replay: re-running the snapshot twice yields a stable database", async () => {
    await postApi("/admin/sync");
    await postApi("/admin/sync");
    const second = await postApi("/admin/sync");
    const countB = (await ctx.db.sql`SELECT COUNT(*)::int AS n FROM bounties`)[0].n;
    const countS = (await ctx.db.sql`SELECT COUNT(*)::int AS n FROM submissions`)[0].n;
    expect(countB).toBe(second.bounties);
    expect(countS).toBe(second.submissions);
    await postApi("/admin/sync");
    const afterB = (await ctx.db.sql`SELECT COUNT(*)::int AS n FROM bounties`)[0].n;
    const afterS = (await ctx.db.sql`SELECT COUNT(*)::int AS n FROM submissions`)[0].n;
    expect(afterB).toBe(countB);
    expect(afterS).toBe(countS);
  });

  it("reorg self-heal: a corrupted row is restored by a targeted rescan", async () => {
    await ctx.db.sql`UPDATE bounties SET state = 99 WHERE bounty_id = 1`;
    await ctx.db.sql`UPDATE submissions SET state = 99 WHERE bounty_id = 1 AND submission_id = 0`;
    await ctx.indexer.rescanBounty(1n);
    const [b] = await ctx.db.sql`SELECT state FROM bounties WHERE bounty_id = 1`;
    const [s] = await ctx.db.sql`SELECT state FROM submissions WHERE bounty_id = 1 AND submission_id = 0`;
    expect(b.state).toBe(2); // Closed(refunded) from the chain
    expect(s.state).toBe(2); // Rejected from the chain
  });

  it("pending → confirmed: the API flips a row to confirmed once blocks pass", async () => {
    const scope = keccak256(toBytes("scope-pending"));
    const tx = await write(ctx.business, "createBounty", [scope, DEADLINE()], 1n);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    await postApi("/admin/sync");

    const pending = await getApi("/api/bounties/" + "2");
    expect(pending.confirmation).toBe("pending");

    await mine(10);
    await postApi("/admin/sync");
    const confirmed = await getApi("/api/bounties/" + "2");
    expect(confirmed.confirmation).toBe("confirmed");
  });

  it("chain rollback removes bounties that no longer exist", async () => {
    const snapshot = await ctx.publicClient.request({ method: "evm_snapshot" });
    const scope = keccak256(toBytes("scope-rolled-back"));
    const tx = await write(ctx.business, "createBounty", [scope, DEADLINE()], 1n);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    await postApi("/admin/sync");
    expect((await getApi("/api/bounties")).bounties.some((b: any) => b.scopeHash === scope)).toBe(true);

    await ctx.publicClient.request({ method: "evm_revert", params: [snapshot] });
    await postApi("/admin/sync");
    expect((await getApi("/api/bounties")).bounties.some((b: any) => b.scopeHash === scope)).toBe(false);
  });

  it("chain rollback removes submissions that no longer exist", async () => {
    const scope = keccak256(toBytes("scope-submission-rollback"));
    const created = await write(ctx.business, "createBounty", [scope, DEADLINE()], 1n);
    await ctx.publicClient.waitForTransactionReceipt({ hash: created });
    const id = Number(await ctx.publicClient.readContract({
      address: ctx.contractAddress as `0x${string}`,
      abi: ctx.abi,
      functionName: "bountyCount"
    })) - 1;
    const snapshot = await ctx.publicClient.request({ method: "evm_snapshot" });
    const hash = submissionHash(id, "rolled-back submission", randomSalt());
    const submitted = await write(ctx.researcher, "submitSubmission", [BigInt(id), hash]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: submitted });
    await postApi("/admin/sync");
    expect((await getApi(`/api/bounties/${id}`)).submissions).toHaveLength(1);

    await ctx.publicClient.request({ method: "evm_revert", params: [snapshot] });
    await postApi("/admin/sync");
    expect((await getApi(`/api/bounties/${id}`)).submissions).toHaveLength(0);
  });

  it("ghost rows self-heal: a reorg that shrinks bountyCount cannot leave stale rows", async () => {
    await ctx.db.sql`INSERT INTO bounties (bounty_id, scope_hash, escrow_wei, deadline, business, state, in_dispute, dispute_requested)
      VALUES (99, '0xdead', '1', 9999999999, '0x0000000000000000000000000000000000000000', 0, false, false)`;
    await ctx.db.sql`INSERT INTO submissions (bounty_id, submission_id, hash, submitter, ts, state)
      VALUES (99, 0, '0xdead', '0x0000000000000000000000000000000000000000', 1, 0)`;
    await postApi("/admin/sync");
    const ghost = await ctx.db.sql`SELECT COUNT(*)::int AS n FROM bounties WHERE bounty_id = 99`;
    const ghostSub = await ctx.db.sql`SELECT COUNT(*)::int AS n FROM submissions WHERE bounty_id = 99`;
    expect(ghost[0].n).toBe(0);
    expect(ghostSub[0].n).toBe(0);
  });

  it("dispute: anyone flags, admin opens and closes the inDispute gate via the API", async () => {
    const raised = await postAdmin("/api/admin/raise-dispute", { bountyId: 2 });
    await ctx.publicClient.waitForTransactionReceipt({ hash: raised.txHash });
    await postApi("/admin/sync");
    let d = await getApi("/api/bounties/2");
    expect(d.disputeRequested).toBe(true);

    const opened = await postAdmin("/api/admin/dispute/open", { bountyId: 2, reason: "researcherFlag" });
    await ctx.publicClient.waitForTransactionReceipt({ hash: opened.txHash });
    await postApi("/admin/sync");
    d = await getApi("/api/bounties/2");
    expect(d.inDispute).toBe(true);

    const closed = await postAdmin("/api/admin/dispute/close", { bountyId: 2 });
    await ctx.publicClient.waitForTransactionReceipt({ hash: closed.txHash });
    await postApi("/admin/sync");
    d = await getApi("/api/bounties/2");
    expect(d.inDispute).toBe(false);
  });

  it("admin judgment during a dispute via the API: accept → Closed(paid), escrow drained", async () => {
    const scope = keccak256(toBytes("scope-dispute-payout"));
    const bountyId = Number(await ctx.publicClient.readContract({
      address: ctx.contractAddress as `0x${string}`,
      abi: ctx.abi,
      functionName: "bountyCount"
    }));
    const tx = await write(ctx.business, "createBounty", [scope, DEADLINE()], 3_000_000_000_000_000_000n);
    await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
    const hash = submissionHash(bountyId, "disputed report", randomSalt());
    const s = await write(ctx.researcher, "submitSubmission", [BigInt(bountyId), hash]);
    await ctx.publicClient.waitForTransactionReceipt({ hash: s });

    const raised = await postAdmin("/api/admin/raise-dispute", { bountyId });
    await ctx.publicClient.waitForTransactionReceipt({ hash: raised.txHash });
    const opened = await postAdmin("/api/admin/dispute/open", { bountyId, reason: "researcherFlag" });
    await ctx.publicClient.waitForTransactionReceipt({ hash: opened.txHash });

    const before = await ctx.publicClient.getBalance({ address: ctx.contractAddress as `0x${string}` });
    const accepted = await postAdmin("/api/admin/judge/accept", { bountyId, submissionId: 0 });
    await ctx.publicClient.waitForTransactionReceipt({ hash: accepted.txHash });
    await postApi("/admin/sync");

    const d = await getApi(`/api/bounties/${bountyId}`);
    expect(d.state).toBe("Closed");
    expect(d.submissions[0].state).toBe("Accepted");
    const after = await ctx.publicClient.getBalance({ address: ctx.contractAddress as `0x${string}` });
    expect(before - after).toBe(3_000_000_000_000_000_000n);
  });

  it("admin endpoints reject requests without the bearer token", async () => {
    const noAuth = await postApi("/api/admin/raise-dispute", { bountyId: 2 });
    expect(noAuth.error).toBe("unauthorized");

    const judge = await postApi("/api/admin/judge/accept", { bountyId: 3, submissionId: 0 });
    expect(judge.error).toBe("unauthorized");

    const res = await ctx.app.request("/api/admin/raise-dispute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrong-token" },
      body: JSON.stringify({ bountyId: 2 })
    });
    expect((await res.json()).error).toBe("unauthorized");
  });
});
