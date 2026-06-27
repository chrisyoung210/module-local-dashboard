use std::io::Write;
use std::sync::Mutex;

use module_dashboard_protocol::DashboardValuesFrame;

const LOG_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "\\ld_debug.log");

pub fn debug_log(msg: &str) {
    eprint!("{}", msg);
    // create parent dir if needed, then write
    let path = std::path::Path::new(LOG_PATH);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(LOG_PATH)
        .and_then(|mut f| f.write_all(msg.as_bytes()));
}

pub struct DashboardFrameBus {
    inner: Mutex<Option<DashboardValuesFrame>>,
    push_count: Mutex<u64>,
    pull_count: Mutex<u64>,
}

impl DashboardFrameBus {
    pub fn new() -> Self {
        debug_log("[DEBUG frame_bus] DashboardFrameBus created\n");
        Self {
            inner: Mutex::new(None),
            push_count: Mutex::new(0),
            pull_count: Mutex::new(0),
        }
    }

    pub fn push_frame(&self, frame: &DashboardValuesFrame) {
        let count = {
            let mut c = self.push_count.lock().unwrap();
            *c += 1;
            *c
        };
        // log first frame + every 500th
        if count == 1 || count % 500 == 0 {
            let keys: Vec<_> = frame.values.keys().cloned().collect();
            let msg = format!(
                "[DEBUG frame_bus] push_frame #{}, sample_tick={}, values keys: {:?}\n",
                count, frame.sample_tick, keys
            );
            debug_log(&msg);
        }

        if let Ok(mut guard) = self.inner.lock() {
            *guard = Some(frame.clone());
        }
    }

    pub fn latest_frame(&self) -> Option<DashboardValuesFrame> {
        let opt = self.inner.lock().ok()?.clone();
        // log only on first pull and every 600th pull to avoid spam
        let should_log = {
            let mut c = self.pull_count.lock().unwrap();
            *c += 1;
            *c == 1 || *c % 600 == 0
        };
        if should_log {
            match &opt {
                Some(frame) => {
                    let msg = format!(
                        "[DEBUG frame_bus] latest_frame #{} -> Some(sample_tick={}, keys: {:?})\n",
                        self.pull_count.lock().unwrap(),
                        frame.sample_tick,
                        frame.values.keys().collect::<Vec<_>>()
                    );
                    debug_log(&msg);
                }
                None => {
                    let msg = format!(
                        "[DEBUG frame_bus] latest_frame #{} -> None\n",
                        self.pull_count.lock().unwrap()
                    );
                    debug_log(&msg);
                }
            }
        }
        opt
    }

    pub fn clear(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = None;
        }
    }
}
