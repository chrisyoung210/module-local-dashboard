pub mod local_dashboard_overlay;

pub use local_dashboard_overlay::{
    acc_window::{AccWindowBounds, AccWindowMatchedBy},
    config::{
        LocalDashboardOverlayConfig, OverlayAnchor, OverlayPollingConfig, OverlayRegionConfig,
        OVERLAY_CONFIG_SCHEMA, OVERLAY_CONFIG_VERSION,
    },
    frame_bus::{debug_log, DashboardFrameBus},
};
