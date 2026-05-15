"""
Baseline Agent — deliberately naive: always draws from grid for shortfall,
never uses the battery strategically. Used only for comparison.
"""

from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from simulation.engine import Decision, GridState
from simulation.battery import Battery


class BaselineAgent:
    """Always draws from grid. Never charges or discharges the battery."""

    def __init__(self, battery: Battery):
        self.battery = battery  # held but never used strategically

    def decide(self, state: GridState) -> Decision:
        net = (state.solar + state.wind) - state.demand
        if net >= 0:
            # Curtail any surplus — no battery storage attempt
            return Decision(
                action="curtail_surplus",
                amount_kwh=round(net, 2),
                classification="routine",
                reasoning="Baseline: surplus curtailed (no battery strategy).",
            )
        return Decision(
            action="draw_from_grid",
            amount_kwh=round(abs(net), 2),
            classification="routine",
            reasoning="Baseline: shortfall covered by grid draw.",
        )
