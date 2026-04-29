#!/usr/bin/env node
/**
 * SwiftPM derives local package identity from the *last path component*.
 * @capacitor/app and @capacitor-firebase/app both end with `/app` → collision
 * ("Conflicting identity for app") in Xcode.
 *
 * After `cap sync`, rewrite those two dependencies to point at uniquely named
 * symlink dirs under CapApp-SPM/spm-path-aliases/.
 *
 * @see https://github.com/capawesome-team/capacitor-firebase/issues/959
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const capAppSpmDir = path.join(__dirname, "..", "ios", "App", "CapApp-SPM");
const packageSwiftPath = path.join(capAppSpmDir, "Package.swift");
const aliasesDir = path.join(capAppSpmDir, "spm-path-aliases");

/** @type {{ linkName: string; absolutePackageDir: string; packageName: string }[]} */
const mappings = [
  {
    linkName: "capacitor-core-app",
    absolutePackageDir: path.join(repoRoot, "node_modules", "@capacitor", "app"),
    packageName: "CapacitorApp",
  },
  {
    linkName: "capacitor-firebase-app-plugin",
    absolutePackageDir: path.join(repoRoot, "node_modules", "@capacitor-firebase", "app"),
    packageName: "CapacitorFirebaseApp",
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} linkPath
 * @param {string} targetRelative unix-style relative target
 */
function ensureSymlink(linkPath, targetRelative) {
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const cur = fs.readlinkSync(linkPath);
      if (cur === targetRelative) return;
      fs.unlinkSync(linkPath);
    } else {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  } catch {
    // missing
  }
  fs.symlinkSync(targetRelative, linkPath);
}

function relativePosix(fromDir, toPath) {
  let rel = path.relative(fromDir, toPath);
  if (rel === "") rel = ".";
  return rel.split(path.sep).join("/");
}

function patchPackageSwift(text) {
  let out = text;
  let changed = false;
  for (const { linkName, packageName, absolutePackageDir } of mappings) {
    if (!fs.existsSync(absolutePackageDir)) {
      console.warn(
        `[fix-cap-spm-app-identity-alias] Skip ${packageName}: missing ${absolutePackageDir}`,
      );
      continue;
    }
    const newPath = `./spm-path-aliases/${linkName}`;
    const re = new RegExp(
      `\\.package\\(name: "${packageName}", path: "[^"]+"\\),`,
      "g",
    );
    const replacement = `.package(name: "${packageName}", path: "${newPath}"),`;
    const next = out.replace(re, (full) => {
      if (full.includes(newPath)) return full;
      changed = true;
      return replacement;
    });
    out = next;
  }
  return { out, changed };
}

function main() {
  if (!fs.existsSync(packageSwiftPath)) {
    console.warn("[fix-cap-spm-app-identity-alias] No Package.swift; skip.");
    return;
  }

  ensureDir(aliasesDir);

  for (const { linkName, absolutePackageDir } of mappings) {
    if (!fs.existsSync(absolutePackageDir)) continue;
    const linkPath = path.join(aliasesDir, linkName);
    const targetRelative = relativePosix(aliasesDir, absolutePackageDir);
    ensureSymlink(linkPath, targetRelative);
  }

  const raw = fs.readFileSync(packageSwiftPath, "utf8");
  const { out, changed } = patchPackageSwift(raw);
  if (changed) {
    fs.writeFileSync(packageSwiftPath, out, "utf8");
    console.log(
      "[fix-cap-spm-app-identity-alias] Patched CapApp-SPM/Package.swift (unique SPM path aliases for @capacitor/app + @capacitor-firebase/app).",
    );
  }
}

main();
