#!/bin/sh
# Ajusta o dono dos volumes para o usuário sem privilégios dos serviços (PS_UID:PS_GID)
# e termina (serviço volume-init). Volumes novos nascem do root, e os de antes do
# endurecimento eram gravados pelo root. Só mexe no que estiver com outro dono.
set -eu
uid=${PS_UID:-1000}
gid=${PS_GID:-1000}

for dir in /vol/*; do
	[ -d "$dir" ] || continue
	if [ -n "$(find "$dir" \( ! -user "$uid" -o ! -group "$gid" \) -print -quit)" ]; then
		echo "[volume-init] ajustando o dono de $(basename "$dir") para $uid:$gid"
		# Em pastas do Windows (Docker Desktop) o dono não muda, mas qualquer usuário grava
		chown -R "$uid:$gid" "$dir" 2>/dev/null || echo "[volume-init] aviso: não foi possível mudar o dono de $(basename "$dir")"
	fi
done
