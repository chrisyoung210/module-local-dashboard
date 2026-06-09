use super::acc_window::AccWindowBounds;
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

pub const OVERLAY_WINDOW_LABEL: &str = "local-dashboard-overlay";
const OVERLAY_WINDOW_URL: &str = "/?window=local-dashboard-overlay";

pub fn ensure_overlay_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        apply_overlay_window_flags(&window)?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        app,
        OVERLAY_WINDOW_LABEL,
        WebviewUrl::App(OVERLAY_WINDOW_URL.into()),
    )
    .title("ACC Coach Local Dashboard Overlay")
    .visible(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .shadow(false)
    .focused(false)
    .inner_size(1280.0, 720.0)
    .build()
    .map_err(|error| format!("Failed to create overlay window: {error}"))?;

    apply_overlay_window_flags(&window)
}

pub fn show_overlay_window(app: &tauri::AppHandle) -> Result<(), String> {
    ensure_overlay_window(app)?;
    let window = app
        .get_webview_window(OVERLAY_WINDOW_LABEL)
        .ok_or_else(|| "Overlay window is missing after creation".to_string())?;
    apply_overlay_window_flags(&window)?;
    window
        .show()
        .map_err(|error| format!("Failed to show overlay window: {error}"))
}

pub fn hide_overlay_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|error| format!("Failed to hide overlay window: {error}"))?;
    }
    Ok(())
}

pub fn set_overlay_bounds(app: &tauri::AppHandle, bounds: &AccWindowBounds) -> Result<(), String> {
    ensure_overlay_window(app)?;
    let window = app
        .get_webview_window(OVERLAY_WINDOW_LABEL)
        .ok_or_else(|| "Overlay window is missing after creation".to_string())?;
    window
        .set_position(PhysicalPosition::new(bounds.x, bounds.y))
        .map_err(|error| format!("Failed to move overlay window: {error}"))?;
    window
        .set_size(PhysicalSize::new(bounds.width, bounds.height))
        .map_err(|error| format!("Failed to resize overlay window: {error}"))
}

pub fn set_overlay_click_through(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    ensure_overlay_window(app)?;
    let window = app
        .get_webview_window(OVERLAY_WINDOW_LABEL)
        .ok_or_else(|| "Overlay window is missing after creation".to_string())?;
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|error| format!("Failed to update overlay click-through: {error}"))
}

fn apply_overlay_window_flags(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_top(true)
        .map_err(|error| format!("Failed to keep overlay always-on-top: {error}"))?;
    window
        .set_skip_taskbar(true)
        .map_err(|error| format!("Failed to hide overlay from taskbar: {error}"))?;
    window
        .set_ignore_cursor_events(true)
        .map_err(|error| format!("Failed to enable overlay click-through: {error}"))?;
    Ok(())
}
