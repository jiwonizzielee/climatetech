"""
GridMind configuration — capacity constants, battery specs, scenario definitions, thresholds.
"""

# ── Battery ───────────────────────────────────────────────────────────────────
BATTERY_CAPACITY_KWH = 100.0
BATTERY_MAX_CHARGE_RATE_KWH = 25.0
BATTERY_MAX_DISCHARGE_RATE_KWH = 25.0
BATTERY_INITIAL_CHARGE_KWH = 40.0

# ── Generation capacity ───────────────────────────────────────────────────────
SOLAR_CAPACITY_KW = 80.0
WIND_CAPACITY_KW = 50.0

# ── Collaboration thresholds (consequential decision criteria) ─────────────────
CONSEQUENTIAL_DISCHARGE_FRACTION = 0.4   # discharging > 40% battery remaining → consequential
CONSEQUENTIAL_GRID_PRICE_THRESHOLD = 0.25  # grid price > $0.25/kWh → consequential
CONSEQUENTIAL_CURTAIL_KWH = 20.0          # curtailing > 20 kWh → consequential

# ── Scenarios ─────────────────────────────────────────────────────────────────
SCENARIOS = {
    "default": {
        "solar_factor": 1.0,
        "wind_factor": 1.0,
        "demand_factor": 1.0,
        "price_factor": 1.0,
        "description": "Typical clear day, normal demand",
    },
    "heat_wave": {
        "solar_factor": 0.85,
        "wind_factor": 1.0,
        "demand_factor": 1.5,
        "price_factor": 1.4,
        "description": "High demand, panel efficiency reduced, grid price spikes",
    },
    "cloudy_calm": {
        "solar_factor": 0.3,
        "wind_factor": 0.4,
        "demand_factor": 1.0,
        "price_factor": 1.0,
        "description": "Low generation — battery and grid connection critical",
    },
    "windy_night": {
        "solar_factor": 1.0,
        "wind_factor": 2.0,
        "demand_factor": 1.0,
        "price_factor": 1.0,
        "description": "Strong overnight wind — store cheap clean energy ahead of demand",
    },
}

# ── P2P energy trading ────────────────────────────────────────────────────────
# Buyers pay grid_price × P2P_DISCOUNT_FACTOR — cheaper than retail, better than curtailment.
P2P_DISCOUNT_FACTOR = 0.80
P2P_MAX_TRADE_KWH = 40.0  # cap per bilateral trade to avoid one node draining another

NEIGHBORS = {
    "casa_solar": {
        "name": "Casa Solar",
        "solar_factor": 1.6,   # large rooftop array
        "wind_factor": 0.2,
        "demand_factor": 0.5,
        "description": "Single-family home, large rooftop solar, low demand",
    },
    "ev_household": {
        "name": "EV Household",
        "solar_factor": 0.2,   # small south-facing panels only
        "wind_factor": 0.0,
        "demand_factor": 1.8,  # EV charging spikes evening demand
        "description": "Heavy EV charger, high evening demand, minimal generation",
    },
    "wind_cottage": {
        "name": "Wind Cottage",
        "solar_factor": 0.1,
        "wind_factor": 2.8,   # micro-wind turbine
        "demand_factor": 0.3,  # retired couple, very low load
        "description": "Micro-wind turbine, retired couple, nearly self-sufficient",
    },
    "community_hub": {
        "name": "Community Hub",
        "solar_factor": 0.7,
        "wind_factor": 0.0,
        "demand_factor": 2.2,  # large daytime load
        "description": "Community center — high daytime demand, shared solar panels",
    },
}

# ── LLM temperatures ──────────────────────────────────────────────────────────
DISPATCH_TEMPERATURE = 0.2
FORECAST_TEMPERATURE = 0.3
REASONING_TEMPERATURE = 0.6

# ── Forecast horizon (hours ahead) ───────────────────────────────────────────
FORECAST_HORIZON_HOURS = 4
