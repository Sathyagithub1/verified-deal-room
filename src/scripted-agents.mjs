// Ported from Sourcio. Replays a fixed negotiation so the demo runs without an Anthropic key; output is labelled SCRIPTED.
export function scriptedDecider(moves) {
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  async function decide(role) {
    const move = moves[usage.calls];
    if (!move) throw new Error("Scripted negotiation ran out of moves");
    if (move.role !== role) throw new Error(`Scripted move ${usage.calls} is for ${move.role}, not ${role}`);
    usage.calls += 1;
    const { role: _role, ...decision } = move;
    return decision;
  }
  return { decide, usage, model: "SCRIPTED fixture (no model calls)" };
}
