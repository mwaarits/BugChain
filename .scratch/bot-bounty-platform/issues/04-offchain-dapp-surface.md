# 04: Off-chain dApp surface and hash mechanics

Type: grilling
Status: resolved
Blocked by: 02

## Question

Decide the off-chain web dApp boundary and the submission hashing scheme:

- Hashing: what exactly gets hashed (report content? report id + content?), by whom (app-side before tx), and what salt/metadata, so the on-chain hash proves authorship of a specific off-chain report and claim order.
- What the app stores off-chain: bounties index, full reports, messages, validity decisions; how it learns on-chain state (events? polling?).
- Wallet/tooling: how the app talks to the contract (MetaMask? a wallet-connect lib? a hosted signer?) for Business, Researcher, and Admin actions.
- Web stack sketch (framework, storage) — enough to hand off, not a build plan.

## Answer

### 1. Skema hashing submission

```text
hash = keccak256(abi.encodePacked(uint8(1) /* versi skema */, uint256 bountyId, content, salt))
```

- **Dihash app-side sebelum tx** — kontrak hanya melihat `bytes32` (keputusan 02).
- `content` = teks laporan lengkap (Markdown); `salt` = 32 byte acak dibuat app saat draf.
- `bountyId` diikat ke dalam hash → komitmen **scope-bound** (laporan ke bounty lain = hash lain).
- **Normalisasi eksplisit sebelum hashing** (aturan terdokumentasi, harus direproduksi persis): encoding UTF-8, line-ending dinormalisasi ke LF, trailing whitespace per baris dihapus, satu trailing newline terakhir dihapus.
- **Authorship kriptografis**: wallet researcher `signMessage(hash)` saat submit; signature disimpan off-chain bersama `(content, salt)`. Keccak hanya membuktikan "tahu preimage"; signature mengikat alamat submitter ke hash — menutup celah "siapa pun yang punya preimage bisa mengaku".
- App menyimpan `(content, salt, signature)` di database, **di-key `submissionId` on-chain** (dikembalikan `submitSubmission`). Bukti authorship = re-hash `(content, salt)` = hash on-chain + submission tersimpan terhadap address signer.
- **Receipt unduhan** untuk researcher: `(bountyId, submissionId, hash, content, salt, signature, txHash)` — salinan di sisi user jadi jaring pengaman tak bergantung server (salt hilang = bukti hilang). Plus backup DB teratur/replika.

### 2. Storage off-chain & belajar state on-chain

- **Postgres** menyimpan: indeks bounty, laporan penuh `(content, salt, signature)`, pesan/komunikasi, keputusan validitas off-chain, record dispute (bukti/isi, dari 03). Browser tidak menyimpan apa-apa permanent.
- **Indekser**: sumber kebenaran = **state kontrak (snapshot reads)**, bukan event. Event = feed real-time (activity, kecepatan).
  - **Canonical sync**: full snapshot walk `for id in 0..bountyCount-1: read bounty + semua submissions` (state current utuh, idle costs O(N+M) reads — affordable skala SMB).
  - **Live feed**: WebSocket subscribe logs (docs BOT Chain recommended untuk frequent log pulling) + timer snapshot reconcile.
  - `eth_getLogs` = **better-if-available** untuk historical backfill/enrichment — bukan jalan tunggu (ticket 01: docs bilang disabled, probe sukses — diverifikasi saat integrasi; kalau benar disabled, indekser tetap jalan penuh).
- **Read surface kontrak ditambahkan** (belum ada di 02/03):
```solidity
function bountyCount() external view returns (uint256);
function bountyOf(uint256 bountyId) external view returns (Bounty memory);
function submissionCountOf(uint256 bountyId) external view returns (uint256);
function submissionAt(uint256 bountyId, uint256 index) external view returns (Submission memory);
function disputeFlag(uint256 bountyId) external view returns (bool disputeRequested, bool inDispute);
```
- **Idempotency level DB**: `bounties(bountyId PK)` dan `submissions(bounty_id, submission_id) PK gabungan`; setiap event diproses via upsert `ON CONFLICT (pk) DO UPDATE`; event log tersimpan punya unique key `(block_num, index_tx, log_index)` → replay dari titik mana pun aman.
- **Reorg handling**: setiap baris beri watermark `block_confirmed`; UI menampilkan `pending` sampai blok dianggap final (optimal ±5–10 blok @ 0.75 s ≈ 4–8 s); deteksi drift `head < block tersimpan` atau snapshot reconcile menyala → **rescan bounty** yang terpengaruh saja. (Finality cepat BOT Chain: docs rekomendasi tunggu ⅔N+1 seal untuk kritis).

