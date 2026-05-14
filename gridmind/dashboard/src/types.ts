export interface BatterySnapshot {
  charge_level: number;
  state_of_charge: number;
  capacity: number;
}

export interface GridStateData {
  hour: number;
  solar: number;
  wind: number;
  demand: number;
  price: number;
  carbon: number;
  battery: BatterySnapshot;
}

export interface DecisionData {
  action: string;
  amount_kwh: number;
  classification: 'routine' | 'consequential';
  reasoning: string;
  question: string;
}

export interface OutcomeData {
  grid_draw_kwh: number;
  battery_charged_kwh: number;
  battery_discharged_kwh: number;
  curtailed_kwh: number;
  renewable_used_kwh: number;
  cost_usd: number;
  carbon_g: number;
  battery_after: BatterySnapshot;
}

export interface HourRecord {
  hour: number;
  state: GridStateData;
  decision: DecisionData;
  outcome: OutcomeData;
}

export interface AgentSummary {
  total_cost: number;
  total_carbon: number;
  renewable_used: number;
  curtailed: number;
}

export interface CycleSummary {
  agent: AgentSummary;
  baseline?: AgentSummary;
  cost_saved_pct?: number;
  carbon_saved_pct?: number;
}

export interface SimulationResult {
  scenario: string;
  scenario_description: string;
  cycle_summary: CycleSummary;
  hours: HourRecord[];
}

export interface StressPoint {
  hour: number;
  type: string;
  description: string;
}

export interface ForecastEntry {
  hour: number;
  summary: string;
  stress_points: StressPoint[];
  horizon: Array<{
    hour: number;
    solar: number;
    wind: number;
    demand: number;
    net_kwh: number;
    grid_price: number;
    grid_carbon: number;
  }>;
}
