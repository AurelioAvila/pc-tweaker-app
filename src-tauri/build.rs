#[path = "src/ipc_commands.rs"]
mod ipc_commands;

fn main() {
    println!("cargo:rerun-if-changed=src/ipc_commands.rs");
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(ipc_commands::APP_COMMANDS)),
    )
    .expect("could not generate the application capability manifest");

    // Tauri supplies its Windows resource to binary targets only. Library
    // tests also link native dialogs, which require Common Controls v6.
    // Keep the existing Tauri resource unchanged for the application binary.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
    }
}
