# 02: Escrow contract surface design

Type: grilling
Status: resolved
Blocked by: 01

## Question

Decide the on-chain escrow contract surface — functions, state, events, roles — for the bounty lifecycle settled so far:

- `createBounty` (funds escrow in BOT, sets reward, scope hash, deadline), `cancel` (allowed only while `submissionCount == 0`), refund paths (zero submissions past deadline; or all submissions explicitly `rejected` via `rejectSubmission`/`markAllInvalid`).
- Submission recording: on-chain stores hash + timestamp + submitter, nothing else.
- `acceptSubmission` → single payout by the Business; in a dispute, payout trigger moves to the Platform Admin.
- Access control: Business owns its bounty; Platform Admin touches funds only in active disputes.
- Events needed for the off-chain dApp to index everything.

The answer is the contract's interface contract (function signatures + state machine), not Solidity implementation yet.

## Answer

Kontrak tunggal `BountyEscrow` (di-deploy sekali, dipakai semua Business) yang mengelola banyak bounty ber-id. Berikut interface contract-nya.

### Roles

- **Business** — per-bounty, si pembuat `createBounty`. Boleh menyentuh dananya sendiri.
- **Platform Admin** — satu alamat tetap (deployer), disetel saat deploy. Menyentuh dana **hanya** saat bounty `inDispute` (via `acceptSubmission`) — tidak ada fungsi penarikan bebas.
- **Researcher** — siapa pun; hanya bisa `submitSubmission`.

### Struct

```solidity
struct Bounty {
    bytes32 scopeHash;
    uint256 reward;          // msg.value saat createBounty
    uint256 deadline;        // block.timestamp
    address business;
    uint256 submissionCount;
    BountyState state;       // Active | RefundPending | Closed
    bool inDispute;          // flag untuk ticket 03, dipasang oleh admin
}

struct Submission {
    bytes32 hash;
    address submitter;
    uint256 timestamp;       // disimpan untuk claim-order; TIDAK di-event (redundan)
    SubmissionState state;   // Submitted | Accepted | Rejected
}
```

### Fungsi (signature + otorisasi)

| Fungsi | Otorisasi | Syarat tambahan |
|---|---|---|
| `createBounty(bytes32 scopeHash, uint256 deadline) payable → uint bountyId` | siapa pun (menjadi Business) | `msg.value > 0`, `deadline > now` |
| `submitSubmission(uint256 bountyId, bytes32 hash)` | siapa pun | bounty `Active`; bukan `inDispute`; `now < deadline` |
| `acceptSubmission(uint256 bountyId, uint256 submissionId)` | Business **atau** admin saat `inDispute` | bounty `Active`; submission `Submitted`; payout sekali → `Closed(paid)` |
| `rejectSubmission(uint256 bountyId, uint256 submissionId)` | Business | submission `Submitted`; selagi belum semua rejection |
| `markAllInvalid(uint256 bountyId)` | Business | menolak semua sekaligus (satu tx, hemat gas) |
| `cancelBounty(uint256 bountyId)` | Business | `submissionCount == 0` → refund langsung → `Closed(cancelled)` (mencakup sweep otomatis pasca-deadline) |
| `requestRefund(uint256 bountyId)` | Business | semua submission `Rejected` → state `RefundPending`, emit `RefundRequested` |
| `confirmRefund(uint256 bountyId)` | Business / admin (rincian ke ticket 03) | state `RefundPending` → refund → `Closed(refunded)` |

Dua-fase refund (`requestRefund` → `confirmRefund`) memberi jendela dispute agar researcher bisa menghentikan refund sebelum dana keluar. `cancelBounty` tetap satu-fase karena dengan nol submission tak ada claimant untuk memprotes.

### Event (untuk indexing dApp — set lengkap)

```solidity
event BountyCreated(uint256 indexed bountyId, address indexed business, bytes32 scopeHash, uint256 reward, uint256 deadline);
event SubmissionSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed submitter, bytes32 hash);
event SubmissionJudged(uint256 indexed bountyId, uint256 indexed submissionId, bool accepted);
event RefundRequested(uint256 indexed bountyId);
event BountyClosed(uint256 indexed bountyId, Reason reason); // cancel | paid | refunded
event DisputeOpened(uint256 indexed bountyId, address indexed openedBy);
event DisputeResolved(uint256 indexed bountyId, address indexed admin, Resolution resolution); // payout | refunded
```

`timestamp` tidak di-event (sudah di header blok / receipt). `DisputeOpened.openedBy` membedakan flag researcher vs observasi owner-silence; detail dispute tetap off-chain. `BountyClosed` = satu baris "bounty berakhir karena X" untuk dApp (payout tersirat dari `reason=paid` + submission `accepted`).

### Mesin status

```
                ┌──────────────────────────────────────────────┐
                │                                             │
 Active ──submitSubmission (pre-deadline, non-dispute)────────┘
   │
   ├─ acceptSubmission (Business | admin via dispute) ──► Closed (paid)
   ├─ rejectSubmission / markAllInvalid berulang:
   │      semua Rejected ── requestRefund ──► RefundPending ── confirmRefund ──► Closed (refunded)
   ├─ cancelBounty (submissionCount==0) ──► Closed (cancelled)
   └─ (deadline punya satu efek: memutus submit; sweep nol-sumbmission lewat deadline = cancelBounty)
```

`inDispute` adalah flag ortogonal: selama nyala, hanya admin yang bisa memindahkan dana; sisanya query-only. Defer ke ticket 03: pemicu dispute, siapa panggil `confirmRefund`, durasi window, dan apa yang terjadi setelah dispute selesai.
