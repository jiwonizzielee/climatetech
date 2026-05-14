#!/usr/bin/env python3
"""
GridMind CLI — energy dispatch simulation with collaborative AI agents.

Usage:
  python main.py --scenario default
  python main.py --scenario heat_wave --reasoning
  python main.py --scenario windy_night --compare
  python main.py --scenario cloudy_calm --forecast
  python main.py --scenario default --p2p
  python main.py --scenario default --verbose
"""

import argparse
import json
import os
import sys
from dataclasses import asdict

sys.path.insert(0, os.path.dirname(__file__))

from config import SCENARIOS
from simulation.battery import Battery
from simulation.engine import run_simulation, Decision, GridState
from agents.dispatch_agent import DispatchAgent
from agents.collaboration_agent import CollaborationAgent
from agents.baseline_agent import BaselineAgent

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


# ── Agent wrapper that layers collaboration + optional reasoning + forecast ────

class CollaborativeDispatchAgent:
    def __init__(
        self,
        battery: Battery,
        scenario: str,
        reasoning: bool = False,
        forecast: bool = False,
        p2p: bool = False,
        verbose: bool = False,
        seed: int = 42,
    ):
        self.battery = battery
        self.scenario = scenario
        self.reasoning_enabled = reasoning
        self.forecast_enabled = forecast
        self.p2p_enabled = p2p
        self.verbose = verbose
        self.seed = seed

        self._dispatch = DispatchAgent(battery)
        self._collab = CollaborationAgent(battery)

        self.decision_log: list[dict] = []
        self.collaboration_log: list[dict] = []
        self.forecast_log: list[dict] = []

        if p2p:
            from agents.p2p_agent import P2PAgent
            self._p2p = P2PAgent()
        else:
            self._p2p = None

    def decide(self, state: GridState) -> Decision:
        forecast_summary = ""

        if self.forecast_enabled:
            from agents.forecast_agent import forecast as run_forecast
            fcast = run_forecast(
                current_hour=state.hour,
                scenario=self.scenario,
                battery=self.battery,
                seed=self.seed,
                verbose=self.verbose,
            )
            forecast_summary = fcast.get("summary", "")
            self.forecast_log.append({"hour": state.hour, **fcast})

        decision = self._dispatch.decide(state)

        # ── P2P: post-dispatch, runs only on curtailment or grid-draw residuals ──
        # Battery charging/discharging decisions are unaffected — P2P only
        # optimises what would otherwise be wasted (curtailed) or expensive (grid draw).
        if self._p2p is not None and decision.action in ("curtail_surplus", "draw_from_grid"):
            from simulation.engine import GridState as GS
            is_surplus = decision.action == "curtail_surplus"
            p2p_kwh = +decision.amount_kwh if is_surplus else -decision.amount_kwh
            adjusted_net, p2p_result = self._p2p.run(
                hour=state.hour,
                scenario=self.scenario,
                main_net_kwh=p2p_kwh,
                grid_price=state.price,
                seed=self.seed,
            )
            p2p_sold   = round(max(0.0, p2p_kwh - adjusted_net), 3) if is_surplus else 0.0
            p2p_bought = round(max(0.0, adjusted_net - p2p_kwh), 3) if not is_surplus else 0.0
            main_p2p_cost    = sum(t.amount_kwh * t.price_per_kwh for t in p2p_result.trades if t.buyer_id  == "gridmind")
            main_p2p_revenue = sum(t.amount_kwh * t.price_per_kwh for t in p2p_result.trades if t.seller_id == "gridmind")

            # Patch state with P2P accounting so _compute_outcome picks it up
            state.p2p_sold_kwh    = p2p_sold
            state.p2p_bought_kwh  = p2p_bought
            state.p2p_cost_usd    = round(main_p2p_cost, 4)
            state.p2p_revenue_usd = round(main_p2p_revenue, 4)

            # Adjust the decision: only curtail/draw what P2P didn't handle
            residual = round(max(0.0, abs(p2p_kwh) - p2p_sold - p2p_bought), 2)
            decision.amount_kwh = residual

            if self.verbose:
                traded = p2p_result.total_traded_kwh
                label  = f"sold {p2p_sold:.1f}" if is_surplus else f"bought {p2p_bought:.1f}"
                print(f"  [P2P H{state.hour:02d}] {label} kWh via P2P | "
                      f"{traded:.1f} kWh community-wide | residual {residual:.1f} kWh to {'curtail' if is_surplus else 'grid'}")

        decision = self._collab.classify(state, decision)

        if self.reasoning_enabled:
            from agents.reasoning_agent import explain
            decision = explain(state, decision, forecast_summary=forecast_summary, verbose=self.verbose)

        entry = {
            "hour": state.hour,
            "action": decision.action,
            "amount_kwh": decision.amount_kwh,
            "classification": decision.classification,
            "reasoning": decision.reasoning,
        }
        self.decision_log.append(entry)

        if decision.classification == "consequential":
            self.collaboration_log.append({
                **entry,
                "question": decision.question,
                "operator_response": "approved",  # auto-approve in simulation mode
            })

        return decision


