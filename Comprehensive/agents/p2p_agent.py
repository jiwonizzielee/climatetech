"""
P2P Agent — discovers neighbor energy positions each hour, runs market clearing,
and returns the main microgrid's adjusted net position after local trades settle.

Neighbors are modeled with the same scenario profile functions as the main microgrid,
scaled by their individual generation/demand factors. They have no battery — their
residual after P2P trading goes to or from the main grid at retail price.
"""

from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from simulation.profiles import solar_profile, wind_profile, demand_profile
from simulation.p2p_market import PeerNode, MarketResult, P2PTrade, clear_market
from config import NEIGHBORS, P2P_DISCOUNT_FACTOR

MAIN_ID = "gridmind"


class P2PAgent:
    def __init__(self):
        self.trade_log: list[dict] = []

    def run(
        self,
        hour: int,
        scenario: str,
        main_net_kwh: float,
        grid_price: float,
        seed: int = 42,
    ) -> tuple[float, MarketResult]:
        """
        Discover all neighbor net positions, clear the local market.
        Returns (adjusted_main_net_kwh, market_result).
        adjusted_main_net_kwh is what the main microgrid's dispatch agent acts on.
        """
        peers: list[PeerNode] = [
            PeerNode(peer_id=MAIN_ID, name="GridMind Microgrid", net_kwh=main_net_kwh, grid_price=grid_price)
        ]

        for peer_id, cfg in NEIGHBORS.items():
            # Each neighbor runs the same scenario profiles scaled by their own factors
            solar  = solar_profile(hour, scenario, seed=seed) * cfg["solar_factor"]
            wind   = wind_profile(hour, scenario, seed=seed)  * cfg["wind_factor"]
            demand = demand_profile(hour, scenario, seed=seed) * cfg["demand_factor"]
            net    = round(solar + wind - demand, 2)
            peers.append(PeerNode(
                peer_id=peer_id,
                name=cfg["name"],
                net_kwh=net,
                grid_price=grid_price,
            ))

        result = clear_market(peers, P2P_DISCOUNT_FACTOR)
        adjusted_main_net = result.peer_net_after.get(MAIN_ID, main_net_kwh)

        # P2P cost for the main microgrid this hour:
        # If we bought from neighbors → we paid P2P price instead of grid price (savings)
        # If we sold to neighbors → we received P2P revenue
        main_bought = sum(t.amount_kwh for t in result.trades if t.buyer_id  == MAIN_ID)
        main_sold   = sum(t.amount_kwh for t in result.trades if t.seller_id == MAIN_ID)
        main_p2p_cost = sum(
            t.amount_kwh * t.price_per_kwh for t in result.trades if t.buyer_id == MAIN_ID
        )
        main_p2p_revenue = sum(
            t.amount_kwh * t.price_per_kwh for t in result.trades if t.seller_id == MAIN_ID
        )

        self.trade_log.append({
            "hour": hour,
            "main_net_before": round(main_net_kwh, 2),
            "main_net_after":  round(adjusted_main_net, 2),
            "main_bought_kwh": round(main_bought, 3),
            "main_sold_kwh":   round(main_sold, 3),
            "main_p2p_cost_usd":    round(main_p2p_cost, 4),
            "main_p2p_revenue_usd": round(main_p2p_revenue, 4),
            "community_savings_usd": result.community_savings_usd,
            "total_traded_kwh": result.total_traded_kwh,
            "trades": [
                {
                    "seller": t.seller_id,
                    "buyer":  t.buyer_id,
                    "amount_kwh": t.amount_kwh,
                    "price_per_kwh": t.price_per_kwh,
                }
                for t in result.trades
            ],
            "peer_nets": {
                p.peer_id: {
                    "name": next((cfg["name"] for pid, cfg in NEIGHBORS.items() if pid == p.peer_id), "GridMind"),
                    "net_before": p.net_kwh,
                    "net_after":  result.peer_net_after[p.peer_id],
                }
                for p in peers
            },
        })

        return adjusted_main_net, result
