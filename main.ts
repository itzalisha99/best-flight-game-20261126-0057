// SKYHAWK — Island Courier: the hand-in program (Node 22, standard library only).
// It copies the static game (game/) and the maker's screenshots (screenshots/)
// from beside this file into the output directory, then writes dossier.json,
// the summary the judge reads, with the vendored make.fun library.
// Run locally: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this bounty (RULES.txt, gate): the dossier text is
// capped at 160 KiB; at most 4 screenshots of at most 256 KiB each; game/ at
// most 993 files and directories in all and 48 MiB, every path at most 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countEntries(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    total += 1;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) total += countEntries(full);
  }
  return total;
}

// Validate the hand-in against the bounty gate's own caps before writing the
// dossier, so a bad entry fails here with a plain message instead of in the
// grader: game/ plain files only (no symlinks), at most 993 entries and
// 48 MiB, index.html a regular file of at most 1 MiB, 3-4 screenshots each
// at most 256 KiB with the long side at most 1280 and the short side at
// least 480 pixels (read from the JPEG/PNG headers, no decoder needed).
function validate() {
  const problems = [];
  const gameDir = join(outDir, 'game');
  const indexHtml = join(gameDir, 'index.html');
  if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) {
    problems.push('game/index.html is missing');
  } else if (statSync(indexHtml).size > 1024 * 1024) {
    problems.push('game/index.html is over 1 MiB');
  }
  let entries = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isSymbolicLink()) problems.push(`symlink in game/: ${full}`);
      entries += 1;
      bytes += st.isFile() ? st.size : 0;
      if (st.isDirectory()) walk(full);
    }
  };
  walk(gameDir);
  if (entries > 993) problems.push(`game/ has ${entries} entries, over the 993 cap`);
  if (bytes > 48 * 1024 * 1024) problems.push(`game/ is ${bytes} bytes, over the 48 MiB cap`);
  const shotsDir = join(outDir, 'screenshots');
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((n) => !n.startsWith('.'))
    : [];
  if (shots.length < 3 || shots.length > 4) problems.push(`screenshots/ has ${shots.length} shots, need 3 or 4`);
  for (const shot of shots) {
    const full = join(shotsDir, shot);
    const size = statSync(full).size;
    if (size > 256 * 1024) problems.push(`${shot} is ${size} bytes, over the 256 KiB cap`);
    const buf = readFileSync(full);
    let w = 0;
    let h = 0;
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG: walk the markers to the first SOF frame for width/height.
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          h = buf.readUInt16BE(i + 5);
          w = buf.readUInt16BE(i + 7);
          break;
        }
        i += 2 + len;
      }
    } else if (buf.readUInt32BE(0) === 0x89504e47) {
      w = buf.readUInt32BE(16);
      h = buf.readUInt32BE(20);
    }
    if (w > 0 && (Math.max(w, h) > 1280 || Math.min(w, h) < 480)) {
      problems.push(`${shot} is ${w}x${h}, outside the 1280 long side / 480 short side bounds`);
    }
  }
  return problems;
}

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const gameEntries = countEntries(join(outDir, 'game'));
const shotCount = readdirSync(join(outDir, 'screenshots')).filter((n) => !n.startsWith('.')).length;
console.log(`SKYHAWK hand-in: game/ has ${gameEntries} entries, screenshots/ has ${shotCount} shots`);

const problems = validate();
if (problems.length > 0) {
  for (const p of problems) console.error(`gate check failed: ${p}`);
  process.exit(1);
}
console.log('gate checks pass');

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));
console.log('dossier.json written');
