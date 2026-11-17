// @ts-check
import { defineConfig } from 'astro/config';

// Static build; dynamic bits (form submissions) live in worker/index.js and are
// served by the same Cloudflare Worker via run_worker_first: ["/api/*"].
export default defineConfig({
  site: 'https://communitydays.info',
  output: 'static',
  trailingSlash: 'ignore',
});
