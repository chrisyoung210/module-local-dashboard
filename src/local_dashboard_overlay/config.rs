use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

pub const OVERLAY_CONFIG_SCHEMA: &str = "acc-coach.local-dashboard-overlay.v1";
pub const OVERLAY_CONFIG_VERSION: u32 = 1;
pub const DEFAULT_DASHBOARD_WIDTH: u32 = 3840;
pub const DEFAULT_DASHBOARD_HEIGHT: u32 = 2160;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalDashboardOverlayConfig {
    pub schema: String,
    pub version: u32,
    pub enabled: bool,
    pub auto_live: bool,
    pub hide_when_not_live: bool,
    pub follow_acc_window: bool,
    pub click_through: bool,
    #[serde(default = "default_dashboard_width")]
    pub dashboard_width: u32,
    #[serde(default = "default_dashboard_height")]
    pub dashboard_height: u32,
    pub polling: OverlayPollingConfig,
    pub regions: Vec<OverlayRegionConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPollingConfig {
    pub status_ms: u64,
    pub frame_ms: u64,
    pub window_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayRegionConfig {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub layout_id: String,
    pub anchor: OverlayAnchor,
    pub offset_x: f64,
    pub offset_y: f64,
    pub scale: f64,
    pub z_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OverlayAnchor {
    TopLeft,
    TopCenter,
    TopRight,
    CenterLeft,
    Center,
    CenterRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

impl Default for LocalDashboardOverlayConfig {
    fn default() -> Self {
        Self {
            schema: OVERLAY_CONFIG_SCHEMA.to_string(),
            version: OVERLAY_CONFIG_VERSION,
            enabled: true,
            auto_live: true,
            hide_when_not_live: true,
            follow_acc_window: true,
            click_through: true,
            dashboard_width: DEFAULT_DASHBOARD_WIDTH,
            dashboard_height: DEFAULT_DASHBOARD_HEIGHT,
            polling: OverlayPollingConfig::default(),
            regions: Vec::new(),
        }
    }
}

impl Default for OverlayPollingConfig {
    fn default() -> Self {
        Self {
            status_ms: 500,
            frame_ms: 33,
            window_ms: 500,
        }
    }
}

impl LocalDashboardOverlayConfig {
    pub fn load_or_create(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            let config = Self::default().normalized();
            config.save(path)?;
            return Ok(config);
        }

        let raw = fs::read_to_string(path)
            .map_err(|error| format!("Failed to read overlay config: {error}"))?;
        let config: Self = serde_json::from_str(&raw)
            .map_err(|error| format!("Failed to parse overlay config: {error}"))?;
        config.validate_identity()?;
        Ok(config.normalized())
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        self.validate_identity()?;
        let config = self.clone().normalized();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create overlay config directory: {error}"))?;
        }
        let json = serde_json::to_string_pretty(&config)
            .map_err(|error| format!("Failed to serialize overlay config: {error}"))?;
        fs::write(path, json).map_err(|error| format!("Failed to write overlay config: {error}"))
    }

    pub fn normalized(mut self) -> Self {
        self.polling.status_ms = self.polling.status_ms.clamp(250, 5000);
        self.polling.frame_ms = self.polling.frame_ms.clamp(16, 1000);
        self.polling.window_ms = self.polling.window_ms.clamp(250, 5000);
        self.dashboard_width = self.dashboard_width.clamp(1, 16_384);
        self.dashboard_height = self.dashboard_height.clamp(1, 16_384);

        let timestamp = current_time_millis();
        for (index, region) in self.regions.iter_mut().enumerate() {
            if region.id.trim().is_empty() {
                region.id = format!("region-{timestamp}-{index}");
            }
            if region.name.trim().is_empty() {
                region.name = "Dashboard Region".to_string();
            }
            region.scale = region.scale.clamp(0.1, 5.0);
        }

        self
    }

    fn validate_identity(&self) -> Result<(), String> {
        if self.schema != OVERLAY_CONFIG_SCHEMA {
            return Err(format!(
                "Unsupported overlay config schema: {}",
                self.schema
            ));
        }
        if self.version != OVERLAY_CONFIG_VERSION {
            return Err(format!(
                "Unsupported overlay config version: {}",
                self.version
            ));
        }
        Ok(())
    }
}

fn default_dashboard_width() -> u32 {
    DEFAULT_DASHBOARD_WIDTH
}

fn default_dashboard_height() -> u32 {
    DEFAULT_DASHBOARD_HEIGHT
}

fn current_time_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf};

    fn temp_config_path(name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "acc_coach_overlay_{name}_{}.json",
            current_time_millis()
        ));
        path
    }

    #[test]
    fn default_config_serializes_with_schema_and_version() {
        let config = LocalDashboardOverlayConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains(OVERLAY_CONFIG_SCHEMA));
        assert!(json.contains("\"version\":1"));
        assert_eq!(config.polling.frame_ms, 33);
    }

    #[test]
    fn load_or_create_writes_missing_config() {
        let path = temp_config_path("missing");
        let config = LocalDashboardOverlayConfig::load_or_create(&path).unwrap();
        assert_eq!(config, LocalDashboardOverlayConfig::default());
        assert!(path.exists());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn invalid_schema_is_rejected() {
        let mut config = LocalDashboardOverlayConfig::default();
        config.schema = "other".to_string();
        assert!(config.save(&temp_config_path("schema")).is_err());
    }

    #[test]
    fn invalid_version_is_rejected() {
        let mut config = LocalDashboardOverlayConfig::default();
        config.version = 2;
        assert!(config.save(&temp_config_path("version")).is_err());
    }

    #[test]
    fn corrupt_json_does_not_overwrite_existing_file() {
        let path = temp_config_path("corrupt");
        fs::write(&path, "{not json").unwrap();
        assert!(LocalDashboardOverlayConfig::load_or_create(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "{not json");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn normalization_clamps_polling_and_region_scale() {
        let config = LocalDashboardOverlayConfig {
            polling: OverlayPollingConfig {
                status_ms: 1,
                frame_ms: 5000,
                window_ms: 99,
            },
            regions: vec![OverlayRegionConfig {
                id: String::new(),
                name: String::new(),
                enabled: true,
                layout_id: String::new(),
                anchor: OverlayAnchor::BottomCenter,
                offset_x: 0.0,
                offset_y: 0.0,
                scale: 10.0,
                z_index: 1,
            }],
            ..LocalDashboardOverlayConfig::default()
        }
        .normalized();

        assert_eq!(config.polling.status_ms, 250);
        assert_eq!(config.polling.frame_ms, 1000);
        assert_eq!(config.polling.window_ms, 250);
        assert_eq!(config.regions[0].scale, 5.0);
        assert!(!config.regions[0].id.is_empty());
    }

    #[test]
    fn normalization_allows_sixty_hz_frame_interval() {
        let mut config = LocalDashboardOverlayConfig::default();
        config.polling.frame_ms = 16;

        assert_eq!(config.normalized().polling.frame_ms, 16);
    }
}
