// Leonida Trophy Guide — entry program (Node 22, standard library only).
// It hands the guide in: copies app/ and screenshots/ from beside this file
// into the output directory and writes /output/dossier.json with the vendored
// make.fun library, exactly as the kit's starter plumbing does. My own lines
// below: the output-dir resolution, the copy order (screenshots first, then
// app, so a stale app/ can never shadow a fresh screenshot set), and the
// byte-identical second-run guard comment. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// Resolve the repository root from this file's own location.
const here = fileURLToPath(new URL('.', import.meta.url));
// The grader sets /output; local runs use MAKEFUN_OUTPUT_DIR.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
// Screenshots first, then the app, so the two runs write identical bytes.
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}
cpSync(join(here, 'app'), join(outDir, 'app'), { recursive: true });

// buildDossier refuses anything the gate would refuse (too many or too big
// screenshots, app/ past its file/byte caps), so a bad entry fails loudly here.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
