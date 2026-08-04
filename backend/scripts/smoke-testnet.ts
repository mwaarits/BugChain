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

  async function create(label: string): Promise<number> {
    const receipt = await send(
      businessWallet,
      "createBounty",
      [keccak256(toBytes(`testnet-smoke:${label}:${Date.now()}`)), BigInt(Math.floor(Date.now() / 1000) + 86_400)],
      reward
    );
    const [event] = parseEventLogs({ abi, logs: receipt.logs, eventName: "BountyCreated" });
    const id = Number((event.args as { bountyId: bigint }).bountyId);
    evidence[`${label}Create`] = receipt.transactionHash;
    return id;
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

  await fund(business.address, "business");
  await fund(researcher.address, "researcher");

  const paid = await create("paid");
  const content = "Ticket 11 live testnet vulnerability report";
  const salt = randomSalt();
  const reportHash = submissionHash(paid, content, salt);
  const signature = await researcher.signMessage({ message: { raw: reportHash } });
  const researcherBeforeSubmit = await publicClient.getBalance({ address: researcher.address });
  const paidSubmit = await send(researcherWallet, "submitSubmission", [BigInt(paid), reportHash]);
  const researcherAfterSubmit = await publicClient.getBalance({ address: researcher.address });
  evidence.paidSubmit = paidSubmit.transactionHash;
  await post("/admin/sync");
  await post(`/api/bounties/${paid}/submissions`, {
    submissionId: 0,
    content,
    salt,
    signature,
    txHash: paidSubmit.transactionHash,
    hash: reportHash
  });
  const paidAccept = await send(businessWallet, "acceptSubmission", [BigInt(paid), 0n]);
  evidence.paidAccept = paidAccept.transactionHash;
  const researcherAfterPayout = await publicClient.getBalance({ address: researcher.address, blockNumber: paidAccept.blockNumber });
  if (researcherAfterPayout - researcherAfterSubmit !== reward) throw new Error("researcher payout was not exact");
  evidence.researcherBalance = {
    beforeSubmission: researcherBeforeSubmit.toString(),
    afterSubmissionGas: researcherAfterSubmit.toString(),
    afterPayout: researcherAfterPayout.toString()
  };

  const cancelled = await create("cancelled");
  const businessBeforeCancel = await publicClient.getBalance({ address: business.address });
  evidence.cancel = (await send(businessWallet, "cancelBounty", [BigInt(cancelled)])).transactionHash;
  const businessAfterCancel = await publicClient.getBalance({ address: business.address });
  if (businessAfterCancel <= businessBeforeCancel) throw new Error("cancel did not return escrow to Business");

  const refunded = await create("refunded");
  evidence.refundSubmit = (await send(researcherWallet, "submitSubmission", [BigInt(refunded), keccak256(toBytes(`refund:${Date.now()}`))])).transactionHash;
  evidence.refundReject = (await send(businessWallet, "rejectSubmission", [BigInt(refunded), 0n])).transactionHash;
  evidence.refundRequest = (await send(businessWallet, "requestRefund", [BigInt(refunded)])).transactionHash;
  const businessBeforeRefund = await publicClient.getBalance({ address: business.address });
  evidence.refundConfirm = (await send(businessWallet, "confirmRefund", [BigInt(refunded)])).transactionHash;
  const businessAfterRefund = await publicClient.getBalance({ address: business.address });
  if (businessAfterRefund <= businessBeforeRefund) throw new Error("refund did not return escrow to Business");

  const disputed = await create("disputed");
  evidence.disputeSubmit = (await send(researcherWallet, "submitSubmission", [BigInt(disputed), keccak256(toBytes(`dispute:${Date.now()}`))])).transactionHash;
  evidence.disputeRaise = (await send(researcherWallet, "raiseDispute", [BigInt(disputed)])).transactionHash;
  const opened = await post("/api/admin/dispute/open", { bountyId: disputed, reason: "researcherFlag" }, true);
  evidence.disputeOpen = (await wait(opened.txHash)).transactionHash;
  const accepted = await post("/api/admin/judge/accept", { bountyId: disputed, submissionId: 0 }, true);
  evidence.disputeAccept = (await wait(accepted.txHash)).transactionHash;

  await post("/admin/sync");
  for (const [name, id] of Object.entries({ paid, cancelled, refunded, disputed })) {
    const res = await fetch(`${apiUrl}/api/bounties/${id}`);
    const bounty = await res.json();
    if (!res.ok || bounty.state !== "Closed") throw new Error(`${name} bounty ${id} did not close through the API`);
  }
  const receiptRes = await fetch(`${apiUrl}/api/bounties/${paid}/submissions/0/receipt`);
  const reportReceipt = await receiptRes.json();
  if (!receiptRes.ok || !reportReceipt.verified?.hashMatches || !reportReceipt.verified?.signerIsSubmitter) {
    throw new Error("backend receipt verification failed");
  }

  evidence.bountyIds = { paid, cancelled, refunded, disputed };
  evidence.businessRefundsVerified = true;
  evidence.backendReceiptVerified = true;
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
