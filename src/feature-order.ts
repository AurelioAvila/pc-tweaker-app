// Broad, scoped controls come before cosmetic or system-wide tradeoffs.
// Presentation order is not a recommendation to enable every setting.
const SECTION_ORDER: Record<string, readonly string[]> = {
  performance: [
    "power_plan_performance",
    "ecoqos_rules",
    "disable_game_dvr",
    "limit_do_background_download",
    "disable_restart_apps",
    "disable_startup_delay",
    "turbo_gaming",
    "priority_separation",
    "keep_kernel_in_ram",
    "disable_power_throttling",
    "disable_background_apps",
    "disable_window_animations",
    "disable_drag_full_windows",
    "menu_show_delay",
    "mouse_hover_delay",
  ],
  gaming: [
    "monitor_refresh_profile",
    "reduce_input_lag",
    "disable_sticky_keys_prompt",
    "hardware_gpu_scheduling",
    "disable_filter_keys_shortcut",
    "reduce_keyboard_delay",
    "disable_mouse_acceleration",
    "games_task_priority",
    "games_gpu_priority",
    "network_throttling_index",
    "network_latency",
    "tcp_congestion_bbr",
    "system_responsiveness",
    "disable_core_parking",
    "disable_fullscreen_optimizations_global",
    "global_timer_resolution",
    "disable_memory_integrity",
  ],
  manutenzione: ["enable_long_paths", "disable_delivery_optimization", "auto_end_frozen_tasks"],
};

export function orderSectionTweaks<T extends { id: string }>(items: T[], section: string): T[] {
  const order = SECTION_ORDER[section];
  if (!order) return items;
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? order.length : index;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id));
}
