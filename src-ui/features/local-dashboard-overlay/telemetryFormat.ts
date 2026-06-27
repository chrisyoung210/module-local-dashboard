import type { DashboardTextFormat } from "module_dashboard_protocol/types";

export type { DashboardTextFormat };

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
    default: {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        // 整数补零格式 (如 "0", "00", "000") — spec 10.3 步骤 2，先于时间格式
        if (/^0+$/.test(format ?? "")) {
          const integer = Math.round(numeric);
          const sign = integer < 0 ? "-" : "";
          return `${sign}${String(Math.abs(integer)).padStart(format!.length, "0")}`;
        }
        // 原始时间格式串 — spec 10.3 步骤 3（输入值均为毫秒，除以 1000 后格式化）
        const timeMatch = /^(m:)?(ss|s)\.(ff|fff)$/.exec(format ?? "");
        if (timeMatch) {
          const secondsValue = numeric / 1000;
          const sign = secondsValue < 0 ? "-" : "";
          const absSeconds = Math.abs(secondsValue);
          const fractionDigits = timeMatch[3].length; // "ff"=2, "fff"=3
          const fractionScale = 10 ** fractionDigits;
          let totalWholeSeconds = Math.floor(absSeconds);
          let fraction = Math.round((absSeconds - totalWholeSeconds) * fractionScale);
          if (fraction >= fractionScale) { totalWholeSeconds++; fraction = 0; }
          const fractionText = String(fraction).padStart(fractionDigits, "0");
          if (timeMatch[1]) {
            // "m:" 前缀存在
            const minutes = Math.floor(totalWholeSeconds / 60);
            const secs = String(totalWholeSeconds % 60).padStart(2, "0");
            return `${sign}${minutes}:${secs}.${fractionText}`;
          }
          const secs = timeMatch[2] === "ss"
            ? String(totalWholeSeconds % 60).padStart(2, "0")
            : String(totalWholeSeconds % 60);
          return `${sign}${secs}.${fractionText}`;
        }
      }
      // spec 10.3 步骤 4: 降级为 String(value)
      return String(value);
    }
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
  if (rawGear <= 0) return "R";
  if (rawGear === 1) return "N";
  return `${rawGear - 1}`;
}

export interface GearSmootherState {
  committedGear: number;
  neutralSinceMs: number | null;
}

export function createInitialGearSmootherState(initialGear = 1): GearSmootherState {
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
  if (rawGear !== 1) {
    return {
      committedGear: rawGear,
      neutralSinceMs: null
    };
  }

  if (state.committedGear >= 2) {
    const neutralSinceMs = state.neutralSinceMs ?? timestampMs;
    if (timestampMs - neutralSinceMs < debounceMs) {
      return {
        committedGear: state.committedGear,
        neutralSinceMs
      };
    }
  }

  return {
    committedGear: 1,
    neutralSinceMs: null
  };
}
