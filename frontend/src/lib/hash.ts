import { concatHex, hexToBytes, keccak256, numberToHex, toBytes, toHex } from "viem";

export const SCHEMA_VERSION = 1;

export function normalize(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((it) => it.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

export function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function submissionHash(bountyId: bigint | number, content: string, salt: string): `0x${string}` {
  if (hexToBytes(salt as `0x${string}`).length !== 32) {
    throw new Error("salt must be 32 bytes");
  }
  const packed = concatHex([
    numberToHex(SCHEMA_VERSION, { size: 1 }),
    numberToHex(BigInt(bountyId), { size: 32 }),
    toHex(toBytes(normalize(content))),
    salt as `0x${string}`
  ]);
  return keccak256(packed);
}