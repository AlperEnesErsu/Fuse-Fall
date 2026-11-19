// Builds the web game and copies it into the portfolio site (AlperEnesErsu.net), where it is
// served at /oyunlar/fuse-and-fall/index.html. Nothing goes live here: the copy lands in the
// portfolio's working tree, and it reaches players only through a reviewed portfolio PR.
//
//   npm run portfolio                      # portfolio checkout next to this one
//   PORTFOLIO_DIR=path/to/site npm run portfolio
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE = 'https://alperenesersu.netlify.app';
const FOLDER = 'oyunlar/fuse-and-fall';

const portfolio = resolve(process.env.PORTFOLIO_DIR ?? '../AlperEnesErsu.net');
if (!existsSync(resolve(portfolio, 'next.config.ts')) || !existsSync(resolve(portfolio, 'public'))) {
  console.error(`No portfolio site at ${portfolio}. Set PORTFOLIO_DIR to its checkout.`);
  process.exit(1);
}

execSync('npm run build', { stdio: 'inherit', env: { ...process.env, VITE_SITE_URL: `${SITE}/${FOLDER}` } });

const target = resolve(portfolio, 'public', FOLDER);
// The game's folder is the game's alone: replaced whole, so old bundles do not pile up.
rmSync(target, { recursive: true, force: true });
cpSync('dist', target, { recursive: true });
console.log(`Copied ${readdirSync(target).length} entries to ${target}`);
console.log(`Opens at ${SITE}/${FOLDER}/index.html once the portfolio PR is merged.`);
