// Limpeza do teste de ponta a ponta no login (container login): exclui as contas E2E
// pela mesma rotina da exclusão pelo jogador (sem a senha), inclusive a fila que apaga
// os dados de jogo, e os convites criados durante o teste.
// Uso: docker compose exec -T -e E2E_START=<epoch> login node --input-type=module < login.mjs
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.LOGIN_DATABASE || '/data/login.db');
const start = Number(process.env.E2E_START || 0);
const now = Math.floor(Date.now() / 1000);
const users = db.prepare("SELECT userid FROM users WHERE userid LIKE 'e2e%'").all();
db.exec('BEGIN IMMEDIATE');
for (const { userid } of users) {
	db.prepare('DELETE FROM codes WHERE userid = ?').run(userid);
	db.prepare('DELETE FROM sessions WHERE userid = ?').run(userid);
	db.prepare('DELETE FROM users WHERE userid = ?').run(userid);
	db.prepare('INSERT OR REPLACE INTO pending_purges (userid, deleted_at) VALUES (?, ?)').run(userid, now);
}
// Convites reservados para nomes E2E e os gerados durante o teste
const codes = db.prepare("DELETE FROM codes WHERE userid LIKE 'e2e%' OR (? > 0 AND created_at >= ?)").run(start, start);
db.exec('COMMIT');
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
console.log(`[e2e] login: ${users.length} conta(s) e ${codes.changes} código(s) removidos`);
