import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DashboardControl, DashboardValuesFrame } from "./types";

interface BufferEntry {
  t: number;
  v: number;
}

export function useDashboardFrame(frameMs: number = 16) {
  const [fullFrame, setFullFrame] = useState<DashboardValuesFrame | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const historyRef = useRef<Map<string, BufferEntry[]>>(new Map());
  const fullFrameRef = useRef<Record<string, number>>({});
  const fieldCapacitiesRef = useRef<Map<string, number>>(new Map());
  const lastControlsRef = useRef<DashboardControl[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingFrameRef = useRef<DashboardValuesFrame | null>(null);
  const rafScheduledRef = useRef(false);

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

  const flushPendingFrame = useCallback(() => {
    rafScheduledRef.current = false;
    const frame = pendingFrameRef.current;
    if (!frame) return;
    pendingFrameRef.current = null;
    pushFrame(frame);
  }, [pushFrame]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<DashboardValuesFrame>("dashboard://frame", (event) => {
      const frame = event.payload;
      if (frame && frame.values && Object.keys(frame.values).length > 0) {
        pendingFrameRef.current = frame;
        if (!rafScheduledRef.current) {
          rafScheduledRef.current = true;
          requestAnimationFrame(flushPendingFrame);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    }).catch(() => {
      // listen failed, polling fallback will handle it
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
          pendingFrameRef.current = frame;
          if (!rafScheduledRef.current) {
            rafScheduledRef.current = true;
            requestAnimationFrame(flushPendingFrame);
          }
        } else {
          handleClear();
        }
      } catch {
        // acc-coach may not have registered poll_dashboard_frame yet
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
    historyBuffer: historyRef.current,
    historyVersion,
    rebuildBuffers,
  };
}
