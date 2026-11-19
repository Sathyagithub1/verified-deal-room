// Ported from Sourcio (agents/src/claude-agents.mjs): prompts now take the scenario currency,
// and the per-run spend ceiling is pinned by LIMITS + worstCaseUsd().
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Decision } from "./negotiation.mjs";

// Same model the Sourcio live testnet run used on 2026-11-14.
const MODEL = "claude-opus-5";

// Price ceiling deliberately above any current Claude list price, so the $5 bound holds for any model.
export const LIMITS = Object.freeze({ maxCalls: 8, maxTokens: 4000, estInputTokens: 2500, inPerMTok: 15, outPerMTok: 75 });

export function worstCaseUsd(l = LIMITS) {
  return (l.maxCalls * (l.estInputTokens * l.inPerMTok + l.maxTokens * l.outPerMTok)) / 1_000_000;
}

export class CallCapExceeded extends Error {
  constructor(max) {
    super(`Model call cap of ${max} reached`);
    this.name = "CallCapExceeded";
  }
}

function sellerSystem(s) {
  return [
    "You are the sales agent for a wholesale supplier on the Sourcio B2B marketplace.",
    `Product: ${s.product}. Buyer asked for ${s.quantity} units.`,
    `Your list price is ${s.seller.listUnitPrice} ${s.currency} per unit. Never go below ${s.seller.floorUnitPrice} ${s.currency} per unit.`,
    `Your normal lead time is ${s.seller.leadTimeDays} days; you may shorten it by up to 3 days for a higher price.`,
    "Make an offer, accept the buyer's latest offer, or walk away. Keep messages short and businesslike.",
  ].join("\n");
}

function buyerSystem(s) {
  return [
    "You are a purchasing agent spending your company's money. Payment settles on-chain after the deal.",
    `Product: ${s.product}. You need ${s.quantity} units within ${s.buyer.maxLeadTimeDays} days.`,
    `Hard budget cap, enforced before payment: the total deal value cannot exceed ${s.capCcd} ${s.currency}.`,
    `Aim for around ${s.buyer.targetUnitPrice} ${s.currency} per unit.`,
    "Make an offer, accept the supplier's latest offer, or walk away. Keep messages short and businesslike.",
  ].join("\n");
}

function renderTranscript(transcript, currency) {
  if (transcript.length === 0) return "No messages yet. The buyer's RFQ is open; respond with your first offer.";
  return transcript
    .map((t) => `${t.role.toUpperCase()} (${t.action}): ${t.quantity} units @ ${t.unit_price} ${currency}, ${t.lead_time_days} days. "${t.message}"`)
    .join("\n");
}

/** Builds the decide(role, transcript) function used by negotiate(), with a hard call cap. */
export function claudeDecider({ scenario, maxCalls = LIMITS.maxCalls, client = new Anthropic() }) {
  if (maxCalls > LIMITS.maxCalls) throw new Error(`maxCalls ${maxCalls} exceeds the hard limit ${LIMITS.maxCalls}`);
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  async function decide(role, transcript) {
    if (usage.calls >= maxCalls) throw new CallCapExceeded(maxCalls);
    usage.calls += 1;
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: LIMITS.maxTokens,
      system: role === "buyer" ? buyerSystem(scenario) : sellerSystem(scenario),
      messages: [{ role: "user", content: renderTranscript(transcript, scenario.currency) }],
      output_config: { format: zodOutputFormat(Decision), effort: "low" },
    });
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    if (response.stop_reason === "refusal") throw new Error(`${role} agent refused: ${response.stop_details?.category ?? "unknown"}`);
    if (!response.parsed_output) throw new Error(`${role} agent returned no valid decision (stop_reason ${response.stop_reason})`);
    return response.parsed_output;
  }
  return { decide, usage, model: MODEL };
}
