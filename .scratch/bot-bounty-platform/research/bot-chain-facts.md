# BOT Chain — Ground Facts for a Solidity Developer

Research date: 2026-08-04. Every claim below is cited inline to the source that owns it (official site, official dev docs, official GitHub, ChainList, live RPC probes). Where a question could not be answered authoritatively, that is stated explicitly.

---

## 1. What exactly is "BOT Chain"?

**Answer: "BOT Chain" is a standalone, EVM-compatible Layer-1 blockchain (its own network — not an L2, not an Ethereum sidechain, not an ecosystem umbrella name).** Chain ID **677** mainnet. This is the only project officially called "BOT Chain" in the blockchain registry space; other "BOT" tokens are unrelated (see ambiguity notes below).

### Identity & architecture
- Official homepage: *"The premier DePIN + POS dual-driven **Layer 1** blockchain"* — https://www.botchain.ai/
- Official whitepaper ("BOT Chain Network Whitepaper — A Modular Algorithmic Network", Feb 2026): positions BOT Chain as a **modular algorithmic Layer-1 public chain** with a three-tier decoupled architecture: **Structural Core** (consensus, state, identity — JMT++ state tree, SPoA, AIDID), **Verifiable Execution Layer "vExecute"** (VPC parallel execution engine, ZK verification Groth16+Plonk), and **Modular Protocol Layer "MPL"** (DeFi/AI-Agent/DAO/bridge modules) — https://www.botchain.ai/docs/BOT%20Chain%20Network%20%20Whitepaper.pdf
- Consensus: **PoSA — Proof of Staked Authority** (a DPoS+PoA blend; validators elected by bonded stake produce blocks Clique-style; backup "Candidates" can also produce blocks at lower probability) — https://dev-docs.botchain.ai/docs/introduction/proof-of-staked-authority/ and https://dev-docs.botchain.ai/docs/introduction/
- Node topology (whitepaper): 21 super nodes + 72 light validation nodes; CertiK audit of the core; core code claims <4,200 lines (Rust microkernel per whitepaper risk section, though the published client is Go — see below).
- **Client implementation: a go-ethereum fork.** The official repo `github.com/BOTChain-bot/BOTCHAIN` is a Go codebase with the classic geth layout (`accounts/`, `core/`, `eth/`, `miner/`, `params/`, `trie/`, ...), LGPL-3.0/GPL-3.0 — https://github.com/BOTChain-bot/BOTCHAIN . Confirmed live: a mainnet block's `extraData` on `https://rpc.botchain.ai` encodes `geth/v1.26.4/linux` (probe 2026-08-04, `eth_getBlockByNumber latest`).
- Fast finality & throughput notes: consensus built on a difficulty-based fork choice with FFG, per **BEP-126** (bnb-chain/BEPs) with multi-block production per **BEP-341** — https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/

### Mainnet facts (verified)
| Item | Value | Source |
|---|---|---|
| Chain ID | **677** (0x2a5) — verified live via `eth_chainId` on 2026-08-04 | https://rpc.botchain.ai ; https://dev-docs.botchain.ai/docs/Developers/quick-guide/ |
| RPC | `https://rpc.botchain.ai` | https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/ |
| Block explorer | BOTScan `https://scan.botchain.ai` | https://dev-docs.botchain.ai/docs/Developers/quick-guide/ |
| Block time | **0.75 s** mainnet | https://dev-docs.botchain.ai/docs/introduction/proof-of-staked-authority/ ("Short blocking time, 0.75 seconds on the mainnet"); https://www.botchain.ai/ ("0.75 seconds Block Time") |
| Block height sanity | ~18,405,000 at 2026-08-04 (~160 days of 0.75 s blocks ⇒ launch ≈ late Feb 2026) | live `eth_blockNumber` probe |
| Currency | BOT, native gas token, 150 M total supply | https://dev-docs.botchain.ai/docs/Developers/quick-guide/ ; https://chainlist.org/chain/677 |
| Listed on ChainList | Yes — chainlist.org/chain/677 (ChainID 677 (0x2a5), currency BOT, explorer .botchain.ai) | https://chainlist.org/chain/677 |

