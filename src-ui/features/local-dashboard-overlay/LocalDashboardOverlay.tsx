import { useMemo } from "react";
import type { GearSmootherState } from "./telemetryFormat";
import type {
  LiveFrame,
  LocalDashboardOverlayConfig,
  RegisteredDashboardLayout
} from "./types";
import { DashboardRegionRenderer } from "./dashboardRenderer";
import styles from "./LocalDashboardOverlay.module.css";

export interface LocalDashboardOverlayProps {
  config: LocalDashboardOverlayConfig;
  containerWidth: number;
  containerHeight: number;
  displayScale?: number;
  frame: LiveFrame | null;
  gearState?: GearSmootherState;
  layouts: RegisteredDashboardLayout[];
  onClosePreview?: () => void;
  showClosePreview?: boolean;
  visible: boolean;
}

export function LocalDashboardOverlay({
  config,
  containerHeight,
  containerWidth,
  displayScale = 1,
  frame,
  gearState,
  layouts,
  onClosePreview,
  showClosePreview = false,
  visible
}: LocalDashboardOverlayProps) {
  const enabledRegions = useMemo(
    () => config.regions.filter((region) => region.enabled && region.layoutId),
    [config]
  );

  const layoutMap = useMemo(
    () => new Map(layouts.map((layout) => [layout.id, layout.payload])),
    [layouts]
  );

  return (
    <div className={styles.overlayRoot}>
      {showClosePreview ? (
        <button
          aria-label="Close dashboard preview"
          className={styles.closePreviewButton}
          onClick={onClosePreview}
          type="button"
        >
          ×
        </button>
      ) : null}
      <div
        className={styles.overlayContent}
        style={{
          width: containerWidth,
          height: containerHeight,
          transform: `scale(${displayScale})`
        }}
      >
        {visible
          ? enabledRegions.map((region) => {
              const layout = layoutMap.get(region.layoutId);
              if (!layout) return null;
              return (
                <DashboardRegionRenderer
                  key={region.id}
                  containerWidth={containerWidth}
                  containerHeight={containerHeight}
                  frame={frame}
                  gearState={gearState}
                  layout={layout}
                  region={region}
                />
              );
            })
          : null}
      </div>
    </div>
  );
}
