# Grid-Neighbor AI — Frontend Dashboard

> Decentralized Energy Intelligence · Neighborhood Microgrid OS

## Quick Start

```bash
pip install streamlit plotly pandas numpy
streamlit run dashboard.py
```

Opens at `http://localhost:8501`

---

## What's in the Dashboard

| Section | Description |
|---|---|
| **KPI Cards** | Live solar output, battery SoC, grid price, 24h projected savings |
| **Power Balance Chart** | Solar gen vs load demand vs P2P exports, with grid pricing heatmap |
| **Battery SoC Chart** | 24h state-of-charge with safety bands (20–80%) |
| **Concierge Alerts** | Human-in-the-loop decision cards — agent asks before acting |
| **Neighborhood Nodes** | Per-home import/export status across 6 nodes |
| **Bottom Line** | Cumulative cost comparison: AI vs no-AI baseline |
| **Agent Feed** | Live timestamped log of every agent decision |

---

## Connecting to the Backend (for teammates)

The dashboard expects the simulation engine (Person B) to expose a module called `simulation_engine.py` with:

```python
def get_state(hour: int) -> dict:
    """Returns: {solar_kw, load_kw, grid_price, battery_soc, net_power}"""

def update_state(action: str, amount: float) -> dict:
    """Applies agent action, returns updated state"""
```

And the Gemini agent (Person A) to expose:

```python
def get_agent_decision(state: dict) -> dict:
    """Calls Gemini 1.5 Flash, returns: {action, amount, reasoning}"""
```

Replace the `simulate_battery()` calls in `dashboard.py` with calls to these modules.
The agent reasoning text should be passed to `add_log()` to populate the live feed.

---

## Scenario Buttons

Three scenarios are wired in the sidebar:
- ☀️ **Normal Day** — standard TOU pricing and solar curve
- ☁️ **Cloud Cover** — solar drops 70% from 9am–3pm, triggers concierge alert
- ⚡ **Grid Outage** — island mode from 4–8pm, battery keeps lights on

---

## Deployment (Streamlit Cloud)

1. Push to GitHub
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect repo → select `dashboard.py` → Deploy

No config needed — all dependencies in `requirements.txt` below.

---

## requirements.txt

```
streamlit>=1.35.0
plotly>=5.20.0
pandas>=2.0.0
numpy>=1.26.0
google-generativeai>=0.5.0
```
