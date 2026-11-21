// Turn a saved demo run into an EU AI Act record-keeping JSON:
//   node src/cli/export-euaia.mjs runs/demo-<time>.json
import { readFileSync, writeFileSync } from "node:fs";
import { toEuAiActRecord } from "../log/export-euaia.mjs";
import { toMicro } from "../amounts.mjs";

const file = process.argv[2];
if (!file) throw new Error("usage: export-euaia.mjs runs/demo-<time>.json");
const run = JSON.parse(readFileSync(file, "utf8"));
if (run.scenes.deal.outcome !== "deal") throw new Error(`${file} has no settled deal to export`);
const record = toEuAiActRecord({
  bundle: run.scenes.deal.log,
  agents: run.registry,
  oversight: { capMicro: toMicro(run.scenario.capCcd), maxCalls: 8 },
});
const out = file.replace(/demo-/, "euaia-record-");
writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
process.stdout.write(`${out}: ${record.events.length} events, chain verified=${record.integrity.chainVerified}, anchor ${record.integrity.anchor?.tx}\n`);
