import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  http,
  webSocket,
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
  eventClient?: PublicClient;
  contractAddress: string;
  abi: Abi;
}

export function createChain(opts: { rpcUrl: string; contractAddress: string; wsUrl?: string }): Chain {
  const { abi } = loadAbi();
  return {
    publicClient: createPublicClient({ transport: http(opts.rpcUrl) }),
    eventClient: opts.wsUrl ? createPublicClient({ transport: webSocket(opts.wsUrl) }) : undefined,
    contractAddress: opts.contractAddress,
    abi
  };
}

export async function latestBlock(chain: Chain): Promise<bigint> {
  return chain.publicClient.getBlockNumber({ cacheTime: 0 });
}

export async function readBountyCount(chain: Chain, blockNumber?: bigint): Promise<bigint> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "bountyCount",
    blockNumber
  }) as Promise<bigint>;
}

export async function readBounty(chain: Chain, bountyId: bigint, blockNumber?: bigint): Promise<any> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "bountyOf",
    args: [bountyId],
    blockNumber
  });
}

export async function readSubmissionCount(chain: Chain, bountyId: bigint, blockNumber?: bigint): Promise<bigint> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "submissionCountOf",
    args: [bountyId],
    blockNumber
  }) as Promise<bigint>;
}

export async function readSubmission(chain: Chain, bountyId: bigint, index: bigint, blockNumber?: bigint): Promise<any> {
  return chain.publicClient.readContract({
    address: chain.contractAddress as `0x${string}`,
    abi: chain.abi,
    functionName: "submissionAt",
    args: [bountyId, index],
    blockNumber
  });
}
