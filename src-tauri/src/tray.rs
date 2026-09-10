use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_dialog::DialogExt;

pub struct BackgroundState {
    enabled: AtomicBool,
    notified: AtomicBool,
}

fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let was_hidden = !window.is_visible().unwrap_or(true);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if was_hidden && window.is_visible().unwrap_or(false) {
            let _ = window.emit("app-reopened", ());
        }
    }
}

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let path = app.path().app_data_dir()?.join("background-mode-disabled");
    let enabled = !path.exists();
    let notice = app.path().app_data_dir()?.join("tray-notice-seen");
    app.manage(BackgroundState {
        enabled: AtomicBool::new(enabled),
        notified: AtomicBool::new(notice.exists()),
    });
    let open = MenuItem::with_id(app, "tray-open", "Open PC Tweaker", true, None::<&str>)?;
    let background = CheckMenuItem::with_id(
        app,
        "tray-background",
        "Keep running in the background",
        true,
        enabled,
        None::<&str>,
    )?;
    let exit = MenuItem::with_id(app, "tray-exit", "Exit PC Tweaker", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &background, &exit])?;
    let mut builder = TrayIconBuilder::with_id("pc-tweaker")
        .tooltip("PC Tweaker")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "tray-open" => show(app),
            "tray-exit" => app.exit(0),
            "tray-background" => {
                let state = app.state::<BackgroundState>();
                let enabled = !state.enabled.load(Ordering::Relaxed);
                let saved = if enabled {
                    std::fs::remove_file(&path).or_else(|e| {
                        if e.kind() == std::io::ErrorKind::NotFound {
                            Ok(())
                        } else {
                            Err(e)
                        }
                    })
                } else {
                    path.parent()
                        .map(std::fs::create_dir_all)
                        .transpose()
                        .and_then(|_| std::fs::write(&path, b"disabled"))
                };
                if saved.is_ok() {
                    state.enabled.store(enabled, Ordering::Relaxed);
                }
                let _ = background.set_checked(state.enabled.load(Ordering::Relaxed));
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if window.label() != "main" {
        return;
    }
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let app = window.app_handle();
        let Some(state) = app.try_state::<BackgroundState>() else {
            return;
        };
        if !state.enabled.load(Ordering::Relaxed) {
            return;
        }
        // Do not trap the user in an inaccessible process if hiding fails.
        if window.hide().is_err() {
            return;
        }
        api.prevent_close();
        if !state.notified.swap(true, Ordering::Relaxed) {
            app.dialog().message("PC Tweaker is still running in the notification area near the clock. Click its icon to reopen it, or choose Exit PC Tweaker to quit. You can turn off background mode from the icon's menu.")
                .title("PC Tweaker is running in the background").show(|_| {});
            if let Ok(dir) = app.path().app_data_dir() {
                if std::fs::create_dir_all(&dir).is_ok() {
                    let _ = std::fs::write(dir.join("tray-notice-seen"), b"seen");
                }
            }
        }
    }
}
