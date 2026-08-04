import { randomBytes } from "node:crypto";
import {
  concatHex,
  hexToBytes,
  numberToHex,
  keccak256,
  recoverMessageAddress,
  toBytes,
  toHex,
  type Account,
  type Hex
} from "viem";

export const SCHEMA_VERSION = 1;

export function normalize(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((it) => it.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

export function randomSalt(): Hex {
  return toHex(randomBytes(32));
}

export function submissionHash(bountyId: bigint | number, content: string, salt: string): Hex {
  if (hexToBytes(salt as Hex).length !== 32) {
    throw new Error("salt must be 32 bytes");
  }
  const packed = concatHex([
    numberToHex(SCHEMA_VERSION, { size: 1 }),
    numberToHex(BigInt(bountyId), { size: 32 }),
    toHex(toBytes(normalize(content))),
    salt as Hex
  ]);
  return keccak256(packed);
}

export async function signSubmission(
  wallet: { signMessage: (args: unknown) => Promise<Hex> },
  account: Account,
  hash: Hex
): Promise<Hex> {
  return wallet.signMessage({
    account,
    message: { raw: hash }
  } as never);
}

export async function recoverSigner(
  publicClient: unknown,
  hash: Hex,
  signature: Hex
): Promise<string> {
  return recoverMessageAddress({
    client: publicClient as never,
    message: { raw: hash },
    signature
  } as never);
}

export async function verifyReceipt(
  publicClient: unknown,
  receipt: { bountyId: string; hash: string; content: string; salt: string; signature: string },
  expectedSubmitter?: string
): Promise<{ hashMatches: boolean; signer: string; signerIsSubmitter: boolean }> {
  const rehashed = submissionHash(BigInt(receipt.bountyId), receipt.content, receipt.salt);
  const hashMatches = rehashed === receipt.hash;
  const signer = await recoverMessageAddress({
    client: publicClient as never,
    message: { raw: receipt.hash },
    signature: receipt.signature
  } as never);
  const signerIsSubmitter =
    expectedSubmitter !== undefined &&
    signer.toLowerCase() === expectedSubmitter.toLowerCase();
  return { hashMatches, signer, signerIsSubmitter };
}