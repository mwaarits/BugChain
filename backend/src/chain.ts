import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  http,
  type Abi,
  type PublicClient
} from "viem";

export function loadAbi(): { abi: Abi; bytecode: string } {
  const raw = readFileSync(path.resolve(__dirname, "../../abis/BountyEscrow.json"), "utf8");
  const artifact = JSON.parse(raw) as { abi: Abi; bytecode: string };
  return artifact;
}

export interface Chain {
  publicClient: PublicClient;
  contractAddress: string;
  abi: Abi;
}

export function createChain(opts: { rpcUrl: string; contractAddress: string }): Chain {
  const { abi } = loadAbi();
  return {
    publicClient: createPublicClient({ transport: http(opts.rpcUrl) }),
    contractAddress: opts.contractAddress,
    abi
  };
}

export async function latestBlock(chain: Chain): Promise<bigint> {
  return chain.publicClient.getBlockNumber();
}

export async function readBountyCount(chain: Chain): Promise<bigint> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "bountyCount"
  }) as Promise<bigint>;
}

export async function readBounty(chain: Chain, bountyId: bigint): Promise<any> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "bountyOf",
    args: [bountyId]
  });
}

export async function readSubmissionCount(chain: Chain, bountyId: bigint): Promise<bigint> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "submissionCountOf",
    args: [bountyId]
  }) as Promise<bigint>;
}

export async function readSubmission(chain: Chain, bountyId: bigint, index: bigint): Promise<any> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "submissionAt",
    args: [bountyId, index]
  });
}