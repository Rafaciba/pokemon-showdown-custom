// Limpeza do teste de ponta a ponta no Desafio de Ginásios (container server-setup):
// apaga os desafios e treinadores E2E e as jornadas deles ou de jogadores E2E.
// Uso: docker compose run --rm --no-deps server-setup node /e2e/cleanup/gym.cjs
'use strict';
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('/app/databases/gym-challenge.db');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');
db.exec('BEGIN IMMEDIATE');
const challenges = "SELECT id FROM challenges WHERE name LIKE 'E2E%'";
const runs = db.prepare(`DELETE FROM runs WHERE userid LIKE 'e2e%' OR challenge_id IN (${challenges})`).run();
const removed = db.prepare("DELETE FROM challenges WHERE name LIKE 'E2E%'").run();
const trainers = db.prepare(`
	DELETE FROM trainers WHERE name LIKE 'E2E%'
	AND id NOT IN (SELECT trainer_id FROM challenge_stages WHERE trainer_id IS NOT NULL)
	AND id NOT IN (SELECT trainer_id FROM challenge_pool)
`).run();
db.exec('COMMIT');
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
console.log(`[e2e] ginásios: ${removed.changes} desafio(s), ${trainers.changes} treinador(es), ${runs.changes} jornada(s) removidos`);
