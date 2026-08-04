# 03: Dispute and owner-silence workflow

Type: grilling
Status: resolved
Blocked by: 02

## Question

Decide the dispute and owner-silence mechanics precisely:

- What raises a dispute (researcher flags a rejection? admin observes owner silence for N days?), and is the dispute recorded on-chain or off-chain?
- Timer: owner silence `X` days after the first submission → dispute; pick X (suggested 3).
- Inside a dispute, exactly which contract calls may the Platform Admin make (accept + payout only? reject too?), and what prevents admin abuse (cannot self-pay without an accepted submission, no direct withdrawal).
- What happens to the bounty after a dispute resolves: closed, refundable remainder?
- Does the dispute status itself live on-chain (needed for the contract to gate the admin), or is admin authority handled off-chain via a dedicated admin wallet?

## Answer

Dispute = eskalasi yang **state-nya on-chain** (kontrak harus meng-gerbang admin), **bukti/isi-nya off-chain**. Admin authority via **alamat admin khusus** yang disetel saat deploy (bukan multi-sig, bukan komite).

### Menaikkan dispute (dua pemicu)

```solidity
enum DisputeReason { researcherFlag, ownerSilence }

function raiseDispute(uint256 bountyId, DisputeReason reason) external; // guard on-chain, admin exempt
function openDispute(uint256 bountyId, DisputeReason reason) external; // admin saja
function closeDispute(uint256 bountyId) external;      // admin saja
```

- `raiseDispute` — reason tercatat on-chain di event `DisputeRaised`. **Guard on-chain** (revisi 2026-08-04, redenploy; sebelumnya "siapa pun tanpa syarat" + rate limit API saja):
  - `researcherFlag` → caller wajib punya submission di bounty itu (`NotASubmitter`).
  - `ownerSilence` → wajib ada submission pertama + window sudah lewat (`SilenceUnavailable` / `SilenceNotElapsed`).
  - Kedua jalur: cooldown per address `raiseCooldown` (default 1 hari) → `RaiseCooldown`.
  - Admin exempt (backend on-behalf flow tetap berfungsi).
  - Gate API `POST /api/dispute/raise` tetap ada sebagai UX pre-check (friendly 429), tapi bukan enforcement — itu on-chain sekarang.
- `openDispute` — hanya admin; menyalakan flag gating `inDispute` (dari ticket 02). `reason` untuk event; jalur owner-silence tetap digerbang timer di sini juga.
- Bukti dispute (laporan, komunikasi) sepenuhnya off-chain; dApp yang meneruskannya ke admin.
- Parameter waktu `silenceWindow` & `raiseCooldown` **admin-settable** (`setSilenceWindow` / `setRaiseCooldown`, event `SilenceWindowSet`/`RaiseCooldownSet`) — tuning tanpa redeploy.
- Admin key bisa dirotasi via `transferAdmin(newAdmin)` (event `AdminTransferred`) — tanpa redeploy.

### Timer owner-silence

- `SILENCE_WINDOW = 3 hari` (konstanta set-deploy), dihitung dari **timestamp submission pertama**.
- **Ditegakkan on-chain**: `openDispute(bountyId, ownerSilence)` revert jika `block.timestamp < firstSubmissionTs + SILENCE_WINDOW`. Jalur `researcherFlag` tanpa timer.
- Business yang aktif menilai tak pernah tersentuh; dan begitu Business menilai, ia mengendalikan jendela itu sendiri.

### Kewenangan admin selama `inDispute`

Selama flag menyala, admin boleh melakukan **semua pemanggilan penilaian Business** (Business terkunci):

| Fungsi | Efek |
|---|---|
| `acceptSubmission(bountyId, submissionId)` | payout ke submitter → `Closed(paid)` |
| `rejectSubmission` / `markAllInvalid` | menilai tidak valid |
| `confirmRefund` | refund ke Business → `Closed(refunded)` (caller dari 02 diputuskan di sini) |
| `closeDispute` | padamkan flag, kembali ke state sebelumnya |

### Pencegahan penyalahgunaan admin

Struktural, bukan kepercayaan:
1. **Tidak ada fungsi penarikan bebas** — dana hanya keluar ke dua tujuan: submitter (via `acceptSubmission`, mensyaratkan submission `Accepted`) atau Business (refund). Alamat admin **tidak pernah menjadi payee**.
2. `openDispute(ownerSilence)` digerbang timer on-chain.
3. Semua aksi admin memancarkan event → audit trail publik.

Risiko yang diterima: admin bisa membuat submission palsu lalu meng-*accept*-nya (self-pay). Tidak dicegah tanpa timelock/komite — berlebihan untuk v1. **Model trust: Platform Admin adalah operator yang dipercaya.** Dicatat sebagai asumsi.

### Hasil dispute (tidak ada remainder)

| Hasil | Aksi | Akhir bounty |
|---|---|---|
| Submisi diterima | `acceptSubmission` | `Closed(paid)` — escrow habis (single winner, tanpa fee) |
| Putuskan refund | `confirmRefund` | `Closed(refunded)` |
| Protes ditolak | `closeDispute` saja | **kembali `Active`**, penilaian tetap berdiri, lifecycle lanjut normal |

### Perubahan permukaan kontrak (tambahan ke ticket 02)

```solidity
event DisputeRaised(uint256 indexed bountyId, address indexed raiser, DisputeReason reason);
event DisputeOpened(uint256 indexed bountyId, address indexed admin, DisputeReason reason);
event DisputeResolved(uint256 indexed bountyId, address indexed admin, Resolution resolution); // payout | refunded

// Bounty: + bool disputeRequested; + bool inDispute (sudah di 02)
// Konstanta: SILENCE_WINDOW (3 hari), RAISE_COOLDOWN (1 hari) — disetel saat deploy, admin-tunable
```
