# 01: BOT Chain ecosystem facts

Type: research
Status: resolved
Blocked by:

## Answer

BOT Chain is a standalone EVM-compatible Layer-1. Mainnet chain ID 677, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`, 0.75 s block time. Testnet chain ID **968**, RPC `https://rpc.bohr.life`, explorer `https://scan.bohr.life`, faucet `https://faucet.botchain.ai/basic` (10 tBOT/24h). BOT is the **native coin** (gas + value; 10^18 wei), not an ERC-20. Remix works via Injected Provider / External HTTP Provider — zero contract changes. Caveats: chain ID 968 is claimed by "Datagram" on ChainList (add testnet manually); `eth_getLogs` documented disabled on mainnet RPC but worked in probe — re-verify at integration.

Full citations: `.scratch/bot-bounty-platform/research/bot-chain-facts.md`

## Question

Establish the ground facts about BOT Chain that every later decision hangs on:

1. What is BOT Chain exactly — a standalone EVM chain, an L2, or an ecosystem name? Chain ID, RPC endpoint(s), block explorer, block time.
2. Does a **testnet** exist? Its name, RPC, faucet (how to get testnet BOT), block explorer.
3. Is **BOT** a native coin (gas + value) or an ERC-20/BEP-20 style token on the chain? Contract address if a token.
4. Can Remix IDE deploy to BOT Chain (EVM compatibility, network config steps)?
5. Anything unusual: fees, finality, compatibility caveats a Solidity dev must know.

Resolve via a /research subagent; record findings as the answer.
