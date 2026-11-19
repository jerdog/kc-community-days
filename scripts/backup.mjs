#!/usr/bin/env node
// npm run backup [-- "why"]  → backups/communitydays-backup-<time>.json
// Restore with: npm run restore -- backups/<file>.json   (or upload it on the admin page)
import { writeLocalBackup } from './lib/local-backup.mjs';
import { summary } from '../src/lib/backup.js';

const { backup, path } = await writeLocalBackup(process.argv.slice(2).join(' ') || 'Manual backup');
console.log(`Backed up ${summary(backup)} → ${path}`);
