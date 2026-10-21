use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Wry,
};
use tauri_plugin_dialog::DialogExt;

const NAME: &str = "PC Tweaker";

pub struct Texts {
    pub open: String,
    pub background: &'static str,
    pub exit: String,
    pub title: String,
    pub notice: String,
}

/// The menu and first-close notice in one of the app's languages (the code it
/// saves: en, it, fr, es, de, pt), English for anything else.
pub fn texts(language: &str) -> Texts {
    let n = NAME;
    match language.get(..2).unwrap_or("") {
        "it" => Texts {
            open: format!("Apri {n}"),
            background: "Resta attivo in background",
            exit: format!("Esci da {n}"),
            title: format!("{n} è attivo in background"),
            notice: format!("{n} resta attivo nell'area di notifica accanto all'orologio. Fai clic sulla sua icona per riaprirlo, oppure scegli Esci da {n} per chiuderlo. Puoi disattivare l'esecuzione in background dal menu dell'icona."),
        },
        "fr" => Texts {
            open: format!("Ouvrir {n}"),
            background: "Continuer en arrière-plan",
            exit: format!("Quitter {n}"),
            title: format!("{n} fonctionne en arrière-plan"),
            notice: format!("{n} reste actif dans la zone de notification, près de l'horloge. Cliquez sur son icône pour le rouvrir, ou choisissez Quitter {n} pour le fermer. Vous pouvez désactiver le fonctionnement en arrière-plan depuis le menu de l'icône."),
        },
        "es" => Texts {
            open: format!("Abrir {n}"),
            background: "Seguir en segundo plano",
            exit: format!("Salir de {n}"),
            title: format!("{n} sigue en segundo plano"),
            notice: format!("{n} sigue abierto en el área de notificación, junto al reloj. Haz clic en su icono para volver a abrirlo o elige Salir de {n} para cerrarlo. Puedes desactivar el modo en segundo plano desde el menú del icono."),
        },
        "de" => Texts {
            open: format!("{n} öffnen"),
            background: "Im Hintergrund weiterlaufen",
            exit: format!("{n} beenden"),
            title: format!("{n} läuft im Hintergrund"),
            notice: format!("{n} läuft im Infobereich neben der Uhr weiter. Klicken Sie auf das Symbol, um es wieder zu öffnen, oder wählen Sie „{n} beenden“, um es zu schließen. Den Hintergrundbetrieb können Sie im Menü des Symbols ausschalten."),
        },
        "pt" => Texts {
            open: format!("Abrir {n}"),
            background: "Continuar em segundo plano",
            exit: format!("Sair de {n}"),
            title: format!("{n} continua em segundo plano"),
            notice: format!("{n} continua em execução na área de notificação, junto ao relógio. Clique no ícone para voltar a abrir a aplicação ou escolha Sair de {n} para a fechar. Pode desativar o modo em segundo plano no menu do ícone."),
        },
        _ => Texts {
            open: format!("Open {n}"),
            background: "Keep running in the background",
            exit: format!("Exit {n}"),
            title: format!("{n} is running in the background"),
            notice: format!("{n} is still running in the notification area near the clock. Click its icon to reopen it, or choose Exit {n} to quit. You can turn off background mode from the icon's menu."),
        },
    }
}

pub struct BackgroundState {
    enabled: AtomicBool,
    notified: AtomicBool,
    language: Mutex<String>,
    open: MenuItem<Wry>,
    background: CheckMenuItem<Wry>,
    exit: MenuItem<Wry>,
}

pub fn show(app: &tauri::AppHandle) {
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
    // English until the window reports its language (set_tray_language).
    let t = texts("en");
    let open = MenuItem::with_id(app, "tray-open", &t.open, true, None::<&str>)?;
    let background = CheckMenuItem::with_id(
        app,
        "tray-background",
        t.background,
        true,
        enabled,
        None::<&str>,
    )?;
    let exit = MenuItem::with_id(app, "tray-exit", &t.exit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &background, &exit])?;
    app.manage(BackgroundState {
        enabled: AtomicBool::new(enabled),
        notified: AtomicBool::new(notice.exists()),
        language: Mutex::new("en".into()),
        open,
        background,
        exit,
    });
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
                let _ = state.background.set_checked(state.enabled.load(Ordering::Relaxed));
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

/// Called by the window at start and whenever the language changes.
#[tauri::command]
pub fn set_tray_language(app: tauri::AppHandle, language: String) {
    let Some(state) = app.try_state::<BackgroundState>() else {
        return;
    };
    let t = texts(&language);
    let _ = state.open.set_text(&t.open);
    let _ = state.background.set_text(t.background);
    let _ = state.exit.set_text(&t.exit);
    if let Ok(mut current) = state.language.lock() {
        *current = language;
    };
}

pub fn window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if window.label() != "main" {
        return;
    }
    match event {
        tauri::WindowEvent::Resized(s) => crate::window_state::remember(window, Some(*s), None),
        tauri::WindowEvent::Moved(p) => crate::window_state::remember(window, None, Some(*p)),
        _ => {}
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
            let t = texts(&state.language.lock().map(|l| l.clone()).unwrap_or_default());
            app.dialog().message(t.notice).title(t.title).show(|_| {});
            if let Ok(dir) = app.path().app_data_dir() {
                if std::fs::create_dir_all(&dir).is_ok() {
                    let _ = std::fs::write(dir.join("tray-notice-seen"), b"seen");
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_language_names_the_app_and_its_exit_item() {
        for lang in ["en", "it", "fr", "es", "de", "pt", "pt-PT"] {
            let t = texts(lang);
            assert!(t.open.contains(NAME) && t.exit.contains(NAME) && t.title.contains(NAME));
            assert!(
                t.notice.contains(&t.exit),
                "{lang}: the notice names the Exit item"
            );
        }
    }

    #[test]
    fn unknown_or_odd_codes_fall_back_to_english() {
        for lang in ["", "x", "zz", "é", "toString"] {
            assert_eq!(texts(lang).background, "Keep running in the background");
        }
        assert_eq!(texts("it").background, "Resta attivo in background");
    }
}
