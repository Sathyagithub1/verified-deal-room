// Ported from Sourcio (github.com/Sathyagithub1/sourcio-near, agents/src/negotiation.mjs), made currency-agnostic.
import crypto from "node:crypto";
import { z } from "zod";

export const Decision = z.object({
  action: z.enum(["offer", "accept", "walk_away"]),
  unit_price: z.string().regex(/^\d+(\.\d{1,6})?$/, "decimal amount, max 6 places"),
  quantity: z.number().int().positive(),
  lead_time_days: z.number().int().positive(),
  message: z.string().max(400),
});

const other = (role) => (role === "buyer" ? "seller" : "buyer");

/**
 * Alternating negotiation. The seller answers the RFQ first. "accept" locks in the
 * other side's latest offer, so a party can never accept terms it wrote itself.
 * Hard-stops after maxCalls decisions, whatever the agents say.
 */
export async function negotiate({ decide, maxCalls }) {
  const transcript = [];
  let role = "seller";
  for (let calls = 1; calls <= maxCalls; calls++) {
    const decision = Decision.parse(await decide(role, transcript));
    transcript.push({ role, ...decision });
    if (decision.action === "walk_away") return { outcome: "no_deal", reason: `${role} walked away`, transcript, calls };
    if (decision.action === "accept") {
      const offer = lastOfferBy(transcript, other(role));
      if (!offer) return { outcome: "no_deal", reason: `${role} accepted before any offer`, transcript, calls };
      return { outcome: "deal", acceptedBy: role, terms: termsOf(offer), transcript, calls };
    }
    role = other(role);
  }
  return { outcome: "no_deal", reason: `stopped at the ${maxCalls}-call cap`, transcript, calls: maxCalls };
}

function lastOfferBy(transcript, role) {
  return [...transcript].reverse().find((t) => t.role === role && t.action === "offer");
}

function termsOf(offer) {
  return { unit_price: offer.unit_price, quantity: offer.quantity, lead_time_days: offer.lead_time_days };
}

/** Canonical JSON (sorted keys) hashed with sha256: identifies the agreed terms in the log and the payment route. */
export function termsHash(doc) {
  const canonical = JSON.stringify(doc, Object.keys(doc).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
