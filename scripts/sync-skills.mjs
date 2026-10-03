import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Shared agent skills live in .agents/skills (read by Codex); Claude Code
// reads .claude/skills. Copy, not symlink: git on Windows turns symlinks into
// plain text files. Edit .agents/skills, then run `npm run sync:skills`.
const src = fileURLToPath(new URL("../.agents/skills", import.meta.url));
const dst = fileURLToPath(new URL("../.claude/skills", import.meta.url));
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log("skills synced: .agents/skills -> .claude/skills");
