"""
Battery state model with charge/discharge rate limits.
"""

from config import (
    BATTERY_CAPACITY_KWH,
    BATTERY_INITIAL_CHARGE_KWH,
    BATTERY_MAX_CHARGE_RATE_KWH,
    BATTERY_MAX_DISCHARGE_RATE_KWH,
)


class Battery:
    def __init__(self, initial_charge: float = BATTERY_INITIAL_CHARGE_KWH):
        self.capacity = BATTERY_CAPACITY_KWH
        self.charge_level = initial_charge
        self.max_charge_rate = BATTERY_MAX_CHARGE_RATE_KWH
        self.max_discharge_rate = BATTERY_MAX_DISCHARGE_RATE_KWH

    # ── Derived state ─────────────────────────────────────────────────────────

    @property
    def state_of_charge(self) -> float:
        """0.0–1.0"""
        return self.charge_level / self.capacity

    @property
    def available_charge_room(self) -> float:
        return self.capacity - self.charge_level

    @property
    def is_full(self) -> bool:
        return self.charge_level >= self.capacity - 0.01

    @property
    def is_empty(self) -> bool:
        return self.charge_level <= 0.01

    # ── Actions ───────────────────────────────────────────────────────────────

    def charge(self, requested_kwh: float) -> float:
        """Charge up to requested_kwh; returns actual kWh charged."""
        amount = min(requested_kwh, self.max_charge_rate, self.available_charge_room)
        amount = max(0.0, amount)
        self.charge_level += amount
        return round(amount, 3)

    def discharge(self, requested_kwh: float) -> float:
        """Discharge up to requested_kwh; returns actual kWh discharged."""
        amount = min(requested_kwh, self.max_discharge_rate, self.charge_level)
        amount = max(0.0, amount)
        self.charge_level -= amount
        return round(amount, 3)

    def snapshot(self) -> dict:
        return {
            "charge_level": round(self.charge_level, 2),
            "state_of_charge": round(self.state_of_charge, 3),
            "capacity": self.capacity,
        }
