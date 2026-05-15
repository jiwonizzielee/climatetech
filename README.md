# KineticKin

KineticKin is a multi-agent energy intelligence platform for neighborhood microgrids. It has two interconnected subsystems:

**Simulation Engine** — a 72-hour, 3-stage deterministic pipeline processing real household data at 15-minute intervals, modeling peer-to-peer (P2P) solar sharing, battery dispatch, and grid interaction across three households.

**AI Agent Network** — dispatch, collaboration, forecast, and reasoning agents that make real-time energy decisions, surface high-impact actions for operator approval, and generate plain-language recommendations via Claude.

---

## Simulation Engine

### Concept

Three households share rooftop solar and battery storage on a neighborhood microgrid. Every 15 minutes, the engine runs a 3-stage pipeline: each home self-balances first, then trades surplus energy peer-to-peer, and finally settles remaining deficits with the utility grid. The result is lower costs, higher local independence, and a transparent audit trail of every decision.

### Three-Stage Pipeline (per 15-minute step, 288 steps over 72 hours)

**Stage 1 — Individual Home Balancing**
Each house self-balances solar/wind production against load. Only Household 1 has a battery (10 kWh, starts at 50% SOC):

```
If deficit (initialNet < 0):
  discharge = min(|initialNet|, socBefore)
  stage1Net = initialNet + discharge
  socAfter  = socBefore - discharge

If surplus (initialNet > 0):
  space    = batteryMaxKwh - socBefore
  charge   = min(initialNet, space)
  stage1Net = initialNet - charge
  socAfter  = socBefore + charge
```

**Stage 2 — Community P2P Sharing**
Leftover surpluses are pooled and fairly distributed to buyers using a fairness coefficient α so no buyer gets more than their fair share:

```
alpha         = min(1, sTotal / dTotal)         # fraction of each buyer's deficit covered
sendRatio     = min(1, dTotal / sTotal)         # fraction of each seller's surplus actually sent
sharedKwh     = min(sTotal, dTotal)
gridSellKwh   = sTotal - sharedKwh
```

**Stage 3 — Grid Interaction & Cost**
Remaining deficits are settled with the utility at time-of-use (TOU) rates. P2P trades occur at a discounted community price:

```
gridPrice       = $0.09–$0.35/kWh (TOU by hour, peaks at morning/evening)
communityPrice  = gridPrice × cleanFactor       # cleanFactor: 0.5–0.9, always < gridPrice
gridCost        = gridImportKwh × gridPrice
p2pRevenue      = p2pSentKwh × communityPrice
netCost         = gridCost - p2pRevenue
p2pSaved        = costNoP2P - netCost           # 72h cumulative benefit
independenceScore = (1 - gridImportKwh / totalLoadKwh) × 100%
```

### Scenarios

| Scenario | Solar | Wind | Demand | Price | Description |
|---|---|---|---|---|---|
| `default` | 1.0× | 1.0× | 1.0× | 1.0× | Real measured data |
| `heat_wave` | 0.85× | 1.0× | 1.5× | 1.4× | AC overload + panel efficiency loss |
| `cloudy_calm` | 0.30× | 0.4× | 1.0× | 1.0× | Low generation — battery and grid critical |
| `windy_night` | 1.0× | 2.0× | 1.0× | 1.0× | Strong overnight wind — opportunity to pre-charge |

### Households

| ID | Type | Peak Solar | Battery | Role |
|---|---|---|---|---|
| Household 1 | High-Solar Prosumer | 7.7 kW | 10 kWh (50% initial SOC) | Seller (most of day) |
| Household 2 | Medium-Solar / High Evening Load | 4.4 kW | None | Mixed |
| Household 3 | Low-Solar Consumer | 2.2 kW | None | Buyer (most of day) |

Data period: Dec 16 17:15 → Dec 19 17:00 (72 hours, 15-min resolution)

### Running the Simulation