def _write_json(path: str, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Wrote {os.path.relpath(path)}")


def main():
    parser = argparse.ArgumentParser(description="GridMind energy simulation")
    parser.add_argument("--scenario", default="default", choices=list(SCENARIOS.keys()))
    parser.add_argument("--reasoning", action="store_true", help="Enable Reasoning Agent (requires ANTHROPIC_API_KEY)")
    parser.add_argument("--forecast", action="store_true", help="Enable Forecast Agent (requires ANTHROPIC_API_KEY)")
    parser.add_argument("--compare", action="store_true", help="Run Baseline Agent for comparison")
    parser.add_argument("--p2p", action="store_true", help="Enable P2P neighbor energy trading")
    parser.add_argument("--verbose", action="store_true", help="Log full API transcripts and step details")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for profile noise")
    args = parser.parse_args()

    print(f"\nGridMind  |  Scenario: {args.scenario}  |  {SCENARIOS[args.scenario]['description']}")
    print("─" * 60)

    # ── Agent run ─────────────────────────────────────────────────────────────
    def agent_factory(battery: Battery):
        return CollaborativeDispatchAgent(
            battery=battery,
            scenario=args.scenario,
            reasoning=args.reasoning,
            forecast=args.forecast,
            p2p=args.p2p,
            verbose=args.verbose,
            seed=args.seed,
        )

    print("\nRunning collaborative agent simulation…")
    records, agent_summary, _agent_instance = run_simulation(
        scenario=args.scenario,
        agent_factory=agent_factory,
        seed=args.seed,
        verbose=args.verbose,
    )

    # ── Baseline run ──────────────────────────────────────────────────────────
    baseline_summary = None
    baseline_records = None
    if args.compare:
        print("Running baseline agent simulation…")
        baseline_records, baseline_summary, _ = run_simulation(
            scenario=args.scenario,
            agent_factory=lambda b: BaselineAgent(b),
            seed=args.seed,
            verbose=False,
        )

    # ── Build full result ──────────────────────────────────────────────────────
    cycle_summary: dict = {
        "agent": agent_summary,
    }
    if baseline_summary:
        cycle_summary["baseline"] = baseline_summary
        cost_saved = agent_summary["total_cost"]
        baseline_cost = baseline_summary["total_cost"]
        carbon_saved = agent_summary["total_carbon"]
        baseline_carbon = baseline_summary["total_carbon"]
        cycle_summary["cost_saved_pct"] = round(
            (baseline_cost - cost_saved) / baseline_cost * 100, 1
        ) if baseline_cost else 0.0
        cycle_summary["carbon_saved_pct"] = round(
            (baseline_carbon - carbon_saved) / baseline_carbon * 100, 1
        ) if baseline_carbon else 0.0

    results = {
        "scenario": args.scenario,
        "scenario_description": SCENARIOS[args.scenario]["description"],
        "cycle_summary": cycle_summary,
        "hours": [
            {"hour": r.hour, "state": r.state, "decision": r.decision, "outcome": r.outcome}
            for r in records
        ],
    }

    # ── Print headline ────────────────────────────────────────────────────────
    print("\n── Cycle Summary ──────────────────────────────────────────────")
    print(f"  Cost:    ${agent_summary['total_cost']:.2f}     Carbon: {agent_summary['total_carbon']:.0f} g")
    print(f"  Renewable used: {agent_summary['renewable_used']:.1f} kWh   Curtailed: {agent_summary['curtailed']:.1f} kWh")
    if args.p2p and hasattr(_agent_instance, '_p2p') and _agent_instance._p2p:
        p2p_log = _agent_instance._p2p.trade_log
        total_traded = sum(h["total_traded_kwh"] for h in p2p_log)
        total_savings = sum(h["community_savings_usd"] for h in p2p_log)
        print(f"  P2P traded:  {total_traded:.1f} kWh   Community savings: ${total_savings:.2f}")
    if baseline_summary:
        print(f"\n  Baseline cost:   ${baseline_summary['total_cost']:.2f}    Baseline carbon: {baseline_summary['total_carbon']:.0f} g")
        print(f"  Cost saved:  {cycle_summary['cost_saved_pct']:.1f}%   Carbon saved: {cycle_summary['carbon_saved_pct']:.1f}%")
    print("─" * 60)

    # ── Write output files ─────────────────────────────────────────────────────
    print("\nWriting output files…")
    out = OUTPUT_DIR

    _write_json(f"{out}/results.json", results)
    _write_json(f"{out}/cycle_summary.json", {"scenario": args.scenario, **cycle_summary})

    # Gather logs from the agent instance (reached via closure hack — rebuild from records)
    # The agent instance is inside run_simulation; we reconstruct logs from records directly.
    decision_log = [
        {
            "hour": r.hour,
            "action": r.decision["action"],
            "amount_kwh": r.decision["amount_kwh"],
            "classification": r.decision["classification"],
            "reasoning": r.decision["reasoning"],
        }
        for r in records
    ]
    _write_json(f"{out}/decision_log.json", decision_log)

    collab_log = [d for d in decision_log if d["classification"] == "consequential"]
    # Add question field from records
    for entry in collab_log:
        h = entry["hour"]
        matching = next((r for r in records if r.hour == h), None)
        if matching:
            entry["question"] = matching.decision.get("question", "")
            entry["operator_response"] = "approved"
    _write_json(f"{out}/collaboration_log.json", collab_log)

    if args.p2p and hasattr(_agent_instance, '_p2p') and _agent_instance._p2p:
        _write_json(f"{out}/p2p_log.json", _agent_instance._p2p.trade_log)

    if baseline_records and baseline_summary:
        _write_json(f"{out}/baseline_comparison.json", {
            "scenario": args.scenario,
            "agent": {
                "summary": agent_summary,
                "hours": [{"hour": r.hour, "decision": r.decision, "outcome": r.outcome} for r in records],
            },
            "baseline": {
                "summary": baseline_summary,
                "hours": [{"hour": r.hour, "decision": r.decision, "outcome": r.outcome} for r in baseline_records],
            },
        })

    print("\nDone. Start the dashboard with:\n  cd dashboard && npm install && npm run dev\n")


if __name__ == "__main__":
    main()
