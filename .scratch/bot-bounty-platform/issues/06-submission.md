# 06 — Researcher submission & receipt

**What to build:** A Researcher opens a live Bounty and writes a vulnerability report; the app hashes it app-side (normalized, salt, bound to the Bounty, pre-image version-tagged), the Researcher signs the hash with their wallet, and the `submitSubmission` transaction lands the hash on-chain. The backend stores the full report and proof off-chain keyed to the on-chain submission, the Business can read the report with its claimed authorship, and the Researcher can download and re-verify their receipt.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The normalization rules are implemented exactly (UTF-8, LF line endings, trailing whitespace stripped, single trailing newline removed) and pinned by test vectors.
- [ ] The hash is `keccak256(version ‖ bountyId ‖ content ‖ salt)` where `salt` is 32 bytes of randomly generated at draft time.
- [ ] A submission is only accepted on-chain while the Bounty is Active, not in dispute, and before the deadline.
- [ ] On-chain the Submission stores only hash, submitter, and timestamp — report content itself never touches the chain.
- [ ] The postgres table rows are the full report: record `(content, salt, signature)` keyed by the on-chain submission id.
- [ ] A Researcher can download a six-item receipt (bounty id, submission id, hash, content, salt, signature, tx hash) that re-hashes to the same on-chain hash and verifies the signer's address.
- [ ] The Business's dashboard reads the full report plus the claimed signer identity from the backend.
- [ ] An authored test then aimed: a report text that differs only by content cannot claim the same on-chain hash; no one holding only the report text and salt can falsify authorship.