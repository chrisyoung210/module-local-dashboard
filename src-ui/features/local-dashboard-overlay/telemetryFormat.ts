import type { DashboardTextFormat } from "./types";

export const GEAR_DEBOUNCE_MS = 150;

export function formatTelemetryValue(
  value: unknown,
  format: DashboardTextFormat | string | undefined
): string {
  if (value === null || value === undefined) {
    return "--";
  }

  switch (format) {
    case "delta":
      return formatDelta(value);
    case "lapTime":
      return formatLapTime(value);
    case "percent":
      return `${Math.round(Number(value))}%`;
    case "integer":
      return `${Math.round(Number(value))}`;
    case "gear":
      return formatGear(Number(value));
    case "number":
      return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : String(value);
    default:
      return String(value);
  }
}

export function formatDelta(value: unknown): string {
  if (value === null || value === undefined) return "--";
  const ms = Number(value);
  if (!Number.isFinite(ms)) return "--";
  const seconds = ms / 1000;
  const sign = seconds > 0 ? "+" : "";
  return `${sign}${seconds.toFixed(2)}s`;
}

export function formatLapTime(value: unknown): string {
  if (value === null || value === undefined) return "--";
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

export function formatGear(rawGear: number): string {
  if (rawGear < 0) return "R";
  if (rawGear === 0) return "N";
  return `${rawGear}`;
}

export interface GearSmootherState {
  committedGear: number;
  neutralSinceMs: number | null;
}

export function createInitialGearSmootherState(initialGear = 0): GearSmootherState {
  return {
    committedGear: initialGear,
    neutralSinceMs: null
  };
}

export function smoothGear(
  state: GearSmootherState,
  rawGear: number,
  timestampMs: number,
  debounceMs = GEAR_DEBOUNCE_MS
): GearSmootherState {
  if (rawGear > 0 || rawGear < 0) {
    return {
      committedGear: rawGear,
      neutralSinceMs: null
    };
  }

  if (state.committedGear > 0) {
    const neutralSinceMs = state.neutralSinceMs ?? timestampMs;
    if (timestampMs - neutralSinceMs < debounceMs) {
      return {
        committedGear: state.committedGear,
        neutralSinceMs
      };
    }
  }

  return {
    committedGear: 0,
    neutralSinceMs: null
  };
}
