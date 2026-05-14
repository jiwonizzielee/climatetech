"""
Reasoning Agent — wraps the dispatch decision in a Claude API call to produce
plain-language operator communications.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from simulation.engine import Decision, GridState
from config import REASONING_TEMPERATURE

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


_SYSTEM = """You are the reasoning layer of GridMind, a collaborative microgrid energy platform.
Your job is to produce a short, plain-language communication for the human operator about an energy dispatch decision.

Rules:
- For ROUTINE decisions: write 1–2 sentences explaining what the agent is doing and why. Be factual and direct.
- For CONSEQUENTIAL decisions: write a clear approve/reject question that frames the tradeoff. Include why this matters. Max 3 sentences.
- Never override or contradict the decision — you are explaining, not deciding.
- Use simple energy language — avoid jargon. kWh and $/kWh are fine.
- Return ONLY valid JSON with keys "reasoning" (string) and "question" (string, empty if routine).
"""


def _build_prompt(state: GridState, decision: Decision, forecast_summary: str = "") -> str:
    state_dict = {
        "hour": state.hour,
        "solar_kw": state.solar,
        "wind_kw": state.wind,
        "demand_kw": state.demand,
        "grid_price_per_kwh": state.price,
        "grid_carbon_gco2_per_kwh": state.carbon,
        "battery_charge_kwh": state.battery["charge_level"],
        "battery_state_of_charge": state.battery["state_of_charge"],
    }
    lines = [
        f"Current microgrid state (hour {state.hour:02d}:00):",
        json.dumps(state_dict, indent=2),
        "",
        f"Dispatch decision: {decision.action}, amount: {decision.amount_kwh:.1f} kWh",
        f"Classification: {decision.classification}",
    ]
    if forecast_summary:
        lines += ["", "Short-horizon forecast:", forecast_summary]
    lines += [
        "",
        "Write the operator communication for this decision.",
    ]
    return "\n".join(lines)


def explain(
    state: GridState,
    decision: Decision,
    forecast_summary: str = "",
    verbose: bool = False,
) -> Decision:
    """Mutates decision.reasoning and decision.question; returns the decision."""
    try:
        client = _get_client()
        prompt = _build_prompt(state, decision, forecast_summary)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            temperature=REASONING_TEMPERATURE,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if verbose:
            print(f"\n    [ReasoningAgent H{state.hour:02d}] {raw}")
        data = json.loads(raw)
        decision.reasoning = data.get("reasoning", "")
        decision.question = data.get("question", "")
    except Exception as exc:
        decision.reasoning = f"[ReasoningAgent unavailable: {exc}]"
        decision.question = ""
    return decision
