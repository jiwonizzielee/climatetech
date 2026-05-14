/**
 * Data loader — reads JSON outputs from the Python simulation.
 * Transforms raw records into chart-ready formats.
 */
import type { SimulationResult, HourRecord, ForecastEntry } from './types';

const BASE = '/data';

export async function loadResults(): Promise<SimulationResult | null> {
  try {
    const res = await fetch(`${BASE}/results.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function loadForecastLog(): Promise<ForecastEntry[]> {
  try {
    const res = await fetch(`${BASE}/forecast_log.json`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function toTimelineRows(hours: HourRecord[]) {
  return hours.map((r) => ({
    hour: r.hour,
    label: `${String(r.hour).padStart(2, '0')}:00`,
    solar: r.state.solar,
    wind: r.state.wind,
    demand: r.state.demand,
    battery: r.outcome.battery_after.charge_level,
    grid_draw: r.outcome.grid_draw_kwh,
    curtailed: r.outcome.curtailed_kwh,
    cost: r.outcome.cost_usd,
    carbon: r.outcome.carbon_g,
    renewable_used: r.outcome.renewable_used_kwh,
    price: r.state.price,
    classification: r.decision.classification,
    action: r.decision.action,
  }));
}

export function toEnergyMixData(hours: HourRecord[]) {
  return hours.map((r) => ({
    hour: `${String(r.hour).padStart(2, '0')}:00`,
    solar: r.state.solar,
    wind: r.state.wind,
    grid: r.outcome.grid_draw_kwh,
    battery_discharge: r.outcome.battery_discharged_kwh,
    demand: r.state.demand,
  }));
}

export const ACTION_COLOR: Record<string, string> = {
  charge_battery: '#22c55e',
  discharge_battery: '#f59e0b',
  draw_from_grid: '#ef4444',
  curtail_surplus: '#8b5cf6',
};

export const ACTION_LABEL: Record<string, string> = {
  charge_battery: 'Charge Battery',
  discharge_battery: 'Discharge Battery',
  draw_from_grid: 'Draw from Grid',
  curtail_surplus: 'Curtail Surplus',
};
