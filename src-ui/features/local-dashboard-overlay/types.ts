// ── Protocol types (imported from module_dashboard_protocol/types) ──

export type {
  ChartFieldConfig,
  DashboardConditionalRule,
  DashboardControl,
  DashboardLayoutPayload,
  DashboardTextFormat,
  DashboardTextFormatOrRaw,
  DashboardValuesFrame,
  RegisteredDashboardLayout,
  WidgetType,
} from "module_dashboard_protocol/types";



// ── Module-owned types ──

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

// ── Renderer types ──

export interface RegionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Chart history point injected by the main module. */
export interface FieldHistoryPoint {
  t: number;
  v: number;
}

/** Per-field chart history buffer injected by the main module. */
export interface FieldHistory {
  field_name: string;
  points: FieldHistoryPoint[];
}
