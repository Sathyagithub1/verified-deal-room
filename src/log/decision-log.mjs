// Hash-chained record of everything the agents decided. The head hash is anchored on-chain,
// so any later edit, insertion or deletion of an entry is detectable.
import crypto from "node:crypto";

const GENESIS = "0".repeat(64);

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const hashOf = ({ seq, ts, actor, type, data, prev }) => sha256(canonical({ seq, ts, actor, type, data, prev }));

function deepFreeze(o) {
  if (o && typeof o === "object") Object.values(o).forEach(deepFreeze);
  return Object.freeze(o);
}

export class DecisionLog {
  #entries = [];
  #clock;

  constructor({ clock = () => new Date().toISOString() } = {}) {
    this.#clock = clock;
  }

  append(actor, type, data) {
    const prev = this.#entries.at(-1)?.hash ?? GENESIS;
    const body = { seq: this.#entries.length, ts: this.#clock(), actor, type, data: structuredClone(data), prev };
    const entry = deepFreeze({ ...body, hash: hashOf(body) });
    this.#entries.push(entry);
    return entry;
  }

  head() {
    return this.#entries.at(-1)?.hash ?? GENESIS;
  }

  entries() {
    return [...this.#entries];
  }

  exportBundle({ anchorTx, network }) {
    return { format: "ayon.decision-log/v1", head: this.head(), anchor: { network, tx: anchorTx }, entries: this.entries() };
  }
}

export function verifyChain(entries) {
  let prev = GENESIS;
  for (const [i, e] of entries.entries()) {
    if (e.seq !== i || e.prev !== prev || hashOf(e) !== e.hash) return { ok: false, brokenAt: i };
    prev = e.hash;
  }
  return { ok: true, head: prev };
}
