use crate::ipc_commands::APP_COMMANDS;
use std::collections::HashSet;

#[test]
fn every_registered_application_command_has_an_explicit_permission() {
    let source = include_str!("lib.rs");
    let registry = source
        .split_once(".invoke_handler(tauri::generate_handler![")
        .expect("application handler registry")
        .1
        .split_once("])")
        .expect("end of handler registry")
        .0;
    let registered: HashSet<&str> = registry
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.rsplit("::").next().unwrap())
        .collect();
    let governed: HashSet<&str> = APP_COMMANDS.iter().copied().collect();
    assert_eq!(
        governed.len(),
        APP_COMMANDS.len(),
        "duplicate permission entry"
    );
    assert_eq!(
        registered, governed,
        "IPC registry and permissions must stay in sync"
    );
}

#[test]
fn actual_capabilities_restrict_hud_before_any_handler_runs() {
    // Use the real generated application ACL and Tauri's IPC dispatcher. The
    // handler is deliberately a harmless echo: no native operation, startup
    // watcher, credentials, network or system journal participates in this test.
    let app = tauri::test::mock_builder()
        .invoke_handler(|invoke| {
            let command = invoke.message.command().to_string();
            invoke.resolver.resolve(command);
            true
        })
        .build(tauri::generate_context!())
        .expect("mock app with production capabilities");

    for label in ["main", "hud", "untrusted"] {
        let window = tauri::WebviewWindowBuilder::new(&app, label, Default::default())
            .build()
            .expect("mock window");
        for command in APP_COMMANDS {
            let result = tauri::test::get_ipc_response(
                &window,
                tauri::webview::InvokeRequest {
                    cmd: (*command).into(),
                    callback: tauri::ipc::CallbackFn(0),
                    error: tauri::ipc::CallbackFn(1),
                    url: if cfg!(any(windows, target_os = "android")) {
                        "http://tauri.localhost"
                    } else {
                        "tauri://localhost"
                    }
                    .parse()
                    .unwrap(),
                    body: tauri::ipc::InvokeBody::default(),
                    headers: Default::default(),
                    invoke_key: tauri::test::INVOKE_KEY.to_string(),
                },
            );
            let allowed = label == "main"
                || (label == "hud" && ["hud_snapshot", "hud_is_compact"].contains(command));
            if allowed {
                assert_eq!(
                    result
                        .expect("allowed IPC")
                        .deserialize::<String>()
                        .unwrap(),
                    *command,
                    "{label}: {command}",
                );
            } else {
                let error = result.expect_err("unauthorized handler must not execute");
                assert!(
                    error.to_string().contains("not allowed"),
                    "{label}: {command}: {error}"
                );
            }
        }
    }
}
