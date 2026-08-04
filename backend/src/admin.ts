import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Chain } from "./chain";

export function createAdmin(opts: { privateKey: string; rpcUrl: string; chain: Chain }) {
  const account = privateKeyToAccount(opts.privateKey as Hex);
  const wallet = createWalletClient({ account, transport: http(opts.rpcUrl) });

  function send(bountyId: number, functionName: string, args: unknown[]): Promise<Hex> {
    return wallet.writeContract({
      address: opts.chain.contractAddress as `0x${string}`,
      abi: opts.chain.abi,
      account,
      chain: null as any,
      functionName,
      args
    });
  }

  return {
    account,
    openDispute: (bountyId: number, reason: number) => send(bountyId, "openDispute", [BigInt(bountyId), reason]),
    closeDispute: (bountyId: number) => send(bountyId, "closeDispute", [BigInt(bountyId)]),
    raiseDispute: (bountyId: number) => send(bountyId, "raiseDispute", [BigInt(bountyId)]),
    acceptSubmission: (bountyId: number, submissionId: number) =>
      send(bountyId, "acceptSubmission", [BigInt(bountyId), BigInt(submissionId)]),
    rejectSubmission: (bountyId: number, submissionId: number) =>
      send(bountyId, "rejectSubmission", [BigInt(bountyId), BigInt(submissionId)]),
    markAllInvalid: (bountyId: number) => send(bountyId, "markAllInvalid", [BigInt(bountyId)]),
    confirmRefund: (bountyId: number) => send(bountyId, "confirmRefund", [BigInt(bountyId)])
  };
}

export type Admin = ReturnType<typeof createAdmin>;