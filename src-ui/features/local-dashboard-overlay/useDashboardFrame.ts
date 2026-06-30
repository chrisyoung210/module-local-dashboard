import { useCallback, useEffect, useRef } from "react";
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DashboardControl, DashboardValuesFrame } from "./types";
import { createInitialGearSmootherState, smoothGear, type GearSmootherState } from "./telemetryFormat";

export interface BufferEntry {
  t: number;
  v: number;
}

export class DashboardFrameStore {
  private frame: DashboardValuesFrame | null = null;
  private historyVersion = 0;
  private historyBuffer: Map<string, BufferEntry[]> = new Map();
  private fullFrameValues: Record<string, number> = {};
  private fieldCapacities: Map<string, number> = new Map();
  private fieldVersions: Map<string, number> = new Map();
  private globalVersion = 0;
  private gearState: GearSmootherState = createInitialGearSmootherState();
  private listeners: Set<() => void> = new Set();

  getFrame = (): DashboardValuesFrame | null => this.frame;

  getHistoryVersion = (): number => this.historyVersion;

  getHistoryBuffer = (): Map<string, BufferEntry[]> => this.historyBuffer;

  getGlobalVersion = (): number => this.globalVersion;

  getFieldVersion = (field: string): number => {
    return this.fieldVersions.get(field) ?? 0;
  };

  getGearState = (): GearSmootherState => this.gearState;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setFrame(frame: DashboardValuesFrame): void {
    Object.assign(this.fullFrameValues, frame.values);
    this.frame = {
      sampleTick: frame.sampleTick,
      timestampNs: frame.timestampNs,
      values: { ...this.fullFrameValues },
    };

    const tsMs = Math.floor(frame.timestampNs / 1_000_000);
    const buf = this.historyBuffer;
    const capacities = this.fieldCapacities;

    for (const [field, value] of Object.entries(frame.values)) {
      this.fieldVersions.set(field, (this.fieldVersions.get(field) ?? 0) + 1);

      const entries = buf.get(field);
      if (!entries) continue;
      entries.push({ t: tsMs, v: value });
      const cap = capacities.get(field) ?? entries.length;
      while (entries.length > cap) {
        entries.shift();
      }
    }

    this.historyVersion++;
    this.globalVersion++;

    const gearMs = Math.floor(frame.timestampNs / 1_000_000);
    const gearValue = frame.values["gear"] ?? this.gearState.committedGear;
    this.gearState = smoothGear(this.gearState, gearValue, gearMs);

    this.listeners.forEach((l) => l());
  }

  rebuildBuffers = (chartControls: DashboardControl[]): void => {
    const nextCapacities = new Map<string, number>();
    const nextDefaults = new Map<string, number>();

    for (const control of chartControls) {
      const N = control.chartSampleCount ?? 600;
      for (const field of control.chartFields ?? []) {
        const key = field.telemetryField;
        if (!key) continue;
        const prev = nextCapacities.get(key) ?? 0;
        if (N > prev) {
          nextCapacities.set(key, N);
        }
        if (!nextDefaults.has(key)) {
          nextDefaults.set(key, field.defaultValue ?? 0);
        }
      }
    }

    const buf = this.historyBuffer;

    for (const key of buf.keys()) {
      if (!nextCapacities.has(key)) {
        buf.delete(key);
      }
    }

    for (const [key, capacity] of nextCapacities) {
      const defaultValue = nextDefaults.get(key) ?? 0;
      const buffer: BufferEntry[] = [];
      for (let i = 0; i < capacity; i++) {
        buffer.push({ t: 0, v: defaultValue });
      }
      buf.set(key, buffer);
    }

    this.fieldCapacities = nextCapacities;
  };

  clear(): void {
    this.historyBuffer.clear();
    this.fullFrameValues = {};
    this.frame = null;
    this.gearState = createInitialGearSmootherState();
    this.historyVersion++;
    this.globalVersion++;
    this.listeners.forEach((l) => l());
  }
}

const store = new DashboardFrameStore();

export function getDashboardFrameStore(): DashboardFrameStore {
  return store;
}

export function useDashboardFrame(frameMs: number = 16) {
  const fullFrame = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getFrame.bind(store),
  );
  const historyVersion = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getHistoryVersion.bind(store),
  );
  const historyBuffer = store.getHistoryBuffer();

  const flushPendingFrameRef = useRef<DashboardValuesFrame | null>(null);
  const rafScheduledRef = useRef(false);

  const handleClear = useCallback(() => {
    store.clear();
    const lastControls = lastControlsRef.current;
    if (lastControls.length > 0) {
      store.rebuildBuffers(lastControls);
    }
  }, []);

  const flushPendingFrame = useCallback(() => {
    rafScheduledRef.current = false;
    const frame = flushPendingFrameRef.current;
    if (!frame) return;
    flushPendingFrameRef.current = null;
    store.setFrame(frame);
  }, []);

  const lastControlsRef = useRef<DashboardControl[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rebuildBuffers = useCallback((chartControls: DashboardControl[]) => {
    store.rebuildBuffers(chartControls);
    lastControlsRef.current = chartControls;
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<DashboardValuesFrame>("dashboard://frame", (event) => {
      const frame = event.payload;
      if (frame && frame.values && Object.keys(frame.values).length > 0) {
        flushPendingFrameRef.current = frame;
        if (!rafScheduledRef.current) {
          rafScheduledRef.current = true;
          requestAnimationFrame(flushPendingFrame);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    }).catch(() => {
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [flushPendingFrame, handleClear]);

  useEffect(() => {
    const poll = async () => {
      try {
        const frame = await invoke<DashboardValuesFrame | null>("poll_dashboard_frame");
        if (frame) {
          flushPendingFrameRef.current = frame;
          if (!rafScheduledRef.current) {
            rafScheduledRef.current = true;
            requestAnimationFrame(flushPendingFrame);
          }
        } else {
          handleClear();
        }
      } catch {
      }
    };

    const timer = setTimeout(() => {
      poll();
      intervalRef.current = setInterval(poll, frameMs);
    }, 200);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [flushPendingFrame, handleClear, frameMs]);

  return {
    fullFrame,
    historyBuffer,
    historyVersion,
    rebuildBuffers,
    store,
  };
}
