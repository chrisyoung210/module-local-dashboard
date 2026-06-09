import { DashboardRegionRenderer } from "./dashboardRenderer";
import type {
  LiveFrame,
  LocalDashboardOverlayConfig,
  RegisteredDashboardLayout
} from "./types";
import styles from "./LocalDashboardOverlay.module.css";

const previewFrame: LiveFrame = {
  speedKmh: 164,
  brakePct: 0,
  throttlePct: 73,
  gear: 4,
  rpm: 7420,
  steeringDeg: 0,
  distanceM: 0,
  currentLapDistanceM: 1320,
  speedIntegratedLapDistanceM: 1320,
  lapNumber: 8,
  position: 3,
  sessionTimeLeftS: 622,
  inPit: false,
  trackName: "Monza",
  carModel: "McLaren 720S GT3 Evo",
  timestampMs: 1000,
  currentLapTimeMs: 68326,
  normalizedCarPosition: 0.42,
  bestLapDeltaTimeMs: -180,
  predictedLapTimeByBest: 108326,
  sessionLapDeltaTimeMs: 320,
  predictedLapTimeBySession: 108820
};

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
                layout={layout}
                region={region}
              />
            );
          })}
      </div>
    </section>
  );
}
