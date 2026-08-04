import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
  type Abi,
  type Hex,
  type TransactionReceipt
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomSalt, submissionHash } from "@gmtbuilder/shared";

const rpcUrl = process.env.RPC_URL;
const apiUrl = process.env.SMOKE_API_URL ?? "http://localhost:3000";
const contractAddress = process.env.CONTRACT_ADDRESS as Hex | undefined;
const adminKey = process.env.ADMIN_PRIVATE_KEY;
const adminToken = process.env.ADMIN_TOKEN;
if (!rpcUrl || !contractAddress || !adminKey || !adminToken) {
  throw new Error("RPC_URL, CONTRACT_ADDRESS, ADMIN_PRIVATE_KEY, and ADMIN_TOKEN are required");
}
const parsedApiUrl = new URL(apiUrl);
if (parsedApiUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(parsedApiUrl.hostname)) {
  throw new Error("SMOKE_API_URL must use HTTPS unless it is localhost");
}

const { abi } = JSON.parse(readFileSync(path.resolve(__dirname, "../../abis/BountyEscrow.json"), "utf8")) as { abi: Abi };

async function main() {
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  if (await publicClient.getChainId() !== 968) throw new Error("smoke test only runs on BOT Chain testnet (chain 968)");
  if ((await publicClient.getCode({ address: contractAddress })) === undefined) throw new Error("CONTRACT_ADDRESS has no bytecode");

  const admin = privateKeyToAccount(adminKey as Hex);
  const business = privateKeyToAccount((process.env.SMOKE_BUSINESS_PRIVATE_KEY as Hex | undefined) ?? generatePrivateKey());
  const researcher = privateKeyToAccount((process.env.SMOKE_RESEARCHER_PRIVATE_KEY as Hex | undefined) ?? generatePrivateKey());
  if (new Set([admin.address, business.address, researcher.address].map((x) => x.toLowerCase())).size !== 3) {
    throw new Error("admin, business, and researcher must be distinct accounts");
  }
  const contractAdmin = await publicClient.readContract({ address: contractAddress, abi, functionName: "admin" });
  if (String(contractAdmin).toLowerCase() !== admin.address.toLowerCase()) throw new Error("ADMIN_PRIVATE_KEY is not the contract admin");

  const adminWallet = createWalletClient({ account: admin, transport: http(rpcUrl) });
  const businessWallet = createWalletClient({ account: business, transport: http(rpcUrl) });
  const researcherWallet = createWalletClient({ account: researcher, transport: http(rpcUrl) });
  const reward = 1_000_000_000_000_000n;
  const evidence: Record<string, unknown> = {
    chainId: 968,
    contractAddress,
    admin: admin.address,
    business: business.address,
    researcher: researcher.address
  };

  async function wait(hash: Hex): Promise<TransactionReceipt> {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`transaction reverted: ${hash}`);
    return receipt;
  }

  async function send(wallet: typeof businessWallet, functionName: string, args: unknown[], value?: bigint): Promise<TransactionReceipt> {
    const hash = await wallet.writeContract({ address: contractAddress, abi, functionName, args, value, chain: null } as never);
    return wait(hash);
  }

  async function fund(address: Hex, label: string): Promise<void> {
    if (await publicClient.getBalance({ address }) >= 20_000_000_000_000_000n) return;
    const receipt = await wait(await adminWallet.sendTransaction({ account: admin, to: address, value: 50_000_000_000_000_000n, chain: null }));
    evidence[`${label}GasFunding`] = receipt.transactionHash;
  }

  function requireCloseReason(receipt: TransactionReceipt, expected: number, label: string): void {
    const [event] = parseEventLogs({ abi, logs: receipt.logs, eventName: "BountyClosed" });
    if (!event || Number((event.args as { reason: number }).reason) !== expected) {
      throw new Error(`${label} did not emit the expected BountyClosed reason`);
    }
  }

  async function create(label: string): Promise<{ id: number; receipt: TransactionReceipt }> {
    const receipt = await send(
      businessWallet,
      "createBounty",
      [keccak256(toBytes(`testnet-smoke:${label}:${Date.now()}`)), BigInt(Math.floor(Date.now() / 1000) + 86_400)],
      reward
    );
    const [event] = parseEventLogs({ abi, logs: receipt.logs, eventName: "BountyCreated" });
    const id = Number((event.args as { bountyId: bigint }).bountyId);
    evidence[`${label}Create`] = receipt.transactionHash;
    return { id, receipt };
  }

  async function post(pathname: string, body?: unknown, authenticated = false): Promise<any> {
    const res = await fetch(`${apiUrl}${pathname}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authenticated ? { authorization: `Bearer ${adminToken}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`${pathname}: ${JSON.stringify(data)}`);
    return data;
  }

  // The public testnet RPC load-balances across nodes that can lag a block behind,
  // so an on-chain write can be mined but not yet visible to the indexer's reads.
  // Re-trigger the snapshot sync and retry until the row appears.
  async function postSubmission(pathname: string, body: unknown): Promise<any> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await post(pathname, body);
      } catch (err) {
        if (!String(err).includes("submission not indexed") || attempt >= 5) throw err;
        await post("/admin/sync");
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
  }

  await fund(business.address, "business");
  await fund(researcher.address, "researcher");

  const paid = await create("paid");
  const content = "Ticket 11 live testnet vulnerability report";
  const salt = randomSalt();
  const reportHash = submissionHash(paid.id, content, salt);
  const signature = await researcher.signMessage({ message: { raw: reportHash } });
  const paidSubmit = await send(researcherWallet, "submitSubmission", [BigInt(paid.id), reportHash]);
  evidence.paidSubmit = paidSubmit.transactionHash;
  await post("/admin/sync");
  await postSubmission(`/api/bounties/${paid.id}/submissions`, {
    submissionId: 0,
    content,
    salt,
    signature,
    txHash: paidSubmit.transactionHash,
    hash: reportHash
  });
  const paidAccept = await send(businessWallet, "acceptSubmission", [BigInt(paid.id), 0n]);
  evidence.paidAccept = paidAccept.transactionHash;
  requireCloseReason(paidAccept, 1, "payout");

  const cancelled = await create("cancelled");
  const cancelReceipt = await send(businessWallet, "cancelBounty", [BigInt(cancelled.id)]);
  evidence.cancel = cancelReceipt.transactionHash;
  requireCloseReason(cancelReceipt, 0, "cancel");

  const refunded = await create("refunded");
  evidence.refundSubmit = (await send(researcherWallet, "submitSubmission", [BigInt(refunded.id), keccak256(toBytes(`refund:${Date.now()}`))])).transactionHash;
  evidence.refundReject = (await send(businessWallet, "rejectSubmission", [BigInt(refunded.id), 0n])).transactionHash;
  const refundRequestReceipt = await send(businessWallet, "requestRefund", [BigInt(refunded.id)]);
  evidence.refundRequest = refundRequestReceipt.transactionHash;
  const refundReceipt = await send(businessWallet, "confirmRefund", [BigInt(refunded.id)]);
  evidence.refundConfirm = refundReceipt.transactionHash;
  requireCloseReason(refundReceipt, 2, "refund");

  const disputed = await create("disputed");
  evidence.disputeSubmit = (await send(researcherWallet, "submitSubmission", [BigInt(disputed.id), keccak256(toBytes(`dispute:${Date.now()}`))])).transactionHash;
  evidence.disputeRaise = (await send(researcherWallet, "raiseDispute", [BigInt(disputed.id), 0n])).transactionHash;
  const opened = await post("/api/admin/dispute/open", { bountyId: disputed.id, reason: "researcherFlag" }, true);
  evidence.disputeOpen = (await wait(opened.txHash)).transactionHash;
  const accepted = await post("/api/admin/judge/accept", { bountyId: disputed.id, submissionId: 0 }, true);
  evidence.disputeAccept = (await wait(accepted.txHash)).transactionHash;

  await post("/admin/sync");
  for (const [name, id] of Object.entries({ paid: paid.id, cancelled: cancelled.id, refunded: refunded.id, disputed: disputed.id })) {
    let closed = false;
    for (let attempt = 0; attempt < 6 && !closed; attempt++) {
      const res = await fetch(`${apiUrl}/api/bounties/${id}`);
      const bounty = await res.json();
      closed = res.ok && bounty.state === "Closed";
      if (!closed) {
        await post("/admin/sync");
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
    if (!closed) throw new Error(`${name} bounty ${id} did not close through the API`);
  }
  const receiptRes = await fetch(`${apiUrl}/api/bounties/${paid.id}/submissions/0/receipt`);
  const reportReceipt = await receiptRes.json();
  if (!receiptRes.ok || !reportReceipt.verified?.hashMatches || !reportReceipt.verified?.signerIsSubmitter) {
    throw new Error("backend receipt verification failed");
  }

  evidence.bountyIds = { paid: paid.id, cancelled: cancelled.id, refunded: refunded.id, disputed: disputed.id };
  evidence.businessRefundsVerified = true;
  evidence.backendReceiptVerified = true;
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
