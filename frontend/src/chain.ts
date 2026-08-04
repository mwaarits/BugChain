import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Chain } from "viem";

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 968);
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://rpc.bohr.life";
export const CONTRACT_ADDRESS = (
  import.meta.env.VITE_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000"
) as `0x${string}`;
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const botChain: Chain = {
  id: CHAIN_ID,
  name: CHAIN_ID === 677 ? "BOT Chain Mainnet" : "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers:
    CHAIN_ID === 677
      ? { default: { name: "BOT Scan", url: "https://scan.botchain.ai" } }
      : undefined
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