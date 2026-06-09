use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccWindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub title: String,
    pub matched_by: AccWindowMatchedBy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AccWindowMatchedBy {
    Title,
    Fallback,
}

#[cfg(windows)]
pub fn find_acc_window_bounds() -> Result<Option<AccWindowBounds>, String> {
    use windows_sys::Win32::{
        Foundation::{BOOL, HWND, LPARAM, RECT},
        UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
        },
    };

    unsafe extern "system" fn enum_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let found = &mut *(lparam as *mut Option<AccWindowBounds>);
        if found.is_some() || IsWindowVisible(hwnd) == 0 {
            return 1;
        }

        let title_len = GetWindowTextLengthW(hwnd);
        if title_len <= 0 {
            return 1;
        }

        let mut title_buffer = vec![0u16; title_len as usize + 1];
        let copied = GetWindowTextW(hwnd, title_buffer.as_mut_ptr(), title_buffer.len() as i32);
        if copied <= 0 {
            return 1;
        }

        let title = String::from_utf16_lossy(&title_buffer[..copied as usize]);
        let lowered = title.to_lowercase();
        if !lowered.contains("assetto corsa competizione") && !lowered.contains("acc") {
            return 1;
        }

        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return 1;
        }

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width < 800 || height < 450 {
            return 1;
        }

        *found = Some(AccWindowBounds {
            x: rect.left,
            y: rect.top,
            width: width as u32,
            height: height as u32,
            title,
            matched_by: AccWindowMatchedBy::Title,
        });
        0
    }

    let mut found: Option<AccWindowBounds> = None;
    let lparam = &mut found as *mut Option<AccWindowBounds> as LPARAM;
    let ok = unsafe { EnumWindows(Some(enum_window), lparam) };
    if ok == 0 && found.is_none() {
        return Err("Failed to enumerate top-level windows".to_string());
    }
    Ok(found)
}

#[cfg(not(windows))]
pub fn find_acc_window_bounds() -> Result<Option<AccWindowBounds>, String> {
    Ok(None)
}

#[cfg(all(test, not(windows)))]
mod tests {
    use super::*;

    #[test]
    fn non_windows_returns_none() {
        assert_eq!(find_acc_window_bounds().unwrap(), None);
    }
}
