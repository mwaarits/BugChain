import { recoverMessageAddress, type Hex } from "viem";
import { normalize, randomSalt, submissionHash, SCHEMA_VERSION } from "@gmtbuilder/shared";
export { normalize, randomSalt, submissionHash, SCHEMA_VERSION };

export async function verifyReceipt(
  receipt: { bountyId: string; hash: Hex; content: string; salt: string; signature: Hex },
  expectedSubmitter?: string
): Promise<{ hashMatches: boolean; signer: string; signerIsSubmitter: boolean }> {
  const rehashed = submissionHash(BigInt(receipt.bountyId), receipt.content, receipt.salt);
  const hashMatches = rehashed === receipt.hash;
  const signer = await recoverMessageAddress({
    message: { raw: receipt.hash },
    signature: receipt.signature
  });
  const signerIsSubmitter =
    expectedSubmitter !== undefined &&
    signer.toLowerCase() === expectedSubmitter.toLowerCase();
  return { hashMatches, signer, signerIsSubmitter };
}
