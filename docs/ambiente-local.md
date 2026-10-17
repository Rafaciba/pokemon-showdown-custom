# Ambiente local

Todo o ambiente roda em Docker. Não é preciso instalar Node, PHP ou banco de dados na máquina.

## Pré-requisitos

- Docker Desktop
- `server/` e `client/` clonados (ver [README](../README.md))

## Subir

```sh
docker compose up -d
```

Abra **https://ps.localhost**.

O primeiro start demora alguns minutos. Nele o Docker:

1. instala as dependências;
2. compila o servidor;
3. gera os dados do teambuilder a partir do `server/`;
4. compila o cliente.

Para acompanhar:

```sh
docker compose logs -f client-build server
```

### Certificado HTTPS local

O Caddy usa uma CA própria para `ps.localhost`, então na primeira vez o navegador mostra um aviso de certificado. Você tem duas opções:

- aceitar o aviso; ou
- confiar na CA local de uma vez, no PowerShell:

```powershell
docker compose cp web:/data/caddy/pki/authorities/local/root.crt "$env:TEMP\caddy-root.crt"
Import-Certificate -FilePath "$env:TEMP\caddy-root.crt" -CertStoreLocation Cert:\CurrentUser\Root
```

O cliente exige HTTPS mesmo localmente, porque compara a própria origem com `https://{routes.client}`.

## Serviços

| Serviço | O que faz | Porta |
|---|---|---|
| `web` | Caddy: HTTPS, cliente estático e proxy | 80/443 (públicas) |
| `login` | login server próprio (`login/`) | 9000 (interna) |
| `server` | servidor de jogo do PS (`server/`) | 8000 (interna) |
| `client-build` | compila o cliente e encerra | — |

Rotas no domínio:

- `/showdown/*` → servidor de jogo (WebSocket)
- `/~~custom/action.php` e `/api/*` → login server
- `/` e `/{sala}` → cliente clássico
- `/preactalpha` → cliente novo (Preact)

## Comandos do dia a dia

| Situação | Comando |
|---|---|
| Mudou código do `server/` | `docker compose restart server` (ou `/hotpatch` no chat, como admin) |
| Mudou formatos/mods e quer que o teambuilder enxergue | `CLIENT_FORCE_BUILD=1 docker compose run --rm client-build` e depois `docker compose restart server` |
| Mudou código do `client/` | `docker compose run --rm client-build` |
| Mudou o `login/` | `docker compose restart login` |
| Parar tudo | `docker compose down` |
| Apagar tudo, incluindo chaves e certificados | `docker compose down -v` |

## Configuração

As variáveis ficam no arquivo `.env`, que é ignorado pelo git. Use `.env.example` como modelo.

| Variável | Padrão | Para que serve |
|---|---|---|
| `PS_HOST` | `ps.localhost` | Domínio do site. **Não use `localhost` puro**: com ele, o cliente clássico tenta conectar por `ws://` sem TLS e falha com "Couldn't connect to server". Qualquer `*.localhost` aponta para a própria máquina. |
| `PS_NO_IP_CHECKS` | `0` | Com `1`, a ladder pareia jogadores do mesmo IP e os limites por IP ficam desligados. Serve para testar com duas abas. Sem isso, a busca fica infinita, porque o PS nunca junta dois jogadores do mesmo IP. |
| `CLIENT_FORCE_BUILD` | `0` | Com `1`, força o build completo do cliente. |
| `LOGIN_KEY_ID` | `1` | ID da chave de login. |

Depois de mudar o `.env`, rode `docker compose up -d`. Se mudou o `PS_HOST`, rode também `docker compose run --rm client-build`.

Nada de configuração é alterado dentro dos forks. Os templates ficam em `docker/`:

- `docker/server/config.js` é copiado para `server/config/config.js` a cada start do servidor. Esse destino é ignorado pelo git do fork.
- `docker/client/config.js` e `docker/client/routes.json` são templates. O build substitui `__PS_HOST__` pelo valor configurado e grava o resultado no volume `client-config`, que o Caddy serve em `/config/*`. A pasta `config/` do fork não é tocada.
- `docker/caddy/Caddyfile` contém as regras equivalentes ao `.htaccess` original do cliente.

## Chaves de login

O login server gera um par RSA de 3072 bits no primeiro start:

- a chave **privada** fica no volume `login-data`, acessível só pelo serviço `login`;
- a chave **pública** fica no volume `login-public-key`, montado em modo somente leitura no `server`.

Nenhuma das duas vai para o git.

## Pendências conhecidas

- **Sprites e áudio** não estão no repositório do cliente. Provisoriamente, o Caddy os busca em play.pokemonshowdown.com. Para a VPS, avaliar hospedar esses arquivos nós mesmos.
- Os containers de desenvolvimento rodam como `root`. As imagens de produção (VPS) devem usar um usuário sem privilégios.
