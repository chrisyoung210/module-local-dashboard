import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DashboardControl, DashboardValuesFrame } from "./types";

interface BufferEntry {
  t: number;
  v: number;
}

export function useDashboardFrame(frameMs: number = 33) {
  const [fullFrame, setFullFrame] = useState<DashboardValuesFrame | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const historyRef = useRef<Map<string, BufferEntry[]>>(new Map());
  const fullFrameRef = useRef<Record<string, number>>({});
  const fieldCapacitiesRef = useRef<Map<string, number>>(new Map());
  const lastControlsRef = useRef<DashboardControl[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rebuildBuffers = useCallback((chartControls: DashboardControl[]) => {
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

    const buf = historyRef.current;

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

    fieldCapacitiesRef.current = nextCapacities;
    lastControlsRef.current = chartControls;
  }, []);

  const pushFrame = useCallback((frame: DashboardValuesFrame) => {
    fullFrameRef.current = { ...fullFrameRef.current, ...frame.values };
    setFullFrame({
      sampleTick: frame.sampleTick,
      timestampNs: frame.timestampNs,
      values: { ...fullFrameRef.current },
    });

    const tsMs = Math.floor(frame.timestampNs / 1_000_000);
    const buf = historyRef.current;
    const capacities = fieldCapacitiesRef.current;

    for (const [field, value] of Object.entries(frame.values)) {
      const entries = buf.get(field);
      if (!entries) continue;
      entries.push({ t: tsMs, v: value });
      const cap = capacities.get(field) ?? entries.length;
      while (entries.length > cap) {
        entries.shift();
      }
    }
    setHistoryVersion((v) => v + 1);
  }, []);

  const handleClear = useCallback(() => {
    historyRef.current.clear();
    fullFrameRef.current = {};
    setFullFrame(null);

    const controls = lastControlsRef.current;
    if (controls.length > 0) {
      rebuildBuffers(controls);
    }
  }, [rebuildBuffers]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const poll = async () => {
      try {
        const frame = await invoke<DashboardValuesFrame | null>("poll_dashboard_frame");
        if (frame) {
          pushFrame(frame);
        } else {
          handleClear();
        }
      } catch {
        // acc-coach may not have registered poll_dashboard_frame yet
      }
    };

    poll();
    intervalRef.current = setInterval(poll, frameMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pushFrame, handleClear, frameMs]);

  return {
    fullFrame,
    historyBuffer: historyRef.current,
    historyVersion,
    rebuildBuffers,
  };
}
