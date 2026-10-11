# VM verification of the 1.18 controls

Checks, on clean virtual machines, that each of the 15 controls added in 1.18
writes exactly what it declares where it is supported, leaves the PC untouched
where it is not, and restores the exact original values.

`verify-tweaks.ps1` is read-only: PC Tweaker applies and restores, the script
only compares the registry and the service configuration with
`tweak-matrix.json`. That file is generated from the app's catalogue by
`cargo test settings_tweaks::tests::the_vm_matrix_matches_the_catalogue`
(set `PCT_WRITE_VM_MATRIX=1` to rewrite it), so it cannot drift.

## Machines

| VM | Image | Build | EditionID |
|---|---|---|---|
| A | Windows 11 Pro 24H2 | 26100 | Professional |
| B | Windows 11 Home 24H2 | 26100 | Core |
| C | Windows 11 Education 24H2 | 26100 | Education |
| D | Windows 10 22H2 Pro | 19045 | Professional |

Expected verdict per control and VM: the `expected` field of each entry in
`tweak-matrix.json`, or `.\verify-tweaks.ps1 -Phase Plan` on the VM itself.
In short: Home refuses Click to Do, Paint AI and Widgets; only Education
accepts the Start Recommended policy; Windows 10 refuses Paint AI, Notepad
AI, End task, the drag tray, Widgets and Start Recommended; the AI
Components Host control is offered only where `WSAIFabricSvc` exists.

## Procedure (each VM, about 15 minutes)

1. Take a VM checkpoint. Install the PC Tweaker build under test and sign in
   with a Pro licence (11 of the 15 controls are Pro).
2. In a normal, non-elevated PowerShell as the same user:
   `.\verify-tweaks.ps1 -Phase Baseline`
3. In PC Tweaker, search each control by name and apply it. Unsupported ones
   must show "Not available on this PC" and must not be applied.
4. `.\verify-tweaks.ps1 -Phase Applied`: every supported control PASS,
   every unsupported one "N/A (…, untouched)".
5. Change history > Restore active tweaks.
6. `.\verify-tweaks.ps1 -Phase Reverted`: every control PASS (each value back
   to exactly what the baseline recorded, including values that did not
   exist before).
7. Optional: restart, run `-Phase Reverted` again, then revert the VM to the
   checkpoint.

Results are written to `results\<computer>-<phase>.json` (git-ignored). The
exit code is the number of failed checks, so a run can gate a release.

## Result sheet

| Control | A Pro | B Home | C Edu | D Win10 |
|---|---|---|---|---|
| disable_click_to_do | | | | |
| disable_edge_ai | | | | |
| disable_paint_ai | | | | |
| disable_notepad_ai | | | | |
| disable_fast_startup | | | | |
| disable_storage_sense | | | | |
| taskbar_end_task | | | | |
| disable_drag_tray | | | | |
| explorer_open_this_pc | | | | |
| block_oem_device_apps | | | | |
| disable_windows_suggestions | | | | |
| disable_widgets | | | | |
| hide_start_recommended | | | | |
| disable_game_bar_captures | | | | |
| disable_ai_fabric_service | | | | |

Beyond the registry: on A and C, also check by eye that the taskbar and
system tray icons are all present after applying the AI Components Host
control (it now sets Manual rather than Disabled for this reason), and that
`edge://policy` lists the Edge policies.
