# GridMind — KineticKin Dashboard

GridMind is a peer-to-peer energy sharing intelligence platform for neighborhood microgrids. It simulates how three households on the same block can share rooftop solar production with each other before drawing from the public utility grid — reducing costs, increasing grid independence, and surfacing actionable operational recommendations in real time.

The dashboard has two interconnected layers:

**P2P Simulation Engine** — a deterministic 3-stage algorithm that runs across 72 hours of real household data at 15-minute resolution, computing battery behavior, community energy exchange, grid interaction, and cost accounting for every step.

**Predictive Intelligence Layer** — a rolling 24-hour forecast that computes P̂_net per household, detects upcoming price spikes and solar surplus windows, and generates strategic agent recommendations (pre-charge, pre-cool, load shift, EV scheduling, battery conservation).

---

## Data

**Source:** Real 15-minute interval recordings from three households (`gridmind_household_{1,2,3}_72h_15min.csv`), each 288 rows.

**Coverage:** Dec 16 17:15 → Dec 19 17:00 (72 hours, 288 steps)

**Resolution:** `INTERVAL_H = 0.25` (15 min = 0.25 h), `STEPS_PER_DAY = 96`, `N_STEPS = 288`

| Household | Type | Peak Solar | Battery |
|---|---|---|---|
| Household 1 | High-Solar Prosumer | 7.7 kW | 10 kWh (starts 50%) |
| Household 2 | Medium-Solar · High Evening Load | 4.4 kW | None |
| Household 3 | Low-Solar · High-Consumption | 2.2 kW | None |

Data arrays are inlined as TypeScript constants (`H1_DEMAND`, `H1_SOLAR`, etc.) for zero-latency browser access. Step labels use actual CSV timestamps: `D1 17:15`, `D2 06:00`, etc.

---

## Simulation Engine (`simulation.ts`)

### Three-stage algorithm — runs once per 15-min step, across all 288 steps

---

#### Stage 1 — Individual Home Balancing

Each household self-balances using its own solar and battery before any community sharing occurs.

```
solarKwh    = solarKw × INTERVAL_H          (energy produced this 15-min step)
loadKwh     = loadKw  × INTERVAL_H          (energy consumed this 15-min step)
initialNet  = solarKwh − loadKwh            (positive = surplus, negative = deficit)
```

**Battery logic (Household 1 only, 10 kWh, starts at 50% = 5 kWh):**

```
If deficit (initialNet < 0):
  discharge  = min(|initialNet|, socBefore)   ← discharge what's available, not beyond SOC
  stage1Net  = initialNet + discharge          ← deficit reduced
  battDelta  = −discharge

If surplus (initialNet > 0):
  space      = batteryMaxKwh − socBefore       ← empty space in battery
  charge     = min(initialNet, space)          ← fill what fits
  stage1Net  = initialNet − charge             ← remaining surplus after charging
  battDelta  = +charge

socAfter = socBefore + battDelta               ← SOC persists across all 288 steps
```

Households without a battery: `stage1Net = initialNet` (no modification).

---

#### Stage 2 — Community P2P Sharing

After each house self-balances, leftover surpluses are pooled and distributed to households still in deficit.

```
sTotal = sum of stage1Net for all sellers (stage1Net > 0)
dTotal = sum of |stage1Net| for all buyers  (stage1Net < 0)

alpha     = min(1, sTotal / dTotal)          ← fraction of demand that can be covered locally
sendRatio = min(1, dTotal / sTotal)          ← fraction of surplus each seller actually sends

sharedLocallyKwh = min(sTotal, dTotal)       ← total energy exchanged peer-to-peer
gridSellKwh      = sTotal − sharedLocallyKwh ← surplus exported back to grid
```

**Per household:**

```
Sellers:  p2pSentKwh     = stage1Net × sendRatio
Buyers:   p2pReceivedKwh = |stage1Net| × alpha
          gridImportKwh  = |stage1Net| − p2pReceivedKwh   ← what P2P couldn't cover
```

`alpha` is the fairness coefficient — when community supply is limited, every buyer receives the same fraction of their deficit from neighbors. When supply exceeds demand, `alpha = 1` (all deficits fully covered locally).

---

#### Stage 3 — Grid Interaction and Cost Accounting

Remaining deficits after P2P are settled with the public utility at TOU (time-of-use) rates.

**TOU Grid Prices ($/kWh by hour-of-day):**

| Hours | Rate | Period |
|---|---|---|
| 00:00 – 05:45 | $0.09 | Off-peak night |
| 06:00 – 07:45 | $0.15 | Shoulder morning |
| 08:00 – 13:45 | $0.25 | Mid-peak day |
| 14:00 – 21:45 | $0.35 | Peak evening |
| 22:00 – 22:45 | $0.25 | Mid-peak late |
| 23:00 – 23:45 | $0.15 | Shoulder night |

**Community (P2P) Price = gridPrice × Clean_Factor:**

| Hours | Clean_Factor | P2P Rate (at $0.35 grid) |
|---|---|---|
| 10:00 – 16:00 | 0.50 | $0.175/kWh |
| 17:00 – 21:00 | 0.80 | $0.280/kWh |
| All other | 0.90 | up to $0.315/kWh |

