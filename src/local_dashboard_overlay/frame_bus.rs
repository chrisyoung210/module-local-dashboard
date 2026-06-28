use std::sync::Mutex;

use module_dashboard_protocol::DashboardValuesFrame;

pub struct DashboardFrameBus {
    inner: Mutex<Option<DashboardValuesFrame>>,
}

impl DashboardFrameBus {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub fn push_frame(&self, frame: &DashboardValuesFrame) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = Some(frame.clone());
        }
    }

    pub fn latest_frame(&self) -> Option<DashboardValuesFrame> {
        self.inner.lock().ok()?.clone()
    }

    pub fn clear(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = None;
        }
    }
}
