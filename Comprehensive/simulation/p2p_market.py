"""
P2P Energy Market — clears bilateral trades between neighbor nodes each hour.

Each node publishes its net energy position (generation − demand).
Surplus nodes sell; deficit nodes buy. P2P price sits between the grid retail
price (what a buyer would otherwise pay) and zero (what a seller gets for curtailment).
The clearing algorithm is greedy: largest surplus matched to largest deficit first.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from config import P2P_MAX_TRADE_KWH


@dataclass
class PeerNode:
    peer_id: str
    name: str
    net_kwh: float       # positive = surplus (can sell), negative = deficit (wants to buy)
    grid_price: float    # $/kWh — used to set the P2P price and compute savings


@dataclass
class P2PTrade:
    seller_id: str
    buyer_id: str
    amount_kwh: float
    price_per_kwh: float


@dataclass
class MarketResult:
    trades: list[P2PTrade]
    peer_net_after: dict[str, float]  # residual net per node after all trades
    total_traded_kwh: float
    community_savings_usd: float      # buyers paid P2P instead of grid
    seller_revenue_usd: float         # sellers received instead of curtailing at $0


def clear_market(peers: list[PeerNode], p2p_discount: float) -> MarketResult:
    """
    Greedy bilateral matching — largest surplus to largest deficit first.
    P2P price = grid_price_of_seller × p2p_discount.
    """
    sellers = sorted([p for p in peers if p.net_kwh > 0.5], key=lambda p: -p.net_kwh)
    buyers  = sorted([p for p in peers if p.net_kwh < -0.5], key=lambda p: p.net_kwh)

    seller_avail: dict[str, float] = {p.peer_id: p.net_kwh for p in sellers}
    buyer_need:   dict[str, float] = {p.peer_id: abs(p.net_kwh) for p in buyers}
    peer_price:   dict[str, float] = {p.peer_id: p.grid_price for p in peers}

    trades: list[P2PTrade] = []
    community_savings = 0.0
    seller_revenue    = 0.0

    for seller in sellers:
        for buyer in buyers:
            avail = seller_avail.get(seller.peer_id, 0.0)
            need  = buyer_need.get(buyer.peer_id, 0.0)
            if avail < 0.1 or need < 0.1:
                continue
            amount    = round(min(avail, need, P2P_MAX_TRADE_KWH), 3)
            p2p_price = round(peer_price[seller.peer_id] * p2p_discount, 4)
            grid_ref  = peer_price[buyer.peer_id]

            trades.append(P2PTrade(
                seller_id=seller.peer_id,
                buyer_id=buyer.peer_id,
                amount_kwh=amount,
                price_per_kwh=p2p_price,
            ))
            seller_avail[seller.peer_id] -= amount
            buyer_need[buyer.peer_id]    -= amount
            community_savings += amount * (grid_ref - p2p_price)
            seller_revenue    += amount * p2p_price

    # Compute residual net per node
    peer_net_after: dict[str, float] = {}
    for p in peers:
        sold   = sum(t.amount_kwh for t in trades if t.seller_id == p.peer_id)
        bought = sum(t.amount_kwh for t in trades if t.buyer_id  == p.peer_id)
        peer_net_after[p.peer_id] = round(p.net_kwh - sold + bought, 3)

    return MarketResult(
        trades=trades,
        peer_net_after=peer_net_after,
        total_traded_kwh=round(sum(t.amount_kwh for t in trades), 3),
        community_savings_usd=round(community_savings, 4),
        seller_revenue_usd=round(seller_revenue, 4),
    )
