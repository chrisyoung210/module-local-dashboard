export type OverlayAnchor =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "centerLeft"
  | "center"
  | "centerRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

export interface LocalDashboardOverlayConfig {
  schema: "acc-coach.local-dashboard-overlay.v1";
  version: 1;
  enabled: boolean;
  autoLive: boolean;
  hideWhenNotLive: boolean;
  followAccWindow: boolean;
  clickThrough: boolean;
  dashboardWidth: number;
  dashboardHeight: number;
  polling: OverlayPollingConfig;
  regions: OverlayRegionConfig[];
}

export interface OverlayPollingConfig {
  statusMs: number;
  frameMs: number;
  windowMs: number;
}

export interface OverlayRegionConfig {
  id: string;
  name: string;
  enabled: boolean;
  layoutId: string;
  anchor: OverlayAnchor;
  offsetX: number;
  offsetY: number;
  scale: number;
  zIndex: number;
}

export interface AccWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  matchedBy: "title" | "fallback";
}

export interface AutoRecordingStatus {
  live: boolean;
  paused: boolean;
  connected: boolean;
}

export interface LiveFrame {
  speedKmh: number;
  brakePct: number;
  throttlePct: number;
  gear: number;
  rpm: number;
  steeringDeg: number;
  distanceM: number;
  currentLapDistanceM: number | null;
  speedIntegratedLapDistanceM: number | null;
  lapNumber: number;
  position: number;
  sessionTimeLeftS: number;
  inPit: boolean;
  trackName: string | null;
  carModel: string | null;
  timestampMs: number;
  currentLapTimeMs: number | null;
  normalizedCarPosition: number | null;
  bestLapDeltaTimeMs: number | null;
  predictedLapTimeByBest: number | null;
  sessionLapDeltaTimeMs: number | null;
  predictedLapTimeBySession: number | null;
}

export type DashboardTextFormat =
  | "number"
  | "integer"
  | "delta"
  | "lapTime"
  | "percent"
  | "gear";

export interface RegisteredDashboardLayout {
  id: string;
  name: string;
  payload: DashboardLayoutPayload;
}

export interface DashboardLayoutPayload {
  canvasWidth: number;
  canvasHeight: number;
  imageMime: string;
  staticImageBase64: string;
  dynamicControls: DashboardControl[];
}

export interface DashboardControl {
  id: string;
  telemetryField?: keyof LiveFrame | string;
  textTemplate?: string;
  format?: DashboardTextFormat | string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  textColor: string;
  backgroundColor?: string | null;
  conditionalRules?: DashboardConditionalRule[];
}

export interface DashboardConditionalRule {
  target: "textColor" | "backgroundColor" | string;
  telemetryField: keyof LiveFrame | string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | string;
  compareValue: number;
  color: string;
}

export interface RegionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
