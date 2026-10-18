#!/bin/sh
# Backup diário da VPS (ver docs/deploy-vps.md, seção "Backup").
#
# Copia só o que não dá para recriar:
#   - login: banco de contas (login.db) e chaves RSA (volume login-data);
#   - servidor de jogo: databases/*.db (jornadas, conquistas) e config/ (ranks,
#     salas, ladders, punições), sem o config.js, que é gerado a cada start;
#   - o .env;
#   - as imagens das insígnias (assets/badges, fora do git).
#
# Fica de fora, de propósito (LGPD, minimização):
#   - logs/ (logs de batalha têm retenção de 30 dias; um backup esticaria esse prazo);
#   - sessões ficam no login.db, mas expiram sozinhas.
#
# O arquivo sai criptografado com age para a chave PÚBLICA em RECIPIENT_FILE. A chave
# privada fica só no computador do admin: quem invadir a VPS não abre os backups.
#
# Roda como root (lê os volumes do Docker). As variáveis abaixo podem ser trocadas
# por ambiente, o que também permite testar o script fora da VPS.
set -eu

APP_DIR=${APP_DIR:-/opt/pokemon-showdown-custom}
VOLUMES_DIR=${VOLUMES_DIR:-/var/lib/docker/volumes}
PROJECT=${PROJECT:-pokemon-showdown-custom}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/ps-custom}
RECIPIENT_FILE=${RECIPIENT_FILE:-/etc/ps-custom/backup-recipient.txt}
KEEP_DAYS=${KEEP_DAYS:-14}
# Grupo que pode LER os backups (já criptografados), para copiá-los da VPS sem sudo
BACKUP_GROUP=${BACKUP_GROUP:-}

umask 077
stamp=$(date +%Y-%m-%d_%H%M)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# SQLite em modo WAL: o .backup gera uma cópia consistente com os serviços rodando
backup_db() {
	mkdir -p "$(dirname "$2")"
	sqlite3 "$1" ".backup '$2'"
}

login_data="$VOLUMES_DIR/${PROJECT}_login-data/_data"
backup_db "$login_data/login.db" "$work/login/login.db"
cp -a "$login_data/keys" "$work/login/keys"

for db in "$APP_DIR"/server/databases/*.db; do
	[ -f "$db" ] && backup_db "$db" "$work/server/databases/$(basename "$db")"
done

mkdir -p "$work/server"
cp -a "$APP_DIR/server/config" "$work/server/config"
rm -f "$work/server/config/config.js"

cp "$APP_DIR/.env" "$work/env"

if [ -d "$APP_DIR/assets/badges" ]; then
	mkdir -p "$work/assets"
	cp -a "$APP_DIR/assets/badges" "$work/assets/badges"
fi

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/ps-custom-$stamp.tar.gz.age"
tar -C "$work" -czf - . | age -R "$RECIPIENT_FILE" -o "$out"
if [ -n "$BACKUP_GROUP" ]; then
	chgrp "$BACKUP_GROUP" "$BACKUP_DIR" "$out"
	chmod 750 "$BACKUP_DIR"
	chmod 640 "$out"
fi
find "$BACKUP_DIR" -name 'ps-custom-*.tar.gz.age' -mtime +"$KEEP_DAYS" -delete
echo "[backup] $out"
