import { concatHex, hexToBytes, keccak256, numberToHex, toBytes, toHex, type Hex } from "viem";

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
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
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
