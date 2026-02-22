import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { statSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(__dirname, '../dist/device-router-probe.min.js');

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(__dirname, '../src/iife.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile,
});

// Generate gzipped version for size verification
execSync(`gzip -k -f "${outfile}"`);

const gzPath = outfile + '.gz';
const gzSize = statSync(gzPath).size;
const MAX_SIZE = 1024;

console.log(`Probe size: ${gzSize} bytes gzipped (limit: ${MAX_SIZE})`);

if (gzSize > MAX_SIZE) {
  console.error(`ERROR: Probe exceeds ${MAX_SIZE} byte limit (${gzSize} bytes)`);
  process.exit(1);
}
