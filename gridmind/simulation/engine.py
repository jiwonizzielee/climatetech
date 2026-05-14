"""
24-hour simulation loop — produces HourRecords + CycleSummary.
"""

from __future__ import annotations

import copy
import sys
import os
from dataclasses import dataclass, field, asdict
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import BATTERY_INITIAL_CHARGE_KWH
from simulation.battery import Battery
from simulation.profiles import solar_profile, wind_profile, demand_profile, grid_conditions


@dataclass
class GridState:
    hour: int
    solar: float
    wind: float
    demand: float
    price: float
    carbon: float
    battery: dict  # snapshot
    # Filled after dispatch by the P2P layer; used by _compute_outcome for financial accounting only.
    p2p_sold_kwh: float = 0.0      # kWh sold to neighbors (reduces curtailment)
    p2p_bought_kwh: float = 0.0    # kWh bought from neighbors (reduces grid draw)
    p2p_cost_usd: float = 0.0      # what the main node paid for P2P purchases
    p2p_revenue_usd: float = 0.0   # what the main node earned from P2P sales


@dataclass
class Decision:
    action: str          # charge_battery | discharge_battery | draw_from_grid | curtail_surplus
    amount_kwh: float
    reasoning: str = ""  # filled by ReasoningAgent when enabled
    question: str = ""   # filled by ReasoningAgent for consequential decisions
    classification: str = "routine"   # routine | consequential


@dataclass
class Outcome:
    grid_draw_kwh: float = 0.0
    battery_charged_kwh: float = 0.0
    battery_discharged_kwh: float = 0.0
    curtailed_kwh: float = 0.0
    p2p_sold_kwh: float = 0.0
    p2p_bought_kwh: float = 0.0
    renewable_used_kwh: float = 0.0
    grid_cost_usd: float = 0.0
    p2p_cost_usd: float = 0.0
    p2p_revenue_usd: float = 0.0
    total_cost_usd: float = 0.0   # grid_cost + p2p_cost - p2p_revenue
    carbon_g: float = 0.0
    battery_after: dict = field(default_factory=dict)


@dataclass
class HourRecord:
    hour: int
    state: dict
    decision: dict
    outcome: dict


def _compute_outcome(state: GridState, decision: Decision, battery: Battery) -> Outcome:
    solar, wind, demand, price, carbon = (
        state.solar, state.wind, state.demand, state.price, state.carbon
    )
    net = (solar + wind) - demand
    outcome = Outcome(
        p2p_sold_kwh=state.p2p_sold_kwh,
        p2p_bought_kwh=state.p2p_bought_kwh,
        p2p_cost_usd=state.p2p_cost_usd,
        p2p_revenue_usd=state.p2p_revenue_usd,
    )

    if decision.action == "charge_battery":
        charged = battery.charge(decision.amount_kwh)
        outcome.battery_charged_kwh = charged
        surplus_after_charge = max(0.0, net - charged)
        # Any remaining surplus after charging: dispatch has already sold/curtailed via P2P
        outcome.curtailed_kwh = round(max(0.0, surplus_after_charge - state.p2p_sold_kwh), 3)
        outcome.renewable_used_kwh = round(solar + wind - outcome.curtailed_kwh, 3)

    elif decision.action == "curtail_surplus":
        # P2P may have sold part of the original surplus; decision.amount_kwh is already the residual
        outcome.curtailed_kwh = round(max(0.0, decision.amount_kwh), 3)
        outcome.renewable_used_kwh = round((solar + wind) - outcome.curtailed_kwh, 3)

    elif decision.action == "discharge_battery":
        discharged = battery.discharge(decision.amount_kwh)
        outcome.battery_discharged_kwh = discharged
        remaining_shortfall = max(0.0, abs(net) - discharged - state.p2p_bought_kwh)
        if remaining_shortfall > 0:
            outcome.grid_draw_kwh = round(remaining_shortfall, 3)
            outcome.grid_cost_usd = round(remaining_shortfall * price, 4)
            outcome.carbon_g = round(remaining_shortfall * carbon, 1)
        outcome.renewable_used_kwh = round(solar + wind, 3)

    elif decision.action == "draw_from_grid":
        # decision.amount_kwh is already the residual after P2P buying
        outcome.grid_draw_kwh = round(decision.amount_kwh, 3)
        outcome.grid_cost_usd = round(decision.amount_kwh * price, 4)
        outcome.carbon_g = round(decision.amount_kwh * carbon, 1)
        outcome.renewable_used_kwh = round(solar + wind, 3)

    outcome.battery_after = battery.snapshot()
    outcome.total_cost_usd = round(
        outcome.grid_cost_usd + outcome.p2p_cost_usd - outcome.p2p_revenue_usd, 4
    )
    return outcome


def run_simulation(
    scenario: str,
    agent_factory,           # callable(battery) → agent with .decide(state) method
    seed: int = 42,
    verbose: bool = False,
) -> tuple[list[HourRecord], dict, object]:  # records, summary, agent
    battery = Battery(initial_charge=BATTERY_INITIAL_CHARGE_KWH)
    agent = agent_factory(battery)
    records: list[HourRecord] = []

    total_cost = 0.0
    total_carbon = 0.0
    total_renewable = 0.0
    total_curtailed = 0.0

    for hour in range(24):
        solar = solar_profile(hour, scenario, seed=seed)
        wind = wind_profile(hour, scenario, seed=seed)
        demand = demand_profile(hour, scenario, seed=seed)
        price, carbon = grid_conditions(hour, scenario)

        state = GridState(
            hour=hour,
            solar=solar,
            wind=wind,
            demand=demand,
            price=price,
            carbon=carbon,
            battery=battery.snapshot(),
        )

        decision = agent.decide(state)
        outcome = _compute_outcome(state, decision, battery)

        total_cost += outcome.total_cost_usd
        total_carbon += outcome.carbon_g
        total_renewable += outcome.renewable_used_kwh
        total_curtailed += outcome.curtailed_kwh

        if verbose:
            print(f"  H{hour:02d} | {decision.action:<20} {decision.amount_kwh:6.1f} kWh | "
                  f"cost=${outcome.cost_usd:.3f} carbon={outcome.carbon_g:.0f}g")

        records.append(HourRecord(
            hour=hour,
            state=asdict(state),
            decision={
                "action": decision.action,
                "amount_kwh": decision.amount_kwh,
                "classification": decision.classification,
                "reasoning": decision.reasoning,
                "question": decision.question,
            },
            outcome=asdict(outcome),
        ))

    summary = {
        "total_cost": round(total_cost, 2),
        "total_carbon": round(total_carbon, 1),
        "renewable_used": round(total_renewable, 1),
        "curtailed": round(total_curtailed, 1),
    }
    return records, summary, agent
