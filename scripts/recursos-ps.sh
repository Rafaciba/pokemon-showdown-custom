#!/bin/sh
# Baixa os sprites e os sons do Pokémon Showdown (pacotes oficiais publicados em
# pokemonshowdown.com/files/resources/, gerados pela ferramenta build-tools/zip-sprites
# do cliente) e os coloca em client/play.pokemonshowdown.com/{sprites,audio}, pastas que
# o fork do cliente já ignora no git. Ver docs/recursos-ps.md.
#
# Uso: sh scripts/recursos-ps.sh [destino] [sprites] [audio]
#   destino: pasta play.pokemonshowdown.com (padrão: a do projeto, a partir deste script)
#   pacotes: sprites e/ou audio (padrão: os dois)
#   RECURSOS_ZIP_DIR=<pasta>: usa <pasta>/sprites.zip e audio.zip já baixados
#
# Segurança:
#   - só HTTPS (curl --proto =https), e o zip é testado (CRC) antes de extrair;
#   - toda entrada precisa estar dentro de sprites/ ou audio/, sem ".." nem caminho
#     absoluto, e o resultado não pode ter links simbólicos (um link para fora da pasta
#     faria o Caddy servir arquivos do sistema);
#   - a versão nova só substitui a antiga depois de tudo conferido; se algo falhar,
#     a antiga continua no lugar. A pasta de trabalho fica fora da pasta servida.
#
# Arquivos que já existem e não vêm no pacote são preservados: o fork do cliente
# versiona alguns arquivos em sprites/ (index.php, páginas de teste, trainers-custom,
# que o pacote oficial não inclui).
#
# No Windows (ambiente local), o pacote tem nomes que só diferem em maiúsculas
# (ex.: unown-L.gif e unown-l.gif); use RECURSOS_OVERWRITE=1 para ficar com um deles.
#
# Precisa de curl e unzip (Info-ZIP). Na VPS: sudo apt install unzip.
set -eu

BASE_URL=https://pokemonshowdown.com/files/resources
script_dir=$(cd "$(dirname "$0")" && pwd)
dest=${1:-$script_dir/../client/play.pokemonshowdown.com}
[ $# -gt 0 ] && shift
packages=${*:-sprites audio}

fail() {
	echo "[recursos] ERRO: $*" >&2
	exit 1
}

command -v curl >/dev/null || fail "curl não encontrado"
command -v unzip >/dev/null || fail "unzip não encontrado (sudo apt install unzip)"
[ -d "$dest" ] || fail "destino não existe: $dest"
dest=$(cd "$dest" && pwd)

for pkg in $packages; do
	case $pkg in
	sprites | audio) ;;
	*) fail "pacote desconhecido: $pkg (use sprites e/ou audio)" ;;
	esac
done

# Pasta de trabalho no mesmo disco do destino (a troca final é um "mv", sem cópia), mas
# fora da pasta servida pelo Caddy: o zip parcial não fica acessível pela web
work=$(mktemp -d "$(dirname "$dest")/.recursos.XXXXXX")
trap 'rm -rf "$work"' EXIT INT TERM

echo "[recursos] espaço livre em $dest:"
df -h "$dest" | tail -1

for pkg in $packages; do
	zip="$work/$pkg.zip"
	if [ -n "${RECURSOS_ZIP_DIR:-}" ]; then
		# Zips já baixados (sem internet, ou para testar): passam pelas mesmas conferências
		cp "$RECURSOS_ZIP_DIR/$pkg.zip" "$zip"
	else
		echo "[recursos] baixando $pkg.zip..."
		progress=-sS
		[ -t 2 ] && progress=--progress-bar
		curl -fL $progress --proto '=https' --tlsv1.2 --retry 3 -o "$zip" "$BASE_URL/$pkg.zip"
		echo "[recursos] $pkg.zip: $(du -h "$zip" | cut -f1)"
	fi

	echo "[recursos] conferindo $pkg.zip..."
	unzip -tq "$zip" >/dev/null || fail "$pkg.zip corrompido"
	unzip -Z1 "$zip" > "$work/$pkg.list"
	[ -s "$work/$pkg.list" ] || fail "$pkg.zip vazio"
	if grep -v "^$pkg/" "$work/$pkg.list" | grep -q .; then
		fail "$pkg.zip tem entradas fora de $pkg/"
	fi
	if grep -Eq '(^|/)\.\.(/|$)|^/' "$work/$pkg.list"; then
		fail "$pkg.zip tem caminhos com .. ou absolutos"
	fi

	echo "[recursos] extraindo $pkg ($(wc -l < "$work/$pkg.list") entradas)..."
	mkdir -p "$work/new"
	# </dev/null: o unzip nunca fica esperando resposta (nomes repetidos viram erro)
	overwrite=
	[ "${RECURSOS_OVERWRITE:-0}" = 1 ] && overwrite=-o
	unzip -q $overwrite "$zip" -d "$work/new" </dev/null
	rm -f "$zip"
	if [ -n "$(find "$work/new/$pkg" -type l -print -quit)" ]; then
		fail "$pkg.zip tem links simbólicos"
	fi
	# Permissões previsíveis: só leitura para os outros usuários
	find "$work/new/$pkg" -type d -exec chmod 755 {} +
	find "$work/new/$pkg" -type f -exec chmod 644 {} +

	# Preserva o que existe e não veio no pacote (arquivos versionados do fork etc.)
	if [ -d "$dest/$pkg" ]; then
		cp -an "$dest/$pkg/." "$work/new/$pkg/"
	fi
	# Arquivos versionados no git sempre ganham do pacote (ele pode ser mais antigo que o
	# fork); senão, um arquivo modificado travaria o próximo "git pull" do cliente
	if command -v git >/dev/null 2>&1 && git -C "$dest" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		git -C "$dest" ls-files -- "$pkg" | while IFS= read -r tracked; do
			[ -f "$dest/$tracked" ] || continue
			mkdir -p "$(dirname "$work/new/$tracked")"
			cp -p "$dest/$tracked" "$work/new/$tracked"
		done
	else
		echo "[recursos] aviso: sem git aqui; confira depois com 'git -C client status' e restaure com 'git -C client checkout -- play.pokemonshowdown.com/$pkg'"
	fi

	# Troca: a antiga sai só depois de a nova estar pronta
	if [ -e "$dest/$pkg" ]; then
		mv "$dest/$pkg" "$work/old-$pkg"
	fi
	mv "$work/new/$pkg" "$dest/$pkg"
	echo "[recursos] $pkg instalado em $dest/$pkg ($(du -sh "$dest/$pkg" | cut -f1))"
done

echo "[recursos] pronto. Rode o build do cliente para gerar o pokedex-mini (ver docs/recursos-ps.md)."
