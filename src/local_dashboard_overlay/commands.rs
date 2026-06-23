use std::path::PathBuf;
use tauri::Manager;

use super::acc_window::{find_acc_window_bounds, AccWindowBounds};
use super::config::LocalDashboardOverlayConfig;
use super::window;

const DASHBOARD_LOG_ENV: &str = "ACC_COACH_DASHBOARD_LOG";

fn dashboard_log_enabled() -> bool {
    std::env::var(DASHBOARD_LOG_ENV)
        .map(|value| {
            let value = value.trim().to_ascii_lowercase();
            !value.is_empty() && !matches!(value.as_str(), "0" | "false" | "off" | "no")
        })
        .unwrap_or(false)
}

fn log_overlay_command(message: &str) {
    if dashboard_log_enabled() {
        eprintln!("[acc-coach local dashboard overlay] {message}");
    }
}

fn overlay_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    Ok(app_data_dir.join("local_dashboard_overlay.json"))
}

pub async fn get_local_dashboard_overlay_config(
    app: tauri::AppHandle,
) -> Result<LocalDashboardOverlayConfig, String> {
    let path = overlay_config_path(&app)?;
    LocalDashboardOverlayConfig::load_or_create(&path)
}

pub async fn save_local_dashboard_overlay_config(
    app: tauri::AppHandle,
    config: LocalDashboardOverlayConfig,
) -> Result<LocalDashboardOverlayConfig, String> {
    let path = overlay_config_path(&app)?;
    config.save(&path)?;
    LocalDashboardOverlayConfig::load_or_create(&path)
}

pub async fn get_acc_window_bounds() -> Result<Option<AccWindowBounds>, String> {
    find_acc_window_bounds()
}

pub async fn show_local_dashboard_overlay(app: tauri::AppHandle) -> Result<(), String> {
    log_overlay_command("show");
    window::show_overlay_window(&app)
}

pub async fn hide_local_dashboard_overlay(app: tauri::AppHandle) -> Result<(), String> {
    log_overlay_command("hide");
    window::hide_overlay_window(&app)
}

pub async fn set_local_dashboard_overlay_bounds(
    app: tauri::AppHandle,
    bounds: AccWindowBounds,
) -> Result<(), String> {
    log_overlay_command(&format!(
        "bounds x={} y={} width={} height={} title={} matchedBy={:?}",
        bounds.x, bounds.y, bounds.width, bounds.height, bounds.title, bounds.matched_by
    ));
    window::set_overlay_bounds(&app, &bounds)
}

pub async fn set_local_dashboard_overlay_click_through(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    log_overlay_command(&format!("clickThrough enabled={enabled}"));
    window::set_overlay_click_through(&app, enabled)
}
