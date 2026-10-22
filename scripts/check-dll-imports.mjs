// Release gate for the elevated helper's DLL search (see src-tauri/build.rs
// and src-tauri/src/main.rs). The app installs per user and relaunches itself
// elevated, so a DLL planted next to the exe must never load at startup:
//   - the exe's own imports resolve from System32 (DependentLoadFlags 0x800);
//   - CRYPTBASE.DLL is one of those imports, so ADVAPI32's forwarder into it
//     cannot pick up a planted copy;
//   - powrprof.dll is delay-loaded, so the UMPDC.dll it pulls in loads after
//     the helper's SetDefaultDllDirectories(SYSTEM32).
// Usage: node scripts/check-dll-imports.mjs "<path to PC Tweaker exe>"
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/check-dll-imports.mjs "<exe>"');
  process.exit(2);
}
const pe = fs.readFileSync(file);
const nt = pe.readUInt32LE(0x3c);
if (pe.toString("latin1", nt, nt + 4) !== "PE\0\0") throw new Error("not a PE file");
const sections = pe.readUInt16LE(nt + 6);
const opt = nt + 24;
if (pe.readUInt16LE(opt) !== 0x20b) throw new Error("expected a 64-bit image");
const dir = (i) => ({ rva: pe.readUInt32LE(opt + 112 + i * 8), size: pe.readUInt32LE(opt + 116 + i * 8) });
const table = opt + pe.readUInt16LE(nt + 20);
function offset(rva) {
  for (let i = 0; i < sections; i++) {
    const s = table + i * 40;
    const va = pe.readUInt32LE(s + 12);
    const size = Math.max(pe.readUInt32LE(s + 8), pe.readUInt32LE(s + 16));
    if (rva >= va && rva < va + size) return rva - va + pe.readUInt32LE(s + 20);
  }
  throw new Error(`RVA 0x${rva.toString(16)} is outside every section`);
}
const cstr = (rva) => {
  const at = offset(rva);
  return pe.toString("latin1", at, pe.indexOf(0, at)).toLowerCase();
};
function names(index, stride, nameField) {
  const { rva } = dir(index);
  const out = [];
  for (let at = rva ? offset(rva) : -1; at >= 0; at += stride) {
    const name = pe.readUInt32LE(at + nameField);
    if (!name) break;
    out.push(cstr(name));
  }
  return out;
}
const imports = names(1, 20, 12);
const delayed = names(13, 32, 4);
const config = dir(10);
const loadFlags = config.rva ? pe.readUInt16LE(offset(config.rva) + 0x4e) : 0;

const failures = [];
if (loadFlags !== 0x800) failures.push(`DependentLoadFlags is 0x${loadFlags.toString(16)}, expected 0x800`);
if (!imports.includes("cryptbase.dll")) failures.push("cryptbase.dll is not a direct import");
if (imports.includes("powrprof.dll")) failures.push("powrprof.dll is imported at startup");
if (!delayed.includes("powrprof.dll")) failures.push("powrprof.dll is not delay-loaded");
if (failures.length) {
  console.error(`DLL import check failed for ${file}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`DLL imports ok: DependentLoadFlags 0x800, cryptbase.dll imported, powrprof.dll delay-loaded (${imports.length} imports, ${delayed.length} delayed).`);
