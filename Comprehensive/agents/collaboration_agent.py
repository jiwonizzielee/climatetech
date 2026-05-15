"""
Collaboration Agent — classifies every dispatch decision as routine or consequential.
Consequential decisions are surfaced to the operator; routine ones are applied silently.
"""

from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from simulation.engine import Decision, GridState
from simulation.battery import Battery
from config import (
    CONSEQUENTIAL_DISCHARGE_FRACTION,
    CONSEQUENTIAL_GRID_PRICE_THRESHOLD,
    CONSEQUENTIAL_CURTAIL_KWH,
)


class CollaborationAgent:
    def __init__(self, battery: Battery):
        self.battery = battery

    def classify(self, state: GridState, decision: Decision) -> Decision:
        """Mutates decision.classification in-place and returns it."""
        consequential = False
        reason = ""

        if decision.action == "discharge_battery":
            fraction_of_remaining = (
                decision.amount_kwh / self.battery.charge_level
                if self.battery.charge_level > 0 else 1.0
            )
            if fraction_of_remaining > CONSEQUENTIAL_DISCHARGE_FRACTION:
                consequential = True
                reason = (
                    f"discharging {decision.amount_kwh:.1f} kWh "
                    f"({fraction_of_remaining:.0%} of remaining battery)"
                )

        elif decision.action == "draw_from_grid":
            if state.price > CONSEQUENTIAL_GRID_PRICE_THRESHOLD:
                consequential = True
                reason = f"grid price is ${state.price:.3f}/kWh (above threshold)"

        elif decision.action == "curtail_surplus":
            if decision.amount_kwh > CONSEQUENTIAL_CURTAIL_KWH:
                consequential = True
                reason = f"curtailing {decision.amount_kwh:.1f} kWh of renewable energy"

        decision.classification = "consequential" if consequential else "routine"
        if consequential and not decision.reasoning:
            decision.reasoning = f"Flagged as consequential: {reason}"

        return decision
