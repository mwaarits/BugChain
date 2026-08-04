import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { normalize, randomSalt, submissionHash, verifyReceipt } from "../src/hash.js";

const salt = (b: string) => ("0x" + b.repeat(32)) as Hex;
const key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const account = privateKeyToAccount(key);
const sign = (hash: Hex) => account.signMessage({ message: { raw: hash } });

describe("hash normalization (ticket 06)", () => {
  it("normalizes CRLF and bare CR to LF", () => {
    expect(normalize("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("strips trailing whitespace per line", () => {
    expect(normalize("hello   \nworld\t  \nkeep")).toBe("hello\nworld\nkeep");
  });

  it("removes trailing newlines at the end", () => {
    expect(normalize("hello\n")).toBe("hello");
    expect(normalize("hello\n\n\n")).toBe("hello");
  });

  it("combines all rules — a full worked example", () => {
    expect(normalize("# Report\r\n\n  \nline one  \r\nline two\t\n\n")).toBe(
      "# Report\n\n\nline one\nline two"
    );
  });

  it("is idempotent", () => {
    const raw = "x  \r\ny\n\n";
    expect(normalize(normalize(raw))).toBe(normalize(raw));
  });
});

describe("submission hash (ticket 04/06)", () => {
  it("is deterministic for the same (bountyId, content, salt)", () => {
    const a = submissionHash(7n, "hello world\nsecond line", salt("ab"));
    const b = submissionHash(7n, "hello world\nsecond line", salt("ab"));
    expect(a).toBe(b);
  });

  it("reports differing only by content cannot claim the same hash", () => {
    const base = "The bug is in auth.\nSeverity: high";
    const tweaked = "The bug is in auth!\nSeverity: high";
    expect(submissionHash(1, base, salt("cd"))).not.toBe(submissionHash(1, tweaked, salt("cd")));
  });

  it("is bound to the bounty: a different bountyId yields a different hash", () => {
    const content = "same content";
    expect(submissionHash(2, content, salt("ef"))).not.toBe(submissionHash(3, content, salt("ef")));
  });

  it("random salts are unique — two drafts never collide", () => {
    expect(randomSalt()).not.toBe(randomSalt());
    expect(randomSalt()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("hashes the normalized content, hiding whitespace drift", () => {
    const saltHex = salt("12");
    expect(submissionHash(9, "same content  \r\n", saltHex)).toBe(submissionHash(9, "same content\n", saltHex));
  });
});

describe("receipt regeneration (ticket 06)", () => {
  it("re-hashes a (content, salt) pair to the same on-chain hash and verifies authorship", async () => {
    const hash = submissionHash(5, "the report body", salt("34"));
    const signature = await sign(hash);
    const result = await verifyReceipt(
      undefined,
      { bountyId: "5", submissionId: "0", hash, content: "the report body", salt: salt("34"), signature },
      account.address
    );
    expect(result.hashMatches).toBe(true);
    expect(result.signer.toLowerCase()).toBe(account.address.toLowerCase());
    expect(result.signerIsSubmitter).toBe(true);
  });

  it("a receipt whose content diverges from the on-chain hash fails verification", async () => {
    const hash = submissionHash(5, "the report", salt("34"));
    const signature = await sign(hash);
    const result = await verifyReceipt(undefined, {
      bountyId: "5",
      submissionId: "0",
      hash,
      content: "a different body",
      salt: salt("34"),
      signature
    });
    expect(result.hashMatches).toBe(false);
  });
});