P2P trades are always cheaper than buying from the grid (Clean_Factor < 1 always).

**Cost formulas per household per step:**

```
gridCost   = gridImportKwh   × gridPrice          (what you pay the utility)
p2pRevenue = p2pSentKwh      × communityPrice      (credit for energy sold to neighbors)
netCost    = gridCost − p2pRevenue                 (negative = net seller earns money)

costNoP2P  = |stage1Net| × gridPrice              (baseline: no sharing, full grid dependency)
```

**72h household summary:**

```
totalSentKwh     = Σ p2pSentKwh     over 288 steps
totalReceivedKwh = Σ p2pReceivedKwh over 288 steps
totalRevenue     = Σ p2pRevenue     over 288 steps
netCost          = Σ netCost        over 288 steps
costNoP2P        = Σ costNoP2P      over 288 steps
p2pSaved         = costNoP2P − netCost              (positive = P2P was beneficial)
```

**Community summary:**

```
totalCostWithP2P    = Σ netCost   across all households
totalCostWithoutP2P = Σ costNoP2P across all households
moneySaved          = totalCostWithoutP2P − totalCostWithP2P
gridSavedKwh        = totalGridNoP2PKwh − totalGridKwh
avgIndependence     = mean(independenceScore) over 288 steps
```

**Independence score (per step, community-level):**

```
independenceScore = (1 − gridImportKwh / totalLoadKwh) × 100     (% of load met locally)
independenceNoP2P = (1 − gridImportNoP2PKwh / totalLoadKwh) × 100
```

---

## Predictive Model (`Forecast.tsx`)

### Rolling 24-hour look-ahead using real simulation data

The forecast uses the full 288-step simulation output — there is no separate model; it reads ahead in the already-computed array, treating future steps as predictions.

**Core equation:**

```
P̂_net(t+n) = P̂_solar(t+n) − P̂_load(t+n)

Per household:
  h1Net = horizon[n].houses[0].solarKwh − horizon[n].houses[0].loadKwh
  h2Net = horizon[n].houses[1].solarKwh − horizon[n].houses[1].loadKwh
  h3Net = horizon[n].houses[2].solarKwh − horizon[n].houses[2].loadKwh
  communityNet = h1Net + h2Net + h3Net

Positive → household is a seller (surplus)
Negative → household is a buyer (deficit)
```

**Horizon:** `HORIZON_STEPS = 96` (24 hours of 15-min steps starting from the selected current step)

**Default start:** step 51 = D1 06:00 (first solar hour of Day 1)

**Slider range:** 0 – 191 (leaves a full 24h horizon available at any position)

---

### Recommendation Engine (`computeRecs`)

Generates up to 4 strategic actions from the 24h horizon. Evaluated in order:

| # | Recommendation | Trigger Condition |
|---|---|---|
| 1 | Pre-Charge Battery | Next peak ≥ $0.35/kWh exists AND off-peak slot before it AND SOC < 75% |
| 2 | Pre-Cool Before Price Spike | ≥ 2 P2P surplus steps in next 4h AND peak coming |
| 3 | Shift Load to Solar Hours | Any P2P sharing steps exist in next 24h (targets peak P2P step) |
| 4 | EV Charge Window | Always — finds the lowest grid price step in next 24h |
| 5 | Reserve Battery Overnight | >60 low-solar steps ahead (15h+) AND SOC > 35% |

Priority levels: **high** (red) = act now, **medium** (amber) = plan today, **low** (teal) = informational

---

### Agent Briefing (`generateBriefing`)

Natural language summary generated from the 24h horizon covering:

- Solar coverage (`solarPct` = steps with community solar > 1 kW / 96 steps × 100)
- Next grid price spike (first step where gridPrice ≥ $0.35/kWh)
- Battery SOC status (healthy ≥ 70%, watch 30–70%, critical < 30%)
- P2P peak window (highest `sharedLocallyKwh` step in next 24h)
- Stress count (steps where `independenceScore < 60%`)

---

## Dashboard Pages

### Overview (`/dashboard`)

Community-level 72h summary.

**KPI cards:**
- Avg Independence: `avgIndependence` % (teal ≥ 70, amber ≥ 50, red < 50)
- P2P Shared: `totalSharedKwh` — total neighbor-to-neighbor kWh over 72h
- Grid Import: `totalGridKwh` — total utility kWh drawn
- Community Savings: `moneySaved` = `totalCostWithoutP2P − totalCostWithP2P`

**Charts:**
- Energy flow area chart (72h): solar, P2P shared, grid import, load — `interval={23}` tick (one label per ~6h)
- Per-house cards: role badge (Prosumer/Consumer/Mixed), net cost, p2pSaved, step counts

---

### Timeline (`/timeline`)

Step-by-step scrubber across all 288 steps (0–287, default step 40).

**Per-house card at selected step:**

