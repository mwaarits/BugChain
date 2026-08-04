import { serve } from "@hono/node-server";
import { createDb } from "./db";
import { createChain } from "./chain";
import { createIndexer } from "./indexer";
import { createAdmin } from "./admin";
import { createApp } from "./routes";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS is required");
  if (!ADMIN_PRIVATE_KEY) throw new Error("ADMIN_PRIVATE_KEY is required");

  const db = await createDb();
  const chain = createChain({ rpcUrl: RPC_URL, contractAddress: CONTRACT_ADDRESS });
  const indexer = createIndexer({ db, chain });
  const admin = createAdmin({ privateKey: ADMIN_PRIVATE_KEY, rpcUrl: RPC_URL, chain });
  const app = createApp({ db, chain, admin, indexer, adminToken: ADMIN_TOKEN });

  serve({ fetch: app.fetch, port: PORT });
  console.log(
    `backend on :${PORT}, contract ${CONTRACT_ADDRESS}` +
      (ADMIN_TOKEN ? ", admin endpoints enabled" : ", WARNING: no ADMIN_TOKEN, admin endpoints disabled")
  );

  await indexer.syncSnapshot();
  setInterval(() => {
    indexer.syncSnapshot().catch((err) => console.error("sync failed", err));
  }, 10_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});