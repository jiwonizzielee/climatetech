"""
Grid-Neighbor AI — Neighborhood Energy Dashboard
Frontend UI for the Grid-Neighbor hackathon demo.
Connects to the team's simulation engine and Gemini agent backend.

Usage:
    pip install streamlit plotly pandas numpy
    streamlit run dashboard.py
"""

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
import time
import json
from datetime import datetime, timedelta

# ─────────────────────────────────────────────
#  PAGE CONFIG  (must be first Streamlit call)
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="Grid-Neighbor AI",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────
#  GLOBAL CSS — Dark industrial / mission-control
# ─────────────────────────────────────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

    /* ── root tokens ── */
    :root {
        --bg-0:     #0a0f1a;
        --bg-1:     #111827;
        --bg-2:     #1a2235;
        --border:   #1e3a5f;
        --teal:     #00d4b8;
        --teal-dim: #00a896;
        --amber:    #f59e0b;
        --red:      #ef4444;
        --green:    #22c55e;
        --text-1:   #e2e8f0;
        --text-2:   #94a3b8;
        --text-3:   #475569;
        --mono:     'Space Mono', monospace;
        --sans:     'DM Sans', sans-serif;
    }

    /* ── base overrides ── */
    html, body, [class*="css"] {
        background-color: var(--bg-0) !important;
        color: var(--text-1) !important;
        font-family: var(--sans) !important;
    }
    .main > .block-container { padding: 1.5rem 2rem 3rem; max-width: 1600px; }

    /* ── header ── */
    .gn-header {
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid var(--border);
        padding-bottom: 1rem; margin-bottom: 1.5rem;
    }
    .gn-logo {
        font-family: var(--mono); font-size: 1.4rem; font-weight: 700;
        color: var(--teal); letter-spacing: -0.03em;
    }
    .gn-logo span { color: var(--text-2); font-weight: 400; }
    .gn-tagline { font-size: 0.72rem; color: var(--text-3); font-family: var(--mono); margin-top: 3px; }
    .gn-status-pill {
        display: inline-flex; align-items: center; gap: 6px;
        background: #0d2318; border: 1px solid #1a5c38;
        border-radius: 20px; padding: 5px 14px;
        font-family: var(--mono); font-size: 0.72rem; color: var(--green);
    }
    .gn-status-dot {
        width: 7px; height: 7px; background: var(--green);
        border-radius: 50%; animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    /* ── stat cards ── */
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 1.5rem; }
    .stat-card {
        background: var(--bg-1); border: 1px solid var(--border);
        border-radius: 10px; padding: 16px 18px;
        position: relative; overflow: hidden;
    }
    .stat-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0;
        height: 2px; background: var(--teal); opacity: 0.6;
    }
    .stat-card.amber::before { background: var(--amber); }
    .stat-card.green::before { background: var(--green); }
    .stat-card.red::before   { background: var(--red);   }
    .stat-label { font-size: 0.68rem; font-family: var(--mono); color: var(--text-3); text-transform: uppercase; letter-spacing: 0.1em; }
    .stat-value { font-size: 2rem; font-family: var(--mono); font-weight: 700; color: var(--text-1); line-height: 1.1; margin: 6px 0 4px; }
    .stat-value.teal  { color: var(--teal);  }
    .stat-value.amber { color: var(--amber); }
    .stat-value.green { color: var(--green); }
    .stat-value.red   { color: var(--red);   }
    .stat-delta { font-size: 0.72rem; color: var(--text-2); }

    /* ── section labels ── */
    .section-label {
        font-family: var(--mono); font-size: 0.68rem; color: var(--text-3);
        text-transform: uppercase; letter-spacing: 0.12em;
        border-left: 2px solid var(--teal); padding-left: 8px;
        margin-bottom: 10px;
    }

    /* ── agent feed ── */
    .agent-feed {
        background: var(--bg-1); border: 1px solid var(--border);
        border-radius: 10px; padding: 14px 16px;
        font-family: var(--mono); font-size: 0.75rem;
        min-height: 220px; max-height: 280px;
        overflow-y: auto; line-height: 1.7;
    }
    .feed-line { display: flex; gap: 10px; align-items: flex-start; }
    .feed-time { color: var(--text-3); flex-shrink: 0; }
    .feed-action { color: var(--teal); }
    .feed-action.warn  { color: var(--amber); }
    .feed-action.alert { color: var(--red);   }
    .feed-action.save  { color: var(--green); }
    .feed-msg { color: var(--text-2); }

    /* ── neighbor nodes ── */
    .node-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .node-card {
        background: var(--bg-1); border: 1px solid var(--border);
        border-radius: 8px; padding: 12px 14px;
    }
    .node-name { font-family: var(--mono); font-size: 0.75rem; color: var(--teal); margin-bottom: 6px; }
    .node-bar-bg { background: var(--bg-2); border-radius: 3px; height: 5px; overflow: hidden; margin: 4px 0; }
    .node-bar-fill { height: 5px; border-radius: 3px; background: var(--teal); transition: width 0.6s; }
    .node-bar-fill.export { background: var(--green); }
    .node-bar-fill.import { background: var(--amber); }
    .node-kv { display:flex; justify-content:space-between; font-size:0.68rem; color: var(--text-3); font-family: var(--mono); }

    /* ── scenario buttons ── */
    .stButton > button {
        background: var(--bg-2) !important;
        border: 1px solid var(--border) !important;
        color: var(--text-1) !important;
        font-family: var(--mono) !important;
        font-size: 0.75rem !important;
        border-radius: 6px !important;
        padding: 8px 16px !important;
        transition: all 0.2s !important;
    }
    .stButton > button:hover {
        border-color: var(--teal) !important;
        color: var(--teal) !important;
        background: #0a1f2e !important;
    }
    .stButton > button.crisis {
        border-color: var(--red) !important;
        color: var(--red) !important;
    }

    /* ── sidebar ── */
    [data-testid="stSidebar"] {
        background: var(--bg-1) !important;
        border-right: 1px solid var(--border) !important;
    }
    [data-testid="stSidebar"] * { color: var(--text-1) !important; font-family: var(--sans) !important; }

    /* ── misc ── */
    .savings-banner {
        background: linear-gradient(135deg, #0d2318 0%, #0a1f2e 100%);
        border: 1px solid #1a5c38; border-radius: 10px;
        padding: 18px 22px; text-align: center;
    }
    .savings-number { font-family: var(--mono); font-size: 2.8rem; font-weight: 700; color: var(--green); }
    .savings-label  { font-family: var(--mono); font-size: 0.72rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.1em; }

    /* hide streamlit chrome */
    #MainMenu, footer, header { visibility: hidden; }
    [data-testid="stDecoration"] { display: none; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ─────────────────────────────────────────────
#  SIMULATION DATA  (replace with real engine)
# ─────────────────────────────────────────────

HOURS = list(range(24))
HOUR_LABELS = [f"{h:02d}:00" for h in HOURS]

def make_solar(noise=0.0):
    """Sine-arch solar generation peaking at noon."""
    base = np.array([max(0, np.sin(np.pi * (h - 6) / 12)) * 8.5 for h in HOURS])
    return np.clip(base + np.random.normal(0, noise, 24), 0, None)

def make_load():
    """Double-hump load: morning commute + evening peak."""
    base = np.array([
        1.8 + 2.0 * np.exp(-((h - 7.5) ** 2) / 2)
        + 3.0 * np.exp(-((h - 18.5) ** 2) / 2)
        + 0.5 * np.random.rand()
        for h in HOURS
    ])
    return np.clip(base, 0.5, None)

def make_grid_price():
    """TOU-style pricing: cheap overnight, expensive peak."""
    base = np.array([
        0.08 + 0.12 * np.exp(-((h - 8) ** 2) / 4)
        + 0.22 * np.exp(-((h - 18) ** 2) / 3)
        for h in HOURS
    ])
    return np.clip(base + np.random.normal(0, 0.005, 24), 0.05, 0.45)

def simulate_battery(solar, load, price, capacity_kwh=20.0, scenario="normal"):
    soc_series, actions, costs, p2p_series = [], [], [], []
    soc = 0.5 * capacity_kwh

    for h in range(24):
        net = solar[h] - load[h]
        p2p = 0.0

        if scenario == "cloud_cover" and 9 <= h <= 15:
            net -= solar[h] * 0.70   # 70% cloud shadow

        if scenario == "grid_outage" and 16 <= h <= 20:
            # Island mode: battery keeps lights on, no grid import
            if soc > 0.2 * capacity_kwh:
                discharge = min(load[h], soc - 0.2 * capacity_kwh)
                soc -= discharge
                cost = 0.0
                actions.append("island_discharge")
            else:
                cost = load[h] * 0.50   # emergency rate
                actions.append("outage_critical")
            soc_series.append(soc)
            costs.append(cost)
            p2p_series.append(0)
            continue

        if net > 0:
            # Excess solar → charge battery or export P2P
            charge = min(net, capacity_kwh - soc) * 0.90
            soc += charge
            p2p = max(0, net - charge) * 0.85
            actions.append("charge")
        elif net < 0 and price[h] > 0.18 and soc > 0.2 * capacity_kwh:
            # Peak price → discharge battery
            discharge = min(abs(net), soc - 0.2 * capacity_kwh) * 0.90
            soc -= discharge
            remaining = abs(net) - discharge
            cost = max(0, remaining) * price[h]
            actions.append("discharge")
        else:
            cost = max(0, abs(net)) * price[h]
            actions.append("idle")

        soc = np.clip(soc, 0, capacity_kwh)
        cost = max(0, abs(net)) * price[h] if actions[-1] == "idle" else (
            0 if net > 0 else cost
        )
        soc_series.append(soc)
        costs.append(cost)
        p2p_series.append(p2p)

    return (
        np.array(soc_series),
        actions,
        np.array(costs),
        np.array(p2p_series),
    )

# ─────────────────────────────────────────────
#  NEIGHBORS  (simulated nodes)
# ─────────────────────────────────────────────
NEIGHBORS = [
    {"id": "N-01", "name": "12 Maple St",  "solar_kw": 8.5,  "battery_kwh": 20, "ev": True},
    {"id": "N-02", "name": "7 Oak Ave",    "solar_kw": 5.0,  "battery_kwh": 10, "ev": False},
    {"id": "N-03", "name": "Brew & Grind", "solar_kw": 12.0, "battery_kwh": 30, "ev": False},
    {"id": "N-04", "name": "45 Pine Rd",   "solar_kw": 0.0,  "battery_kwh": 0,  "ev": True},
    {"id": "N-05", "name": "8 Elm Court",  "solar_kw": 6.5,  "battery_kwh": 15, "ev": True},
    {"id": "N-06", "name": "Community Hall","solar_kw": 20.0, "battery_kwh": 50, "ev": False},
]

# ─────────────────────────────────────────────
#  SESSION STATE  (simulation + agent feed)
# ─────────────────────────────────────────────
if "scenario" not in st.session_state:
    st.session_state.scenario = "normal"
if "current_hour" not in st.session_state:
    st.session_state.current_hour = 14
if "agent_log" not in st.session_state:
    st.session_state.agent_log = []
if "concierge_msg" not in st.session_state:
    st.session_state.concierge_msg = None

def add_log(time_str, tag, action, msg):
    st.session_state.agent_log.append({
        "time": time_str, "tag": tag, "action": action, "msg": msg
    })
    if len(st.session_state.agent_log) > 40:
        st.session_state.agent_log = st.session_state.agent_log[-40:]

# Pre-populate with some history
if len(st.session_state.agent_log) == 0:
    seed_events = [
        ("06:30", "save", "SOLAR_ONLINE", "Solar generation online — 8.5 kW rising"),
        ("08:15", "action", "CHARGE", "Charging battery at 4.2 kW — off-peak rate $0.09/kWh"),
        ("10:00", "save", "P2P_EXPORT", "Exporting 1.8 kW to N-04 (45 Pine Rd) at $0.11/kWh"),
        ("12:45", "action", "PEAK_ALERT", "Grid price rising — pre-positioning battery for 18:00 peak"),
        ("13:30", "save", "P2P_EXPORT", "Exporting 2.1 kW to Community Hall — $0.13/kWh"),
    ]
    for ts, tag, act, msg in seed_events:
        add_log(ts, tag, act, msg)

# ─────────────────────────────────────────────
#  HEADER
# ─────────────────────────────────────────────
st.markdown(
    """
    <div class="gn-header">
        <div>
            <div class="gn-logo">GRID-NEIGHBOR<span> AI</span></div>
            <div class="gn-tagline">Decentralized Energy Intelligence · Neighborhood Microgrid OS</div>
        </div>
        <div class="gn-status-pill">
            <div class="gn-status-dot"></div>
            LIVE · 6 NODES CONNECTED
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ─────────────────────────────────────────────
#  SIDEBAR — Controls
# ─────────────────────────────────────────────
with st.sidebar:
    st.markdown("### ⚙️ Simulation Controls")
    st.markdown("---")

    st.markdown("**Time Step**")
    current_hour = st.slider("Hour of Day", 0, 23, st.session_state.current_hour, format="%d:00")
    st.session_state.current_hour = current_hour

    st.markdown("**Battery Capacity (kWh)**")
    battery_cap = st.slider("", 5, 100, 20)

    st.markdown("**Scenario**")
    scenario = st.radio(
        "",
        ["normal", "cloud_cover", "grid_outage"],
        format_func=lambda x: {"normal": "☀️ Normal Day", "cloud_cover": "☁️ Cloud Cover", "grid_outage": "⚡ Grid Outage"}[x],
        index=["normal", "cloud_cover", "grid_outage"].index(st.session_state.scenario),
    )
    if scenario != st.session_state.scenario:
        st.session_state.scenario = scenario
        ts = f"{current_hour:02d}:{np.random.randint(0,59):02d}"
        if scenario == "cloud_cover":
            add_log(ts, "warn", "CLOUD_COVER", "Sudden cloud cover detected — solar output reduced 70%")
            st.session_state.concierge_msg = {
                "icon": "☁️",
                "color": "amber",
                "msg": "I see cloud cover rolling in. Let me pre-charge your battery now while prices are low. I can save you ~$28 this afternoon.",
                "action": "Pre-Charge Battery",
                "action_key": "pre_charge",
            }
        elif scenario == "grid_outage":
            add_log(ts, "alert", "GRID_OUTAGE", "Grid outage detected — switching to island mode")
            st.session_state.concierge_msg = {
                "icon": "⚡",
                "color": "red",
                "msg": "Grid outage detected on your block. I'm switching all nodes to island mode. Estimated 4h battery reserve. Prioritizing critical loads.",
                "action": "Authorize Island Mode",
                "action_key": "island_mode",
            }

    st.markdown("---")
    st.markdown("**Grid Tariff (¢/kWh)**")
    peak_price   = st.slider("Peak rate",    15, 50, 32)
    offpeak_price = st.slider("Off-peak rate", 5, 20, 9)

    st.markdown("---")
    st.markdown(
        "<div style='font-size:0.68rem;font-family:Space Mono;color:#475569;line-height:1.6'>"
        "Agent: Gemini 1.5 Flash<br>"
        "Nodes: 6 active<br>"
        "Last sync: just now"
        "</div>",
        unsafe_allow_html=True,
    )

# ─────────────────────────────────────────────
#  COMPUTE SIMULATION
# ─────────────────────────────────────────────
rng = np.random.default_rng(42)
solar = make_solar(noise=0.0 if st.session_state.scenario == "normal" else 0.3)
load  = make_load()
price = make_grid_price()

# Scale price to sidebar sliders
price = np.clip(price * (peak_price / 32), offpeak_price / 100, peak_price / 100)

soc, actions, costs, p2p = simulate_battery(solar, load, price, battery_cap, st.session_state.scenario)

# Baseline (no AI — just buy from grid when needed)
baseline_costs = np.array([max(0, load[h] - solar[h]) * price[h] for h in HOURS])
baseline_costs = np.clip(baseline_costs, 0, None)

total_savings   = (baseline_costs.sum() - costs.sum()) * 24
current_soc_pct = (soc[current_hour] / battery_cap) * 100
net_power_now   = solar[current_hour] - load[current_hour]
grid_price_now  = price[current_hour]

# ─────────────────────────────────────────────
#  KPI STAT CARDS
# ─────────────────────────────────────────────
col1, col2, col3, col4 = st.columns(4)

with col1:
    delta_solar = solar[current_hour] - solar[max(0, current_hour - 1)]
    st.markdown(
        f"""<div class="stat-card">
        <div class="stat-label">Solar Output</div>
        <div class="stat-value teal">{solar[current_hour]:.1f}<span style="font-size:1rem;color:#94a3b8"> kW</span></div>
        <div class="stat-delta">{'▲' if delta_solar > 0 else '▼'} {abs(delta_solar):.1f} kW from prev hour</div>
        </div>""",
        unsafe_allow_html=True,
    )

with col2:
    soc_color = "green" if current_soc_pct > 50 else ("amber" if current_soc_pct > 25 else "red")
    card_color = soc_color
    st.markdown(
        f"""<div class="stat-card {card_color}">
        <div class="stat-label">Battery SoC</div>
        <div class="stat-value {soc_color}">{current_soc_pct:.0f}<span style="font-size:1rem;color:#94a3b8"> %</span></div>
        <div class="stat-delta">{soc[current_hour]:.1f} kWh of {battery_cap} kWh</div>
        </div>""",
        unsafe_allow_html=True,
    )

with col3:
    price_color = "red" if grid_price_now > 0.25 else ("amber" if grid_price_now > 0.15 else "green")
    st.markdown(
        f"""<div class="stat-card">
        <div class="stat-label">Grid Price Now</div>
        <div class="stat-value {price_color}">{grid_price_now*100:.1f}<span style="font-size:1rem;color:#94a3b8"> ¢/kWh</span></div>
        <div class="stat-delta">{'Peak' if grid_price_now > 0.20 else 'Standard'} tariff · TOU rate</div>
        </div>""",
        unsafe_allow_html=True,
    )

with col4:
    st.markdown(
        f"""<div class="stat-card green">
        <div class="stat-label">24h Projected Savings</div>
        <div class="stat-value green">${total_savings:.2f}</div>
        <div class="stat-delta">vs. no-AI baseline · {len(NEIGHBORS)} nodes</div>
        </div>""",
        unsafe_allow_html=True,
    )

st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

# ─────────────────────────────────────────────
#  CONCIERGE ALERT  (Human-in-the-Loop card)
# ─────────────────────────────────────────────
if st.session_state.concierge_msg:
    cm = st.session_state.concierge_msg
    border_color = {"amber": "#f59e0b", "red": "#ef4444", "teal": "#00d4b8"}.get(cm["color"], "#00d4b8")
    bg_color     = {"amber": "#1f1500", "red": "#1f0a0a", "teal": "#001f1c"}.get(cm["color"], "#001f1c")

    st.markdown(
        f"""<div style="background:{bg_color};border:1px solid {border_color};border-radius:10px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:flex-start;gap:16px;">
        <div style="font-size:2rem;line-height:1">{cm['icon']}</div>
        <div style="flex:1">
            <div style="font-family:'Space Mono',monospace;font-size:0.68rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">AGENT CONCIERGE · AWAITING YOUR DECISION</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:0.9rem;color:#e2e8f0;line-height:1.5">{cm['msg']}</div>
        </div>
        </div>""",
        unsafe_allow_html=True,
    )
    btn_col1, btn_col2, _ = st.columns([1, 1, 4])
    with btn_col1:
        if st.button(f"✓ {cm['action']}", key=cm["action_key"] + "_yes"):
            ts = f"{current_hour:02d}:{np.random.randint(0,59):02d}"
            add_log(ts, "save", "USER_APPROVED", f"User authorized: {cm['action']} — executing now")
            st.session_state.concierge_msg = None
            st.rerun()
    with btn_col2:
        if st.button("✕ Dismiss", key=cm["action_key"] + "_no"):
            st.session_state.concierge_msg = None
            st.rerun()

# ─────────────────────────────────────────────
#  MAIN CHART ROW
# ─────────────────────────────────────────────
chart_col, soc_col = st.columns([3, 1.5])

PLOT_BG  = "#111827"
GRID_CLR = "#1e3a5f"
FONT_CLR = "#94a3b8"

with chart_col:
    st.markdown('<div class="section-label">Power Balance · 24h</div>', unsafe_allow_html=True)

    fig = make_subplots(
        rows=2, cols=1, shared_xaxes=True,
        row_heights=[0.68, 0.32], vertical_spacing=0.06,
        subplot_titles=["", ""],
    )

    # Solar fill
    fig.add_trace(go.Scatter(
        x=HOUR_LABELS, y=solar, name="Solar Gen",
        fill="tozeroy", mode="lines",
        line=dict(color="#00d4b8", width=2),
        fillcolor="rgba(0,212,184,0.12)",
    ), row=1, col=1)

    # Load
    fig.add_trace(go.Scatter(
        x=HOUR_LABELS, y=load, name="Load Demand",
        mode="lines", line=dict(color="#f59e0b", width=2, dash="dot"),
    ), row=1, col=1)

    # P2P export
    fig.add_trace(go.Bar(
        x=HOUR_LABELS, y=p2p, name="P2P Export",
        marker_color="rgba(34,197,94,0.55)",
        marker_line_color="#22c55e", marker_line_width=1,
    ), row=1, col=1)

    # Current hour marker
    fig.add_vline(
        x=HOUR_LABELS[current_hour],
        line_color="#ffffff", line_dash="dot", line_width=1, opacity=0.4,
    )

    # Grid price bar
    fig.add_trace(go.Bar(
        x=HOUR_LABELS, y=price * 100, name="Grid Price (¢)",
        marker_color=[
            "rgba(239,68,68,0.65)" if p > 0.22 else
            "rgba(245,158,11,0.5)"  if p > 0.15 else
            "rgba(34,197,94,0.4)"
            for p in price
        ],
        marker_line_width=0,
    ), row=2, col=1)

    fig.update_layout(
        height=340,
        paper_bgcolor=PLOT_BG, plot_bgcolor=PLOT_BG,
        font=dict(family="Space Mono", size=10, color=FONT_CLR),
        legend=dict(
            orientation="h", y=1.04, x=0,
            bgcolor="rgba(0,0,0,0)", font=dict(size=9),
        ),
        margin=dict(l=45, r=10, t=20, b=10),
        bargap=0.2,
    )
    fig.update_xaxes(
        showgrid=True, gridcolor=GRID_CLR, gridwidth=1,
        tickfont=dict(size=9), zeroline=False,
        tickvals=HOUR_LABELS[::4],
    )
    fig.update_yaxes(
        showgrid=True, gridcolor=GRID_CLR, gridwidth=1,
        tickfont=dict(size=9), zeroline=False,
    )
    fig.update_yaxes(title_text="kW", row=1, col=1, title_font=dict(size=9))
    fig.update_yaxes(title_text="¢/kWh", row=2, col=1, title_font=dict(size=9))

    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

with soc_col:
    st.markdown('<div class="section-label">Battery SoC · 24h</div>', unsafe_allow_html=True)

    soc_pct = (soc / battery_cap) * 100
    action_colors = {
        "charge": "#00d4b8", "discharge": "#f59e0b",
        "idle": "#475569", "island_discharge": "#22c55e",
        "outage_critical": "#ef4444",
    }
    bar_colors = [action_colors.get(a, "#475569") for a in actions]

    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=HOUR_LABELS, y=soc_pct, mode="lines",
        line=dict(color="#00d4b8", width=2.5),
        fill="tozeroy", fillcolor="rgba(0,212,184,0.08)",
        name="SoC %",
    ))
    # Safety bands
    fig2.add_hrect(y0=0, y1=20,  fillcolor="rgba(239,68,68,0.07)", line_width=0)
    fig2.add_hrect(y0=80, y1=100, fillcolor="rgba(245,158,11,0.07)", line_width=0)
    fig2.add_hline(y=20, line_color="#ef4444", line_dash="dot", line_width=1, opacity=0.5)
    fig2.add_hline(y=80, line_color="#f59e0b", line_dash="dot", line_width=1, opacity=0.5)
    fig2.add_vline(
        x=HOUR_LABELS[current_hour],
        line_color="#ffffff", line_dash="dot", line_width=1, opacity=0.4,
    )

    fig2.update_layout(
        height=340,
        paper_bgcolor=PLOT_BG, plot_bgcolor=PLOT_BG,
        font=dict(family="Space Mono", size=9, color=FONT_CLR),
        showlegend=False,
        margin=dict(l=40, r=10, t=20, b=10),
    )
    fig2.update_xaxes(
        showgrid=True, gridcolor=GRID_CLR,
        tickvals=HOUR_LABELS[::6], tickfont=dict(size=8),
    )
    fig2.update_yaxes(
        showgrid=True, gridcolor=GRID_CLR,
        tickfont=dict(size=8), ticksuffix="%",
        range=[0, 105],
    )
    st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})

# ─────────────────────────────────────────────
#  BOTTOM ROW — Agent Feed + Neighbors + Savings
# ─────────────────────────────────────────────
feed_col, neighbor_col, savings_col = st.columns([1.8, 2.2, 1])

with feed_col:
    st.markdown('<div class="section-label">Agent Activity Feed</div>', unsafe_allow_html=True)
    lines_html = ""
    for entry in reversed(st.session_state.agent_log[-12:]):
        lines_html += (
            f'<div class="feed-line">'
            f'<span class="feed-time">{entry["time"]}</span>'
            f'<span class="feed-action {entry["tag"]}">[{entry["action"]}]</span>'
            f'<span class="feed-msg">{entry["msg"]}</span>'
            f'</div>'
        )
    st.markdown(f'<div class="agent-feed">{lines_html}</div>', unsafe_allow_html=True)

    # Manual log trigger buttons
    st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
    b1, b2 = st.columns(2)
    with b1:
        if st.button("▶ Step Hour", key="step_hour"):
            st.session_state.current_hour = min(23, st.session_state.current_hour + 1)
            h = st.session_state.current_hour
            ts = f"{h:02d}:{np.random.randint(0,59):02d}"
            action = actions[h]
            price_v = price[h]
            if action == "discharge":
                add_log(ts, "action", "DISCHARGE", f"Discharging at peak ${price_v*100:.1f}¢ — saving grid cost")
            elif action == "charge":
                add_log(ts, "save", "CHARGE", f"Charging from surplus solar — {solar[h]:.1f} kW available")
            elif net_power_now > 0:
                add_log(ts, "save", "P2P_EXPORT", f"Exporting {net_power_now:.1f} kW to network @ {price_v*100:.1f}¢")
            else:
                add_log(ts, "action", "IDLE", f"Grid draw {abs(net_power_now):.1f} kW @ {price_v*100:.1f}¢/kWh")
            st.rerun()
    with b2:
        if st.button("↺ Reset Sim", key="reset"):
            st.session_state.agent_log = []
            st.session_state.scenario = "normal"
            st.session_state.concierge_msg = None
            st.session_state.current_hour = 14
            st.rerun()

with neighbor_col:
    st.markdown('<div class="section-label">Neighborhood Nodes</div>', unsafe_allow_html=True)

    # Compute per-neighbor state for current hour
    nodes_html = '<div class="node-grid">'
    for i, n in enumerate(NEIGHBORS):
        rng2 = np.random.default_rng(i * 7 + current_hour)
        has_solar = n["solar_kw"] > 0
        node_solar = n["solar_kw"] * max(0, np.sin(np.pi * (current_hour - 6) / 12)) if has_solar else 0
        node_load  = 1.5 + rng2.random() * 2.5
        net_node   = node_solar - node_load
        soc_node   = 50 + rng2.integers(-20, 30) if n["battery_kwh"] > 0 else 0

        if net_node > 0.5:
            role = "export"; role_label = f"+{net_node:.1f} kW exporting"; bar_cls = "export"
        elif net_node < -0.5:
            role = "import"; role_label = f"{net_node:.1f} kW importing"; bar_cls = "import"
        else:
            role = "balanced"; role_label = "balanced"; bar_cls = ""

        bar_w = int(abs(net_node) / max(n["solar_kw"], 1) * 100)
        bar_w = min(bar_w, 100)
        ev_badge = "🔌" if n["ev"] else ""
        solar_badge = "☀️" if has_solar else ""
        batt_badge = "🔋" if n["battery_kwh"] > 0 else ""

        nodes_html += f"""
        <div class="node-card">
            <div class="node-name">{n['id']} {ev_badge}{solar_badge}{batt_badge}</div>
            <div style="font-size:0.7rem;color:#94a3b8;margin-bottom:2px">{n['name']}</div>
            <div class="node-bar-bg"><div class="node-bar-fill {bar_cls}" style="width:{bar_w}%"></div></div>
            <div class="node-kv">
                <span>{role_label}</span>
                <span>SoC {soc_node}%</span>
            </div>
        </div>"""
    nodes_html += "</div>"
    st.markdown(nodes_html, unsafe_allow_html=True)

with savings_col:
    st.markdown('<div class="section-label">Bottom Line</div>', unsafe_allow_html=True)
    st.markdown(
        f"""<div class="savings-banner">
        <div class="savings-label">24h AI Savings</div>
        <div class="savings-number">${total_savings:.2f}</div>
        <div style="font-family:'Space Mono',monospace;font-size:0.65rem;color:#475569;margin-top:6px">vs. no-AI baseline</div>
        </div>""",
        unsafe_allow_html=True,
    )

    st.markdown("<div style='height:10px'></div>", unsafe_allow_html=True)

    # Mini cost comparison chart
    fig3 = go.Figure()
    fig3.add_trace(go.Scatter(
        x=HOUR_LABELS, y=np.cumsum(baseline_costs * 24),
        name="No AI", mode="lines",
        line=dict(color="#ef4444", width=1.5, dash="dot"),
    ))
    fig3.add_trace(go.Scatter(
        x=HOUR_LABELS, y=np.cumsum(costs * 24),
        name="Grid-Neighbor AI", mode="lines",
        line=dict(color="#00d4b8", width=2),
        fill="tonexty", fillcolor="rgba(34,197,94,0.08)",
    ))
    fig3.update_layout(
        height=175,
        paper_bgcolor=PLOT_BG, plot_bgcolor=PLOT_BG,
        font=dict(family="Space Mono", size=8, color=FONT_CLR),
        legend=dict(orientation="h", y=1.1, font=dict(size=7), bgcolor="rgba(0,0,0,0)"),
        margin=dict(l=35, r=5, t=10, b=5),
    )
    fig3.update_xaxes(showgrid=True, gridcolor=GRID_CLR, tickvals=HOUR_LABELS[::8], tickfont=dict(size=7))
    fig3.update_yaxes(showgrid=True, gridcolor=GRID_CLR, tickfont=dict(size=7), tickprefix="$")
    st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})

# ─────────────────────────────────────────────
#  FOOTER
# ─────────────────────────────────────────────
st.markdown(
    """
    <div style="margin-top:2rem;padding-top:1rem;border-top:1px solid #1e3a5f;
    display:flex;justify-content:space-between;align-items:center;">
        <div style="font-family:'Space Mono',monospace;font-size:0.65rem;color:#475569">
            Grid-Neighbor AI · Hackathon Demo · Gemini 1.5 Flash · Vertex AI
        </div>
        <div style="font-family:'Space Mono',monospace;font-size:0.65rem;color:#475569">
            P2P Energy Protocol · Decentralized Intelligence · Every Home a Brain
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)
