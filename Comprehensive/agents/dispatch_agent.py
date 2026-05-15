"""
Dispatch Agent — rule-based, deterministic decision logic.
Priority: use renewables first, store surplus, discharge before drawing from grid.
"""

from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from simulation.engine import Decision, GridState
from simulation.battery import Battery
from config import BATTERY_MAX_CHARGE_RATE_KWH, BATTERY_MAX_DISCHARGE_RATE_KWH


class DispatchAgent:
    def __init__(self, battery: Battery):
        self.battery = battery

    def decide(self, state: GridState) -> Decision:
        solar, wind, demand = state.solar, state.wind, state.demand
        price, carbon = state.price, state.carbon
        net = (solar + wind) - demand

        if net > 0:
            # Surplus renewable energy available
            if not self.battery.is_full:
                charge_amt = min(net, BATTERY_MAX_CHARGE_RATE_KWH, self.battery.available_charge_room)
                return Decision(action="charge_battery", amount_kwh=round(charge_amt, 2))
            else:
                return Decision(action="curtail_surplus", amount_kwh=round(net, 2))

        if net < 0:
            shortfall = abs(net)
            # Prefer discharging battery when grid is expensive or carbon-intensive
            if not self.battery.is_empty and (price > 0.18 or carbon > 280):
                discharge_amt = min(shortfall, BATTERY_MAX_DISCHARGE_RATE_KWH, self.battery.charge_level)
                return Decision(action="discharge_battery", amount_kwh=round(discharge_amt, 2))
            else:
                return Decision(action="draw_from_grid", amount_kwh=round(shortfall, 2))

        # net == 0: perfectly balanced, draw nothing
        return Decision(action="draw_from_grid", amount_kwh=0.0)