### 3. Trust boundary frontend–backend

- **Mutasi (dana/judgment)**: kunci researcher & business **tidak pernah ada di backend** — hanya wallet browser (EIP-1193/EIP-6963). Backend tak bisa memalsukan/tandatangani tx mereka.
- **Admin key** berada di backend (env/secret manager) = platform admin, sesuai model trust ticket 03. Backend punya fungsi admin (open/close/resolve dispute) — **known limitation**: single admin key di server = single point of failure (server kena hack → attacker bisa resolve dispute). Wajib review ulang sebelum mainnet; key di secret manager, tak pernah di-commit, ada rencana rotasi jika bocor (`transferAdmin` on-chain + ganti `ADMIN_PRIVATE_KEY` — tanpa redeploy).
- **Operator auth (revisi 2026-08-04)**: gerbang `/api/admin/*` tidak lagi bergantung pada shared token yang diketik manual di browser. Backend memakai `ADMIN_OPERATOR` (address wallet operator) — challenge nonce → tanda tangan wallet → session token 15 menit (in-memory). `ADMIN_TOKEN` tetap berlaku sebagai fallback legacy bila `ADMIN_OPERATOR` kosong. Scope metadata write juga dikunci: hanya wallet Business pemilik bounty yang bisa menyimpan `scope_text` (tanda tangan pesan `Save scope for BugChain bounty #N`, diverifikasi terhadap `bounties.business`).
- Frontend bukan sumber kebenaran; hanya konsumen API. Data UI bisa diverifikasi terhadap chain (snapshot/callStatic) saat perlu (mis. verifikasi status payout).

### 4. Wallet & tooling

- **Library**: `viem` + `wagmi` (React), TypeScript-native.
- **Business & Researcher**: wallet browser MetaMask via injected EIP-1193 / EIP-6963; tombol **"Add BOT Chain"** via `wallet_addEthereumChain` (EIP-3085) encode chainId 677/968 + RPC + explorer — user tidak di salary isi manual. BOT native coin → saldo otomatis tampil setelah network; **`wallet_watchAsset` tidak berlaku** (BOT bukan ERC-20; hanya relevan kalau nanti pakai WBOT, di luar scope v1).
- **BO Wallet** official = mobile app non-custodial dengan SDK sendiri (bukan injected provider) → **di luar scope v1** web; check saat integrasi mobile via SDK-nya.
- **Platform Admin**: key private di backend env (secret manager), sign via viem; admin UI web menandatangani lewat backend.
- **Deployment**: tetap Remix (standing decision); ABI + source kontrak tersimpan di repo, app membaca ABI dari situ.

### 5. Web stack sketch (hand-off, bukan build plan)

- **Frontend**: React + Vite + TypeScript; wagmi/viem; **shadcn/ui** + Tailwind.
- **Backend**: Node + TypeScript (Hono/Express minimal); Postgres; indexer service (snapshot sync + WS logs).
- **Auth**: wallet-based — identity = alamat; tanpa login-password.
- **Deploy**: frontend → **Vercel** (statis); backend → **Render** (container + Postgres). Testnet→mainnet hanya beda config (RPC + chainId + contractAddress = satu env).

### Known limitations (dicatat eksplisit)

- Single admin key di backend (SPOF) — review wajib sebelum mainnet.
- `eth_getLogs` mainnet tidak pasti (docs vs probe) — di-verify saat integrasi; desain sudah tidak bergantung padanya.
- BO Wallet mobile di luar scope v1.
- Segala content string/docs destinasinya detail digital dijawab kontrak; laporan tidak on-chain by design.
