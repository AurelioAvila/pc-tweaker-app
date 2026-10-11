// Only reversible, user-level controls. No security, network or power overrides.
export const STARTER_PRESETS = [
  {
    id: "gaming",
    icon: "disable_game_dvr",
    tweaks: [
      { id: "disable_game_dvr", selected: true },
      { id: "reduce_input_lag", selected: true },
      { id: "disable_sticky_keys_prompt", selected: false },
    ],
  },
  {
    id: "streaming",
    icon: "disable_game_dvr",
    tweaks: [
      { id: "disable_game_dvr", selected: true },
      { id: "disable_sticky_keys_prompt", selected: true },
      { id: "disable_feedback_requests", selected: true },
      { id: "disable_start_suggestions", selected: false },
    ],
  },
  {
    id: "work",
    icon: "show_file_extensions",
    tweaks: [
      { id: "show_file_extensions", selected: true },
      { id: "disable_startup_delay", selected: true },
      { id: "menu_show_delay", selected: true },
      { id: "show_hidden_files", selected: false },
    ],
  },
  {
    id: "study",
    icon: "instant_folder_loading",
    tweaks: [
      { id: "disable_start_suggestions", selected: true },
      { id: "disable_feedback_requests", selected: true },
      { id: "hide_taskbar_widgets", selected: true },
      { id: "disable_tailored_experiences", selected: false },
    ],
  },
  {
    // Effects and reopening apps only: battery savings are not claimed or
    // measured, and power settings stay out of every preset.
    id: "laptop",
    icon: "disable_transparency",
    tweaks: [
      { id: "disable_transparency", selected: true },
      { id: "disable_window_animations", selected: true },
      { id: "disable_restart_apps", selected: true },
      { id: "disable_drag_full_windows", selected: false },
    ],
  },
  {
    // Pop-ups, not fan noise: the copy says so.
    id: "quiet",
    icon: "disable_feedback_requests",
    tweaks: [
      { id: "disable_feedback_requests", selected: true },
      { id: "disable_suggested_apps", selected: true },
      { id: "disable_start_suggestions", selected: true },
      { id: "disable_sticky_keys_prompt", selected: true },
      { id: "disable_tailored_experiences", selected: false },
    ],
  },
];

export function presetSelection(preset, tweaks, selected, isPro) {
  const catalog = new Map(tweaks.map((t) => [t.id, t]));
  const chosen = new Set(selected);
  const available = preset.tweaks.flatMap((item) => {
    const tweak = catalog.get(item.id);
    return tweak ? [tweak] : [];
  });
  const pending = available.filter((t) => chosen.has(t.id) && !t.applied);
  return {
    available,
    missing: preset.tweaks.filter((t) => !catalog.has(t.id)).map((t) => t.id),
    pending,
    locked: pending.filter((t) => t.requires_pro && !isPro),
  };
}
