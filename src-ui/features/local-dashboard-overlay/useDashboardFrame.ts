import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DashboardControl, DashboardValuesFrame } from "./types";

interface BufferEntry {
  t: number;
  v: number;
}

export function useDashboardFrame() {
  const [fullFrame, setFullFrame] = useState<DashboardValuesFrame | null>(null);
  const historyRef = useRef<Map<string, BufferEntry[]>>(new Map());
  const fullFrameRef = useRef<Record<string, number>>({});
  const rafRef = useRef<number>(0);
  const fieldCapacitiesRef = useRef<Map<string, number>>(new Map());
  const lastControlsRef = useRef<DashboardControl[]>([]);

  const rebuildBuffers = useCallback((chartControls: DashboardControl[]) => {
    const nextCapacities = new Map<string, number>();
    const nextDefaults = new Map<string, number>();

    for (const control of chartControls) {
      const N = (control as any).chartSampleCount ?? control.chartSampleCount ?? 600;
      for (const field of control.chartFields ?? []) {
        const key = (field as any).telemetryField ?? "";
        if (!key) continue;
        const prev = nextCapacities.get(key) ?? 0;
        if (N > prev) {
          nextCapacities.set(key, N);
        }
        if (!nextDefaults.has(key)) {
          nextDefaults.set(key, (field as any).defaultValue ?? field.defaultValue ?? 0);
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

  const pollLogRef = useRef({ firstFrame: true, lastLogTime: 0 });

  useEffect(() => {
    let running = true;

    const poll = async () => {
      if (!running) return;
      try {
        const frame = await invoke<DashboardValuesFrame | null>("poll_dashboard_frame");
        if (frame) {
          const now = Date.now();
          if (pollLogRef.current.firstFrame || now - pollLogRef.current.lastLogTime >= 2000) {
            console.log("[DEBUG poll] received frame, sampleTick=", frame.sampleTick, "values keys:", Object.keys(frame.values));
            pollLogRef.current.lastLogTime = now;
            pollLogRef.current.firstFrame = false;
          }
          pushFrame(frame);
        } else {
          handleClear();
        }
      } catch {
        // acc-coach may not have registered poll_dashboard_frame yet
      }
      if (running) {
        rafRef.current = requestAnimationFrame(poll);
      }
    };

    poll();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [pushFrame, handleClear]);

  return {
    fullFrame,
    historyBuffer: historyRef.current,
    rebuildBuffers,
  };
}
