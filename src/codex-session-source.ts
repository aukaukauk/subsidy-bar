import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

export type CcusageCodexHome = {
  path: string;
  cleanup: () => void;
};

function codexHome(): string {
  const configured = process.env.CODEX_HOME?.trim();
  return configured ? configured : join(homedir(), ".codex");
}

function codexSessionRoots(home = codexHome()): string[] {
  return [join(home, "sessions"), join(home, "archived_sessions")];
}

function findJsonlFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  const found: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        found.push(path);
      }
    }
  }
  return found;
}

export function createCcusageCodexHome(): CcusageCodexHome | null {
  const selected = new Map<string, { path: string; size: number }>();
  for (const root of codexSessionRoots()) {
    for (const file of findJsonlFiles(root)) {
      let size = 0;
      try {
        size = statSync(file).size;
      } catch {
        continue;
      }

      const key = sessionKeyFromPath(file);
      const current = selected.get(key);
      if (!current || size > current.size) {
        selected.set(key, { path: file, size });
      }
    }
  }

  if (selected.size === 0) return null;

  const tempRoot = mkdtempSync(join(tmpdir(), "subsidybar-"));

  try {
    const tempSessions = join(tempRoot, "sessions");
    mkdirSync(tempSessions, { recursive: true });

    let index = 0;
    for (const [key, file] of selected) {
      const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
      const target = join(tempSessions, `${String(index).padStart(5, "0")}-${safeKey}.jsonl`);
      symlinkSync(file.path, target);
      index += 1;
    }

    return {
      path: tempRoot,
      cleanup: () => rmSync(tempRoot, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function sessionKeyFromPath(path: string): string {
  const match = basename(path).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1].toLowerCase() : basename(path).replace(/\.jsonl$/i, "");
}