```bash
cd gridmind
python main.py --scenario default
python main.py --scenario heat_wave --p2p --compare --verbose
python main.py --scenario cloudy_calm --reasoning --forecast
```

Flags:

| Flag | Effect |
|---|---|
| `--scenario` | `default`, `heat_wave`, `cloudy_calm`, `windy_night` |
| `--p2p` | Enable peer-to-peer neighbor trading |
| `--compare` | Run baseline agent side-by-side for comparison |
| `--reasoning` | Enable Reasoning Agent (requires `ANTHROPIC_API_KEY`) |
| `--forecast` | Enable Forecast Agent (requires `ANTHROPIC_API_KEY`) |
| `--verbose` | Log full API transcripts and step details |
| `--seed SEED` | Random seed for profile noise (default: 42) |

Required environment variable (only for `--reasoning` / `--forecast`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Output Files

All written to `gridmind/output/`:

| File | Contents |
|---|---|
| `results.json` | Full cycle data (all 288 steps) |
| `cycle_summary.json` | Totals: cost, carbon, renewable used, curtailed |
| `decision_log.json` | Dispatch action per step |
| `collaboration_log.json` | Consequential decisions surfaced for operator review |
| `p2p_log.json` | Peer trades (`--p2p` only) |
| `baseline_comparison.json` | Agent vs. naive baseline (`--compare` only) |

---

## AI Agent Network

### Agents

**Dispatch Agent** (`gridmind/agents/dispatch_agent.py`)
Rule-based real-time controller. Receives a `GridState` snapshot each step and returns a `Decision`: one of `charge_battery`, `discharge_battery`, `draw_from_grid`, or `curtail_surplus` with an amount in kWh.

**Collaboration Agent** (`gridmind/agents/collaboration_agent.py`)
Classifies each decision as routine or consequential. Consequential decisions are flagged for operator review before execution. Triggers:
- Discharging > 40% of remaining battery capacity
- Grid price > $0.25/kWh
- Curtailing > 20 kWh of renewable energy

**Baseline Agent** (`gridmind/agents/baseline_agent.py`)
Naive comparison: always draws from grid on deficit, always curtails surplus. No battery use. Used to quantify the benefit of the AI dispatch and P2P system.

**P2P Agent** (`gridmind/agents/p2p_agent.py`)
Discovers bilateral trade opportunities with neighbors and runs market clearing. Returns each household's net position after local trades, before grid settlement.

**Forecast Agent** (`gridmind/agents/forecast_agent.py`)
4-hour lookahead powered by Claude. Identifies upcoming stress points and produces up to 5 prioritized recommendations:

1. **Pre-Charge Battery** — next peak ≥ $0.35/kWh + off-peak before it + SOC < 75%
2. **Pre-Cool Before Price Spike** — ≥ 2 P2P surplus steps in next 4h + peak coming
3. **Shift Load to Solar Hours** — P2P sharing steps exist in next 24h
4. **EV Charge Window** — always; finds lowest grid price step in next 24h
5. **Reserve Battery Overnight** — > 60 low-solar steps ahead + SOC > 35%

**Reasoning Agent** (`gridmind/agents/reasoning_agent.py`)
Generates plain-language operator communications for each decision — what was decided, why, and (for consequential decisions) an approval prompt.

| Parameter | Value |
|---|---|
| Dispatch temperature | 0.2 |
| Forecast temperature | 0.5 |
| Reasoning temperature | 0.8 |

### Data Flow

```
main.py (CLI)
  └── Simulation Engine (run_simulation)
        ├── Profiles: solar, wind, demand, grid price (real CSV data + scenario multipliers)
        ├── Battery: SOC state machine (persists across all 288 steps)
        ├── CollaborativeDispatchAgent (per step)
        │     ├── DispatchAgent        → Decision {action, amount_kwh}
        │     ├── CollaborationAgent   → classify as routine / consequential
        │     ├── P2PAgent             → bilateral market clearing (--p2p)
        │     ├── ForecastAgent        → stress points + recommendations (--forecast)
        │     └── ReasoningAgent       → operator message + approval question (--reasoning)
        └── Record HourResult per step → output JSON files
```

**Key data structures:**
- `GridState` — hour, solar, wind, demand, price, carbon, battery SOC, P2P accounting
- `Decision` — action, amount_kwh, classification, reasoning, operator question
- `HourResult` — step label, grid/community price, α, shared kWh, per-house snapshot

### Setup

Requirements: Python 3.10+

```bash
cd gridmind
pip install -r requirements.txt
cp .env.example .env   # add ANTHROPIC_API_KEY if using --reasoning or --forecast
```

---

## Frontend

```bash
cd gridmind/dashboard
npm install
npm run dev    # http://localhost:5175
```

No environment variables required — all household data is inlined as TypeScript arrays at build time. The dashboard includes a TypeScript replica of the 3-stage simulation engine (`simulation.ts`) for zero-latency browser interaction.

| Page | Route | Content |
|---|---|---|
| Overview | `/dashboard` | 72h KPI cards (avg independence %, P2P shared kWh, grid import, savings); energy flow area chart |
| Timeline | `/timeline` | Step scrubber (0–287); per-house snapshot at selected step; community α, shared kWh, prices |
| Collaboration | `/collaboration` | P2P transaction log; per-house 72h receipts (sent, received, revenue, cost, role) |
| Forecast | `/forecast` | 24h P̂_net per household; price overlay; independence actual vs. forecast; up to 5 recommendations |
| Comparison | `/comparison` | P2P-enabled vs. baseline: cost saved %, grid import reduced %, per-house bar chart and table |

KPI status colors: teal ≥ 70% independence, amber ≥ 50%, red < 50%.

---

## Project Structure

```
kinetickin/
└── gridmind/
    ├── main.py                      # CLI entry point
    ├── config.py                    # Battery specs, scenario multipliers, thresholds
    ├── requirements.txt
    ├── .env.example
    │
    ├── householddata/               # Real 72h × 15-min CSV data (288 rows each)
    │   ├── gridmind_household_1_72h_15min.csv
    │   ├── gridmind_household_2_72h_15min.csv
    │   └── gridmind_household_3_72h_15min.csv
    │
    ├── simulation/
    │   ├── engine.py                # 288-step loop, result recording
    │   ├── battery.py               # SOC state machine
    │   ├── profiles.py              # Solar, wind, demand, grid condition curves
    │   └── p2p_market.py            # Market clearing (alpha, sendRatio, sharedKwh)
    │
    ├── agents/
    │   ├── dispatch_agent.py        # Rule-based real-time dispatch
    │   ├── collaboration_agent.py   # Consequential decision classification
    │   ├── baseline_agent.py        # Naive comparison (always-grid)
    │   ├── p2p_agent.py             # Bilateral trade discovery + clearing
    │   ├── forecast_agent.py        # 4h lookahead, Claude API
    │   └── reasoning_agent.py       # Operator comms, Claude API
    │
    ├── output/                      # Generated JSON (gitignored)
    │
    └── dashboard/                   # React + Vite + TypeScript
        └── src/
            ├── simulation.ts        # TypeScript replica of 3-stage engine
            ├── types.ts             # Shared interface definitions
            ├── data.ts              # JSON transforms for display
            └── pages/
                ├── Overview.tsx
                ├── Timeline.tsx
                ├── Collaboration.tsx
                ├── Forecast.tsx
                └── Comparison.tsx
```

## Agent Tool Loop Pattern

Every AI agent follows the same structure: a system prompt scoping its domain, Python-backed tool definitions passed to the Claude API, and a dispatch loop that runs until the model reaches `end_turn`. Tool results are returned as `tool_result` messages. Agents do not share context — each runs an independent reasoning loop and returns a typed output (`Decision`, `TrendReport`, etc.) to the calling layer.

To add a new data source or capability: write a tool function, register it in the relevant agent's tool list, and describe it in the system prompt. The model handles invocation timing and result synthesis within the existing loop.
