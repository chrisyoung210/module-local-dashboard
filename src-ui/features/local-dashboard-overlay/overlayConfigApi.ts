import { invoke } from "@tauri-apps/api/core";
import type {
  AccWindowBounds,
  LocalDashboardOverlayConfig,
} from "./types";

export async function getLocalDashboardOverlayConfig(): Promise<LocalDashboardOverlayConfig> {
  return invoke<LocalDashboardOverlayConfig>("get_local_dashboard_overlay_config");
}

export async function saveLocalDashboardOverlayConfig(
  config: LocalDashboardOverlayConfig
): Promise<LocalDashboardOverlayConfig> {
  return invoke<LocalDashboardOverlayConfig>("save_local_dashboard_overlay_config", { config });
}

export async function getAccWindowBounds(): Promise<AccWindowBounds | null> {
  return invoke<AccWindowBounds | null>("get_acc_window_bounds");
}

export async function showLocalDashboardOverlay(): Promise<void> {
  return invoke("show_local_dashboard_overlay");
}

export async function hideLocalDashboardOverlay(): Promise<void> {
  return invoke("hide_local_dashboard_overlay");
}

export async function setLocalDashboardOverlayBounds(bounds: AccWindowBounds): Promise<void> {
  return invoke("set_local_dashboard_overlay_bounds", { bounds });
}

export async function setLocalDashboardOverlayClickThrough(enabled: boolean): Promise<void> {
  return invoke("set_local_dashboard_overlay_click_through", { enabled });
}
