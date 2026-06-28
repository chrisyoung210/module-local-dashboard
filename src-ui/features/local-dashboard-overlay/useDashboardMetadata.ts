import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type {
  DashboardLayoutPayload,
  LocalDashboardOverlayConfig,
  OverlayRegionConfig,
} from "./types";

export interface TrackPointsData {
  points: { x: number; z: number }[];
  angleDeg: number;
  flipX: number;
  flipZ: number;
}

interface ResolvedLayout {
  region: OverlayRegionConfig;
  layout: DashboardLayoutPayload;
}

interface WireRegisteredDashboardLayout {
  layoutId: string;
  name: string;
  registeredAt: string;
  layout: DashboardLayoutPayload;
}

// Module-level cache shared across all hook instances.
// In multi-window scenarios, all instances share the same cache.
// Tests should avoid relying on pre-populated cache state.

export function useDashboardMetadata() {
  const [config, setConfig] = useState<LocalDashboardOverlayConfig | null>(null);
  const [activeLayouts, setActiveLayouts] = useState<ResolvedLayout[]>([]);
  const [trackPointsCache, setTrackPointsCache] =
    useState<Record<string, TrackPointsData>>({});

  const resolveActiveLayouts = useCallback(
    (cfg: LocalDashboardOverlayConfig, allLayouts: WireRegisteredDashboardLayout[]) => {
      const active: ResolvedLayout[] = [];
      for (const region of cfg.regions) {
        if (!region.enabled || !region.layoutId) continue;
        const match = allLayouts.find((l) => l.layoutId === region.layoutId);
        if (match) {
          active.push({ region, layout: match.layout });
        }
      }
      setActiveLayouts(active);
    },
    [],
  );

  const loadMetadata = useCallback(async () => {
    try {
      const [cfg, rawLayouts] = await Promise.all([
        invoke<LocalDashboardOverlayConfig>("get_local_dashboard_overlay_config"),
        invoke<WireRegisteredDashboardLayout[]>("list_registered_dashboard_layouts"),
      ]);
      const allLayouts = rawLayouts || [];
      setConfig(cfg);
      resolveActiveLayouts(cfg, allLayouts);
    } catch {
      // IPC commands may not be registered yet
    }
  }, [resolveActiveLayouts]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    const onFocus = () => {
      invoke<WireRegisteredDashboardLayout[]>("list_registered_dashboard_layouts")
        .then((rawLayouts) => {
          const allLayouts = rawLayouts || [];
          if (config) {
            resolveActiveLayouts(config, allLayouts);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [config, resolveActiveLayouts]);

  const trackPointsCacheRef = useRef<Record<string, TrackPointsData>>({});

  const loadTrackMap = useCallback(async (trackId: string) => {
    const cache = trackPointsCacheRef.current;
    if (cache[trackId]) {
      setTrackPointsCache({ ...cache });
      return;
    }
    try {
      const record = await invoke<{
        pointsJson: string;
        angleDeg: number;
        flipX: number;
        flipZ: number;
      } | null>("get_track_map", { trackId });
      if (record?.pointsJson) {
        const points = JSON.parse(record.pointsJson) as { x: number; z: number }[];
        const data: TrackPointsData = {
          points,
          angleDeg: record.angleDeg ?? 0,
          flipX: record.flipX ?? 1,
          flipZ: record.flipZ ?? 1,
        };
        trackPointsCacheRef.current[trackId] = data;
        setTrackPointsCache({ ...trackPointsCacheRef.current });
      }
    } catch {
      // track map may not be available
    }
  }, []);

  const prefetchTrackMaps = useCallback(
    (resolvedLayouts: ResolvedLayout[]) => {
      const seen = new Set<string>();
      for (const { layout } of resolvedLayouts) {
        for (const control of layout.controls) {
          if (control.widgetType !== "map") continue;
          const tid = control.trackId || "monza";
          if (!seen.has(tid)) {
            seen.add(tid);
            loadTrackMap(tid);
          }
        }
      }
    },
    [loadTrackMap],
  );

  const lastPrefetchedRef = useRef<string>("");
  useEffect(() => {
    const key = activeLayouts
      .flatMap((al) => al.layout.controls.filter((c) => c.widgetType === "map").map((c) => c.trackId ?? "monza"))
      .sort()
      .join(",");
    if (key !== lastPrefetchedRef.current) {
      lastPrefetchedRef.current = key;
      prefetchTrackMaps(activeLayouts);
    }
  }, [activeLayouts, prefetchTrackMaps]);

  return {
    config,
    activeLayouts,
    trackPointsCache,
    reload: loadMetadata,
  };
}
