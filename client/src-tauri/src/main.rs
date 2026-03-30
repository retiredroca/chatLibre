#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use chatlibre_client::commands;
use chatlibre_client::storage::StorageManager;

fn main() {
    std::panic::set_hook(Box::new(|panic_info| {
        eprintln!("PANIC: {}", panic_info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let storage = StorageManager::new(app.handle().clone())?;
            app.manage(storage);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::identity::generate_identity,
            commands::identity::get_public_key,
            commands::identity::export_recovery_phrase,
            commands::identity::import_from_recovery_phrase,
            commands::storage::store_message,
            commands::storage::get_messages,
            commands::storage::delete_message,
            commands::storage::get_messages_by_channel,
            commands::crypto::encrypt_message,
            commands::crypto::decrypt_message,
            commands::crypto::encrypt_file,
            commands::crypto::decrypt_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