| Field | Source |
|---|---|
| Solar | `h.houses[i].solarKw` kW |
| Load | `h.houses[i].loadKw` kW |
| Net (pre-battery) | `h.houses[i].initialNetKwh` kWh |
| Battery Δ | `h.houses[i].batteryDeltaKwh` kWh (H1 only) |
| P2P Sent | `h.houses[i].p2pSentKwh` kWh |
| P2P Received | `h.houses[i].p2pReceivedKwh` kWh |
| Grid Import | `h.houses[i].gridImportKwh` kWh |

**Community metrics at selected step:** alpha (fairness), sharedLocallyKwh, gridPrice, communityPrice, independenceScore

---

### Collaboration (`/collaboration`)

P2P transaction log and per-house receipts.

**Step log table:** Every step where sharedLocallyKwh > 0 — showing seller, buyer, kWh exchanged, revenue, alpha value

**Per-house receipts (72h totals):** totalSentKwh, totalReceivedKwh, totalRevenue, netCost — with role classification (Seller if sellerSteps > buyerSteps, Buyer otherwise, Mixed if equal)

---

### Forecast (`/forecast`)

Rolling 24h predictive model with agent intelligence.

**Charts:**
- P̂_net per household (LineChart, 24h): h1Net/h2Net/h3Net/communityNet — positive = surplus, negative = deficit
- Price + P2P overlay (ComposedChart): bar for sharedLocallyKwh, step-after line for gridPrice
- Independence actual vs forecast (LineChart, 72h): ReferenceLine at 60% stress threshold

**Recommendation cards:** Up to 4, rendered as 2×2 grid, color-coded high/medium/low

**Agent briefing:** Natural language paragraph summarizing solar outlook, price spikes, battery status, P2P peak, stress count

**Next 16 steps table:** P̂_net per household — green positive (surplus), red negative (deficit)

---

### Comparison (`/comparison`)

P2P-enabled vs no-P2P baseline, head-to-head.

**Headline metrics:**
- Cost saved: `moneySaved` with percentage = `moneySaved / totalCostWithoutP2P × 100`
- Grid import reduced: `gridSavedKwh` with percentage = `gridSavedKwh / totalGridNoP2PKwh × 100`

**Charts:**
- 72h grid import line chart: withP2P vs noP2P per step
- 72h independence score: withP2P vs noP2P per step
- Per-house bar chart: `netCost` (with P2P) vs `costNoP2P` (without P2P)

**Compare bars (community totals):**
- Total grid cost: `totalCostWithP2P` vs `totalCostWithoutP2P`
- Total grid import: `totalGridKwh` vs `totalGridNoP2PKwh`
- P2P energy shared: `totalSharedKwh` vs 0
- Avg independence: `avgIndependence` vs `avgIndepNoP2P`

**Per-household table:** Sent, Received, Revenue, Cost with P2P, Cost without P2P, Net Benefit (`p2pSaved`)

---

## Project Structure

```
gridmind/
├── householddata/
│   ├── gridmind_household_1_72h_15min.csv   (288 rows, H1 demand + solar)
│   ├── gridmind_household_2_72h_15min.csv   (288 rows, H2 demand + solar)
│   └── gridmind_household_3_72h_15min.csv   (288 rows, H3 demand + solar)
│
└── dashboard/
    └── src/
        ├── simulation.ts       ← P2P engine, real CSV data inlined, all exports
        ├── App.tsx             ← sidebar nav, layout shell
        ├── main.tsx            ← React Router routes
        ├── index.css           ← design tokens, layout, chart styles
        └── pages/
            ├── Overview.tsx        ← community KPIs + 72h energy flow
            ├── Timeline.tsx        ← step scrubber (0–287) + per-house cards
            ├── Collaboration.tsx   ← P2P transaction log + receipts
            ├── Forecast.tsx        ← P̂_net charts + agent recommendations
            └── Comparison.tsx      ← P2P vs no-P2P side-by-side
```

---

## Running the Dashboard

```bash
cd gridmind/dashboard
npm install
npm run dev        # http://localhost:5175
npm run build      # production build (tsc + vite)
```

No environment variables required — all data is inlined as TypeScript arrays at build time.

---

## Key Formulas Reference

| Formula | Description |
|---|---|
| `solarKwh = solarKw × 0.25` | Energy produced in one 15-min step |
| `initialNet = solarKwh − loadKwh` | Pre-battery net position |
| `alpha = min(1, sTotal / dTotal)` | P2P fairness: fraction of each buyer's deficit covered |
| `sendRatio = min(1, dTotal / sTotal)` | Fraction of each seller's surplus actually sent |
| `gridCost = gridImportKwh × gridPrice` | What you pay the utility |
| `communityPrice = gridPrice × cleanFactor` | P2P trade price (always < grid price) |
| `p2pRevenue = p2pSentKwh × communityPrice` | Seller credit |
| `netCost = gridCost − p2pRevenue` | Net per-step cost (negative = earning) |
| `p2pSaved = costNoP2P − netCost` | Benefit from P2P over 72h |
| `independence = (1 − gridImport / totalLoad) × 100` | % of load met without the grid |
| `P̂_net = P̂_solar − P̂_load` | Forecast net position per household |
