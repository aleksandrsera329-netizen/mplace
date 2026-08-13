import fs from "node:fs";

const lockfiles = ["apps/api/package-lock.json", "apps/web/package-lock.json"];
const denied = /^(?:GPL|AGPL|SSPL|BUSL|Commons-Clause)/i;
let deniedFound = [];
let missing = [];

for (const file of lockfiles) {
  const lock = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path || !meta) continue;
    const license = typeof meta.license === "string" ? meta.license : "";
    const name = path.includes("node_modules/") ? path.split("node_modules/").pop() : path;
    if (!license) missing.push(`${name}@${meta.version ?? "unknown"}`);
    if (denied.test(license)) deniedFound.push(`${name}@${meta.version ?? "unknown"} — ${license}`);
  }
}

console.log(`License scan: ${lockfiles.length} lockfiles`);
console.log(`Missing license metadata: ${missing.length}`);
if (missing.length) console.warn(missing.map((x) => `  WARN ${x}`).join("\n"));
if (deniedFound.length) {
  console.error("Denied licenses detected:");
  console.error(deniedFound.map((x) => `  ERROR ${x}`).join("\n"));
  process.exit(1);
}
console.log("No GPL/AGPL/SSPL/BUSL/Commons-Clause license metadata detected.");
