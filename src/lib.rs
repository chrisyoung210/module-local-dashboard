pub mod local_dashboard_overlay;

pub use local_dashboard_overlay::{
    acc_window::{AccWindowBounds, AccWindowMatchedBy},
    commands::{
        get_acc_window_bounds, get_local_dashboard_overlay_config, hide_local_dashboard_overlay,
        save_local_dashboard_overlay_config, set_local_dashboard_overlay_bounds,
        set_local_dashboard_overlay_click_through, show_local_dashboard_overlay,
    },
    config::{
        LocalDashboardOverlayConfig, OverlayAnchor, OverlayPollingConfig, OverlayRegionConfig,
        OVERLAY_CONFIG_SCHEMA, OVERLAY_CONFIG_VERSION,
    },
};