- **Launch date:** mainnet "officially launched" announced 2026-02-25 (RootData news) — https://www.rootdata.com/news/556482 . Corroborated by the live block count and the site roadmap (mainnet hardening 2025 Q3–2026 Q1) — https://www.botchain.ai/
- **Company / team:** operated by "Bohr Life Inc" (site footer/legal) — https://www.botchain.ai/ ; CTO & chief architect Alexander Ververis (whitepaper §5.1; also interviewed at https://www.mexc.com/news/829570 ). $15M strategic round: NIX Foundation ($10M), Alpha Capital ($3M), Gemhead Capital ($2M) — whitepaper §1.4/§5.2.
- **Audits:** CertiK reports for Chain, Bridge, DEX published at `github.com/BOTChain-bot/Audit-report` — https://github.com/BOTChain-bot/Audit-report ; audit PDF linked on the official site — https://www.botchain.ai/

### Ambiguity — other things named "BOT"
If your source material for "BOT Chain" was an address or token ticker, beware these unrelated candidates (none of them is a chain named "BOT Chain"):
- **BOT / "Bot"** — an old ERC-20 on Ethereum at `0x07eC2091dfB10a8f2cbA80b4262ce472673Ae89AE` — https://thebittimes.com/token-BOT-ETH-0x07eC2091dfB10a8f2cbA80b4262ce472673A89AE.html
- **Book Of Trump (BOT)** — ERC-20 on Ethereum `0x396f38d0c79dfd925356c290c018ddc047851c3b` — https://thebittimes.com/token-BOT-ETH-0x396f38d0c79dfd925356c290c018ddc047851c3b.html
- **BOTCOIN (BOT)** — ERC-20 on Blast `0x2f41c426eb2Da677a5755E5fCfBAeEF42774A4aa` — https://blastscan.io/address/0x2f41c426eb2Da677a5755E5fCfBAeEF42774A4aa
- Various other BOT/BOTS tickers (Bot Ocean BOTS, Hashbots BOTS, memes) — e.g. https://etherscan.io/address/0xf9fbe825bfb2bf3e387af0dc18cac8d87f29dea8

**Most likely intended:** the EVM L1 described above (chain ID 677). Note its ecosystem label on CoinGecko is "BOT Chain" — https://www.coingecko.com/en/chains/bot-chain

---

## 2. Does a TESTNET exist?

**Yes.** Officially called **"BOT Chain Testnet"**, chain ID **968** (0x3c8) — verified live via `eth_chainId` on 2026-08-04.

| Item | Value | Source |
|---|---|---|
| Chain ID | **968** (0x3c8) | https://dev-docs.botchain.ai/docs/Developers/quick-guide/ (testnet: "Chain ID：968"); live probe |
| RPC | `https://rpc.bohr.life` | https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/ |
| Explorer | BOTScan Testnet `https://scan.bohr.life/` | https://dev-docs.botchain.ai/docs/Developers/quick-guide/ |
| Native token | tBOT (test BOT; also listed as "BOT" / 150 M supply in quick guide) | https://dev-docs.botchain.ai/docs/Developers/quick-guide/ |
| Faucet | `https://faucet.botchain.ai/basic` — up to **10 tBOT per address per 24 h**; tBOT has no real value | https://dev-docs.botchain.ai/docs/Developers/claim-test-tbot-tokens/ ; https://faucet.botchain.ai/basic |

Faucet procedure (official docs): switch wallet to BOT Chain Testnet (chain 968) → open faucet URL → enter address + complete verification ("I am not a robot") → faucet returns a tx hash viewable on scan.bohr.life — https://dev-docs.botchain.ai/docs/Developers/claim-test-tbot-tokens/

Notes:
- The testnet is branded with the "Bohr" logo on the faucet and lives on the `bohr.life` domains, but the official docs consistently name the network **"BOT Chain Testnet"** — https://faucet.botchain.ai/basic
- **Caveat:** Chain ID 968 is registered to a *different* network, **Datagram** (currency DGRAM), on ChainList — https://chainlist.org/chain/968 . BOT Chain's testnet is **not** on ChainList, so "one-click add via ChainList" would add the wrong network. Add it manually.

---

## 3. Is "BOT" a native coin or an ERC-20/BEP-20 token?

**BOT is the chain's NATIVE coin — it pays gas AND carries value (also staking + governance). It is not a deployed ERC-20 contract on BOT Chain.** Official sources:

