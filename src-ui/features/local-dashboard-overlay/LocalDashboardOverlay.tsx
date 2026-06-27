import { useEffect, useMemo, useRef, useState } from "react";
import { createInitialGearSmootherState, smoothGear } from "./telemetryFormat";
import { DashboardRegionRenderer } from "./dashboardRenderer";
import { useDashboardFrame } from "./useDashboardFrame";
import { useDashboardMetadata } from "./useDashboardMetadata";
import type { DashboardControl } from "./types";
import styles from "./LocalDashboardOverlay.module.css";

export interface LocalDashboardOverlayProps {
  visible: boolean;
  viewportWidth: number;
  viewportHeight: number;
  showClosePreview?: boolean;
  onClosePreview?: () => void;
}

export function LocalDashboardOverlay({
  visible,
  viewportWidth,
  viewportHeight,
  showClosePreview,
  onClosePreview,
}: LocalDashboardOverlayProps) {
  const { activeLayouts, trackPointsCache } = useDashboardMetadata();
  const { fullFrame, historyBuffer, rebuildBuffers } = useDashboardFrame();
  const gearStateRef = useRef(createInitialGearSmootherState());
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    if (!fullFrame) {
      setDebugInfo("no frame");
      return;
    }
    const keys = Object.keys(fullFrame.values).slice(0, 20).join(", ");
    const infos: string[] = [`frame tick=${fullFrame.sampleTick} keys=[${keys}]`, `active layouts=${activeLayouts.length}`];
    for (const { layout } of activeLayouts) {
      for (const c of layout.controls) {
        if (c.widgetType !== "text" && c.widgetType !== "map") continue;
        const obj = c as unknown as Record<string, unknown>;
        const allKeys = Object.keys(obj).join(", ");
        infos.push(
          `  ctl[${c.id}] type=${c.widgetType} ALL_KEYS=[${allKeys}]`
        );
        infos.push(
          `    => telemetryField=${JSON.stringify(c.telemetryField)} textTemplate=${JSON.stringify(c.textTemplate)} trackId=${JSON.stringify(c.trackId)}`
        );
      }
    }
    setDebugInfo(infos.join("\n"));
  }, [fullFrame, activeLayouts]);

  const gearState = useMemo(() => {
    if (!fullFrame) return gearStateRef.current;
    const gearMs = Math.floor(fullFrame.timestampNs / 1_000_000);
    const gearValue = fullFrame.values["gear"] ?? fullFrame.values["raw:controls.gear"] ?? gearStateRef.current.committedGear;
    gearStateRef.current = smoothGear(gearStateRef.current, gearValue, gearMs);
    return gearStateRef.current;
  }, [fullFrame]);

  const trackPoints = useMemo(() => {
    const result: Record<string, { points: { x: number; z: number }[]; angleDeg: number; flipX: number; flipZ: number }> = {};
    for (const [trackId, data] of Object.entries(trackPointsCache)) {
      result[trackId] = {
        points: data.points,
        angleDeg: data.angleDeg,
        flipX: data.flipX,
        flipZ: data.flipZ,
      };
    }
    return result;
  }, [trackPointsCache]);

  useEffect(() => {
    const chartControls: DashboardControl[] = [];
    for (const { layout } of activeLayouts) {
      for (const control of layout.controls) {
        if (control.widgetType === "chart") {
          chartControls.push(control);
        }
      }
    }
    rebuildBuffers(chartControls);
  }, [activeLayouts, rebuildBuffers]);

  return (
    <div className={styles.overlayRoot}>
      {visible ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.85)",
            color: "#0f0",
            font: "14px monospace",
            padding: "8px 12px",
            borderRadius: "0 0 6px 0",
            maxWidth: "800px",
            maxHeight: "600px",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
          }}
        >
          {debugInfo}
        </div>
      ) : null}
      {visible && showClosePreview && onClosePreview ? (
        <button
          type="button"
          className={styles.closePreviewButton}
          aria-label="Close preview"
          onClick={onClosePreview}
        >
          ×
        </button>
      ) : null}
      <div
        className={styles.overlayContent}
        style={{
          width: viewportWidth,
          height: viewportHeight,
        }}
      >
        {visible
          ? activeLayouts.map(({ region, layout }) => (
              <DashboardRegionRenderer
                key={region.id}
                containerWidth={viewportWidth}
                containerHeight={viewportHeight}
                frame={fullFrame}
                historyBuffer={historyBuffer}
                trackPoints={trackPoints}
                gearState={gearState}
                layout={layout}
                region={region}
              />
            ))
          : null}
      </div>
    </div>
  );
}
