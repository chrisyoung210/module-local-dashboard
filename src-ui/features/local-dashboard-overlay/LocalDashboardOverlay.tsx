import { useEffect, useMemo } from "react";
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
  const { config, activeLayouts, trackPointsCache } = useDashboardMetadata();
  const { historyBuffer, historyVersion, rebuildBuffers, store } = useDashboardFrame(config?.polling.frameMs ?? 33);

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
                  store={store}
                  historyBuffer={historyBuffer}
                  historyVersion={historyVersion}
                  trackPoints={trackPoints}
                  layout={layout}
                  region={region}
                />
            ))
          : null}
      </div>
    </div>
  );
}
