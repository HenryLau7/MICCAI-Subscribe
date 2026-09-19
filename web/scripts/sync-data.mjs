import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/data', { recursive: true });
copyFileSync('../data/processed/program.min.json', 'public/data/program.min.json');
console.log('synced program.min.json');
