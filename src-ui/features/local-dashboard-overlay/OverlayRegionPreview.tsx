import { DashboardRegionRenderer } from "./dashboardRenderer";
import type {
  DashboardValuesFrame,
  LocalDashboardOverlayConfig,
  RegisteredDashboardLayout
} from "./types";
import styles from "./LocalDashboardOverlay.module.css";

const previewFrame: DashboardValuesFrame = {
  sampleTick: 0,
  timestampNs: 1_000_000_000,
  values: {
    speedKmh: 164,
    brakePct: 0,
    throttlePct: 73,
    gear: 5,
    rpm: 7420,
    steeringDeg: 0,
    distanceM: 0,
    currentLapDistanceM: 1320,
    lapNumber: 8,
    position: 3,
    sessionTimeLeftS: 622,
    normalizedCarPosition: 0.42,
    bestLapDeltaTimeMs: -180,
    sessionLapDeltaTimeMs: 320,
  },
};

const emptyHistoryBuffer = new Map();
const emptyTrackPoints: Record<string, { points: { x: number; z: number }[]; angleDeg: number; flipX: number; flipZ: number }> = {};

export function OverlayRegionPreview({
  config,
  layouts,
  width,
  height
}: {
  config: LocalDashboardOverlayConfig;
  layouts: RegisteredDashboardLayout[];
  width: number;
  height: number;
}) {
  const layoutMap = new Map(layouts.map((layout) => [layout.id, layout.payload]));

  return (
    <section className={styles.previewShell}>
      <div className={styles.previewHeader}>
        <h2>Composition Preview</h2>
      </div>
      <div className={styles.previewFrame}>
        {config.regions
          .filter((region) => region.enabled)
          .map((region) => {
            const layout = layoutMap.get(region.layoutId);
            if (!layout) return null;
            return (
              <DashboardRegionRenderer
                key={region.id}
                containerWidth={width}
                containerHeight={height}
                frame={previewFrame}
                historyBuffer={emptyHistoryBuffer}
                historyVersion={0}
                trackPoints={emptyTrackPoints}
                layout={layout}
                region={region}
              />
            );
          })}
      </div>
    </section>
  );
}
