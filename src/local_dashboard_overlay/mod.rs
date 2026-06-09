pub mod acc_window;
pub mod config;
pub mod window;

pub fn setup(app: &tauri::App) -> Result<(), String> {
    window::ensure_overlay_window(app.handle())
}
