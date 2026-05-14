"""
Profile functions for solar, wind, demand, and grid conditions.
Each function returns a kWh (or $/kWh / gCO₂/kWh) value for the given hour
adjusted by the active scenario multipliers.
"""

import math
import random

from config import SOLAR_CAPACITY_KW, WIND_CAPACITY_KW, SCENARIOS


def _scenario_factors(scenario: str) -> dict:
    return SCENARIOS.get(scenario, SCENARIOS["default"])


def solar_profile(hour: int, scenario: str = "default", seed: int | None = None) -> float:
    """Bell curve: 0 outside 6–18, peaks at noon. Scaled by capacity + weather noise."""
    if seed is not None:
        random.seed(seed + hour)
    if hour < 6 or hour > 18:
        return 0.0
    factors = _scenario_factors(scenario)
    peak = math.exp(-0.5 * ((hour - 12) / 3) ** 2)
    noise = 1.0 + random.uniform(-0.08, 0.08)
    return round(SOLAR_CAPACITY_KW * peak * noise * factors["solar_factor"], 2)


def wind_profile(hour: int, scenario: str = "default", seed: int | None = None) -> float:
    """Noisier than solar; higher overnight, lower midday."""
    if seed is not None:
        random.seed(seed + hour + 100)
    factors = _scenario_factors(scenario)
    # base: inverted partial cosine — high at 0/24, low at 12
    base = 0.5 + 0.5 * math.cos(math.pi * (hour - 12) / 12)
    noise = 1.0 + random.uniform(-0.15, 0.15)
    return round(WIND_CAPACITY_KW * base * noise * factors["wind_factor"], 2)


def demand_profile(hour: int, scenario: str = "default", seed: int | None = None) -> float:
    """Two-hump curve: morning peak 7–9, evening peak 18–20, lower overnight."""
    if seed is not None:
        random.seed(seed + hour + 200)
    factors = _scenario_factors(scenario)
    morning = math.exp(-0.5 * ((hour - 8) / 1.5) ** 2)
    evening = 1.2 * math.exp(-0.5 * ((hour - 19) / 1.5) ** 2)
    overnight = 0.25
    base_kw = 60.0  # community building + neighboring homes combined
    raw = base_kw * (overnight + morning + evening)
    noise = 1.0 + random.uniform(-0.05, 0.05)
    return round(raw * noise * factors["demand_factor"], 2)


def grid_conditions(hour: int, scenario: str = "default") -> tuple[float, float]:
    """
    Returns (price $/kWh, carbon_intensity gCO₂/kWh).
    Price is higher during morning and evening peaks.
    Carbon intensity follows a similar pattern (more fossil peakers online at peak).
    """
    factors = _scenario_factors(scenario)

    morning_peak = math.exp(-0.5 * ((hour - 8) / 2) ** 2)
    evening_peak = 1.3 * math.exp(-0.5 * ((hour - 18) / 2) ** 2)
    peak_combined = morning_peak + evening_peak

    base_price = 0.10
    price = round((base_price + 0.18 * peak_combined) * factors["price_factor"], 4)

    base_carbon = 180.0
    carbon = round(base_carbon + 140.0 * peak_combined, 1)

    return price, carbon
