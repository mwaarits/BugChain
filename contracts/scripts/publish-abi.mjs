import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactPath = path.resolve(here, "../artifacts/contracts/BountyEscrow.sol/BountyEscrow.json");
const outPath = path.resolve(here, "../../abis/BountyEscrow.json");

const { abi, bytecode, contractName } = JSON.parse(readFileSync(artifactPath, "utf8"));
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ abi, bytecode, contractName }, null, 2) + "\n");
console.log(`published ${contractName} -> abis/BountyEscrow.json`);
