// Limpeza do teste de ponta a ponta na Expedição (container server-setup): apaga as
// expedições E2E e as runs (com as batalhas) delas ou de jogadores E2E.
// Uso: docker compose run --rm --no-deps server-setup node /e2e/cleanup/expedition.cjs
'use strict';
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const file = '/app/databases/expedition.db';
if (!fs.existsSync(file)) process.exit(0);
const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');
const table = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'expeditions'`).get();
if (!table) process.exit(0);
db.exec('BEGIN IMMEDIATE');
const expeditions = "SELECT CAST(id AS TEXT) FROM expeditions WHERE name LIKE 'E2E%'";
const runs = db.prepare(`DELETE FROM runs WHERE userid LIKE 'e2e%' OR variant IN (${expeditions})`).run();
const removed = db.prepare("DELETE FROM expeditions WHERE name LIKE 'E2E%'").run();
db.exec('COMMIT');
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
console.log(`[e2e] expedição: ${removed.changes} expedição(ões), ${runs.changes} run(s) removidas`);