- *"BOT is the native utility token of BOT Chain and is used to pay transaction fees."* — https://dev-docs.botchain.ai/docs/Developers/quick-guide/
- *"The native BOT token serves as both gas for smart-contract execution and the staking asset for network security and governance."* — https://dev-docs.botchain.ai/docs/introduction/
- Whitepaper §3.1: BOT = "BOT Chain Token", symbol **BOT**, total supply **150,000,000 hard cap (never increased)**, unit **1 BOT = 10^18 wei** (Ethereum-consistent for tooling migration). Notable phrasing: *"Native issuance with dual compatibility for ERC-20 and BEP-20, enabling cross-chain bridging and seamless integration with major exchanges"* — i.e., it is natively issued (not a smart contract), designed to interoperate like an ERC-20/BEP-20 — https://www.botchain.ai/docs/BOT%20Chain%20Network%20%20Whitepaper.pdf
- ChainList lists it as the chain currency: ChainID 677, Currency **BOT** — https://chainlist.org/chain/677
- Live `eth_gasPrice` on mainnet RPC returned 24,000,000,000 wei (24 gwei) on 2026-08-04 (gas priced in BOT, wei units = 10^18).

**Contract address?** Native coins have no contract address. If you need an ERC-20-representable form on-chain, there is a **Wrapped BOT (WBOT)** ERC-20 on BOT Chain at **`0xD5452816194a3784dBa983426cCe7c122F4abd30`** (official explorer token page: https://scan.botchain.ai/token/0xD5452816194a3784dBa983426cCe7c122F4abd30 ; listed on CoinGecko — https://www.coingecko.com/en/coins/wrapped-bot ). Ecosystem also has bridged assets (e.g., "BOT Chain Bridged USDT") — https://www.coingecko.com/en/chains/bot-chain . We could not find an official doc listing the WBOT contract; the address comes from the explorer/aggregators and was not re-verified contract-side by the team (treat as third-party-reported).

Do not confuse the native BOT with the unrelated ERC-20/BEP-20 "BOT" tokens on Ethereum/Blast (§1 ambiguity list).

---

## 4. Can Remix IDE deploy to BOT Chain?

**Yes — BOT Chain is EVM-compatible with Geth-compatible JSON-RPC, so Remix works with zero contract changes.** Supporting evidence:

- *"Since BOT Chain is EVM-compatible, your existing Ethereum smart contract skills will seamlessly transfer to BOT Chain."* and Remix is listed first under official **Developer Tools** — https://dev-docs.botchain.ai/docs/Developers/quick-guide/
- *"BOT Chain is nearly fully compatible with the Geth APIs"* — https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/
- Official MetaMask mainnet config (the same values Remix needs when using "Injected Provider"): Network Name `BOT Chain Mainnet`, RPC `https://rpc.botchain.ai`, Chain ID `677`, Currency Symbol `BOT`, Block Explorer `https://scan.botchain.ai` — https://www.botchain.ai/en/help-center/docs/getting-started/add-bot-chain-metamask

**Config steps (standard EVM workflow — Remix has no BOT-specific tutorial, see gap note):**
1. Add the network to a wallet (MetaMask manual entry above, or BO Wallet — https://wallet.botchain.ai ; BO Wallet is the official wallet, https://dev-docs.botchain.ai/docs/Developers/quick-guide/).
2. In Remix (https://remix.ethereum.org/): Deploy & Run Transactions → Environment **"Injected Provider"** (uses the wallet's network) — or **"External HTTP Provider"** pointed at `https://rpc.botchain.ai` (mainnet 677) / `https://rpc.bohr.life` (testnet 968).
3. Fund the deployer address: mainnet via official B-DEX swap or BOT Bridge (see §5); testnet via the faucet (tBOT, §2).
4. Deploy; verify on https://scan.botchain.ai

**Honest gap:** the official docs endorse Remix but do not publish a BOT-specific Remix walkthrough; the above steps are the generic EVM procedure applied to the officially documented network parameters.

---

## 5. Anything unusual a Solidity dev must know

1. **`eth_getLogs` on the official mainnet RPC is documented as DISABLED** — *"eth_getLogs is disabled on below Mainnet endpoints. Please use 3rd party endpoints… If you need to pull logs frequently, we recommend using WebSockets"* — https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/ . ⚠️ **But our live probe on 2026-08-04 returned logs successfully from `https://rpc.botchain.ai`.** The doc may be stale or endpoint-dependent — if your bug-bounty dApp indexes events (highly likely), verify this at integration time and plan for 3rd-party RPC/WebSocket fallback.
2. **EIP-4844 blobs live on the execution layer**, with dedicated APIs (`eth_getBlobSidecarByTxHash`, `eth_getBlobSidecars`) — https://dev-docs.botchain.ai/docs/Developers/blob-api/ ; unusual: blobs are an L1/Ethereum-roadmap feature, not an L2 here.
3. **Faster, different finality.** Consensus = "Parlia"-style difficulty-based fork choice + FFG (BEP-126), multi-block production (BEP-341) — https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/ . With **Fast Finality** enabled (coming with the "Plato" upgrade per docs), blocks finalize within ~2 blocks if ≥⅔N validators vote; without it, probabilistic finality — https://dev-docs.botchain.ai/docs/introduction/fast-finality/ . Site claims: 0.75 s blocks, ~0.9 s avg finality, irreversibility < 2 s, "native MEV resistance" — https://www.botchain.ai/ . For critical apps the docs recommend waiting for ⅔N+1 validator seals — https://dev-docs.botchain.ai/docs/introduction/fast-finality/
4. **Gas model: flat-ish and unusual.** Whitepaper: **0.001 BOT per basic transaction**, split **50% permanently burned / 20% nodes / 30% ecosystem fund**; zero inflation (rewards paid from fees, no block issuance) — https://www.botchain.ai/docs/BOT%20Chain%20Network%20%20Whitepaper.pdf . Live sample gas price was 24 gwei (2026-08-04) and the latest block showed `baseFeePerGas: 0x0` (EIP-1559 base-fee mechanism not visibly active on the public RPC at probe time). Treat the 0.001 BOT figure as the whitepaper's design target, not a confirmed on-chain constant.
5. **Gasless transactions for EOAs (not EIP-4337).** An "EOA Paymaster" lets wallets submit zero-gas-price txs that builders bundle with a sponsor tx; paymasters must expose `pm_isSponsorable`; MegaFuel (Nodereal) is listed as available paymaster infra — https://dev-docs.botchain.ai/docs/Developers/eoa-paymaster/
6. **EVM-129/Clique-family semantics** — PoSA uses Clique-style validator sealing (EIP-225) — https://dev-docs.botchain.ai/docs/introduction/proof-of-staked-authority/ . Standard Solidity/`eth_` APIs apply; no fee-recipient/`coinbase` games beyond geth norms.
7. **Node ops caveats** (if you run a node): geth listener/discovery ports TCP+UDP 31000, JSON-RPC 8545, don't expose RPC publicly — https://dev-docs.botchain.ai/docs/Developers/bot-chain-node-configuration-best-practices/
8. **Getting mainnet BOT:** currently via the official **B-DEX** swap (https://dex.botchain.ai/#/swap) or the **BOT Bridge** (https://bridge.botchain.ai; the bridge offers a "BOT for future Gas" option); testnet assets cannot pay mainnet gas — https://dev-docs.botchain.ai/docs/Developers/quick-guide/ ; https://www.botchain.ai/en/help-center/docs/getting-started/get-bot-for-gas
9. **Naming inconsistency (official docs vs whitepaper):** dev-docs say **PoSA**; the whitepaper/site say **SPoA** ("Staked Proof-of-Authority") and the site additionally describes a "dual-track hybrid consensus" with a performance layer + physically anchored finality layer — https://www.botchain.ai/ . Same mechanism, two names.
10. **Ecosystem context for your dApp:** BOT Chain already runs an official bug-bounty program — *"Bug bounty: Up to $1.25 million reward pool (in collaboration with HackenProof platform)"* — https://www.botchain.ai/docs/BOT%20Chain%20Network%20%20Whitepaper.pdf (p.16). Relevant if you're building a competing/aggregating bounty platform.

---

## Open questions / gaps (answered honestly)

- **No authoritative BOT testnet name beyond "BOT Chain Testnet"**; "Bohr" appears only as branding/domains (faucet logo, `bohr.life`). No official statement that the testnet is "named Bohr".
- **No official Remix walkthrough** exists (Remix is only listed as a supported tool).
- **WBOT contract address** is third-party-reported (CoinGecko/explorer page); not confirmed in official docs.
- **`eth_getLogs` doc vs. observed behavior conflict** (documented disabled, observed enabled on 2026-08-04) — must be re-verified before relying on it.
- **Faucet details** beyond "10 tBOT / 24 h" (rate windows, captcha mechanics) are not documented.
- **Launch/economic numbers** (0.001 BOT gas, 150 M supply, deflation split) come from the whitepaper; the quick guide independently confirms 150 M supply and BOT as native gas.
- Whitepaper claims (e.g., "single-slot finality probability >99.9%", TPS 3,000–15,000, "Rust microkernel") are project self-reports; the only independently auditable facts we confirmed live are the chain ID, RPC behavior, and geth client version.
