import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Chain } from "viem";
import artifact from "../../abis/BountyEscrow.json";

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 968);
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://rpc.bohr.life";
export const CONTRACT_ADDRESS = (
  import.meta.env.VITE_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000"
) as `0x${string}`;
export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
export const CONTRACT_ABI = artifact.abi;

if (!API_URL) throw new Error("VITE_API_URL must be set in production builds — the backend is a separate host, not the frontend origin");
if (![677, 968].includes(CHAIN_ID)) throw new Error(`Unsupported BOT Chain ID: ${CHAIN_ID}`);
if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS) || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
  throw new Error("VITE_CONTRACT_ADDRESS must be a deployed contract address");
}

export const botChain: Chain = {
  id: CHAIN_ID,
  name: CHAIN_ID === 677 ? "BOT Chain Mainnet" : "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers:
    CHAIN_ID === 677
      ? { default: { name: "BOT Scan", url: "https://scan.botchain.ai" } }
      : { default: { name: "BOT Testnet Scan", url: "https://scan.bohr.life" } }
};

export const config = createConfig({
  chains: [botChain],
  connectors: [injected()],
  transports: { [botChain.id]: http(RPC_URL) }
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
