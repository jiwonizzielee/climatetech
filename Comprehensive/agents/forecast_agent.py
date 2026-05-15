"""
Forecast Agent — projects the next N hours and identifies upcoming stress points.
Runs ahead of the dispatch decision so the Reasoning Agent can frame questions with context.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from simulation.profiles import solar_profile, wind_profile, demand_profile, grid_conditions
from simulation.battery import Battery
from config import FORECAST_HORIZON_HOURS, FORECAST_TEMPERATURE

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


def _raw_horizon(hour: int, scenario: str, seed: int = 42) -> list[dict]:
    hours = []
    for h in range(hour + 1, min(hour + 1 + FORECAST_HORIZON_HOURS, 24)):
        solar = solar_profile(h, scenario, seed=seed)
        wind = wind_profile(h, scenario, seed=seed)
        demand = demand_profile(h, scenario, seed=seed)
        price, carbon = grid_conditions(h, scenario)
        net = round((solar + wind) - demand, 2)
        hours.append({
            "hour": h,
            "solar": solar,
            "wind": wind,
            "demand": demand,
            "net_kwh": net,
            "grid_price": price,
            "grid_carbon": carbon,
        })
    return hours


_SYSTEM = """You are the forecast layer of GridMind, a microgrid energy platform.
Given the next few hours of projected generation, demand, and grid conditions,
identify upcoming stress points and summarize them in 2-3 plain sentences.
Stress points include: coming demand spikes, price spikes, renewable lulls, and opportunities to store cheap clean energy.
Return ONLY valid JSON with keys:
  "summary": string (2-3 sentences, operator-facing),
  "stress_points": list of {"hour": int, "type": string, "description": string}
"""


def forecast(
    current_hour: int,
    scenario: str,
    battery: Battery,
    seed: int = 42,
    verbose: bool = False,
) -> dict:
    """Returns {"summary": str, "stress_points": [...], "horizon": [...]}"""
    horizon = _raw_horizon(current_hour, scenario, seed)
    if not horizon:
        return {"summary": "", "stress_points": [], "horizon": []}

    prompt_data = {
        "current_hour": current_hour,
        "battery_charge_kwh": battery.charge_level,
        "battery_soc": round(battery.state_of_charge, 3),
        "horizon_hours": horizon,
    }

    try:
        client = _get_client()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            temperature=FORECAST_TEMPERATURE,
            system=_SYSTEM,
            messages=[{"role": "user", "content": json.dumps(prompt_data, indent=2)}],
        )
        raw = response.content[0].text.strip()
        if verbose:
            print(f"\n    [ForecastAgent H{current_hour:02d}] {raw}")
        data = json.loads(raw)
        data["horizon"] = horizon
        return data
    except Exception as exc:
        return {
            "summary": f"[ForecastAgent unavailable: {exc}]",
            "stress_points": [],
            "horizon": horizon,
        }
