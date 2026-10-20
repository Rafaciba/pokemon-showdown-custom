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

1. ajusta o dono dos volumes para o usuário sem privilégios (`volume-init`);
2. instala as dependências e compila o servidor (`server-setup`);
3. gera os dados do teambuilder a partir do `server/` e compila o cliente (`client-build`).

Para acompanhar:

```sh
docker compose logs -f server-setup client-build server
```

### Primeira vez depois do endurecimento (2026-10-19)

Os containers rodavam como root, e os arquivos que eles criaram em `server/`, `client/` e `data/` ficaram com o root como dono (o Docker Desktop guarda isso). Agora todos rodam com o usuário `PS_UID:PS_GID` (1000), que não consegue gravar nesses arquivos. Ajuste uma vez, no Git Bash:

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/server:/s" -v "$(pwd -W)/client:/c" -v "$(pwd -W)/data:/d" node:24-bookworm-slim chown -R 1000:1000 /s /c /d
```

Leva cerca de 1 minuto. Os volumes o `volume-init` ajusta sozinho.

### Certificado HTTPS local

O Caddy usa uma CA própria para `ps.localhost`, então na primeira vez o navegador mostra um aviso de certificado. Você tem duas opções:

- aceitar o aviso; ou
- confiar na CA local de uma vez, no PowerShell:

```powershell
docker compose cp web:/data/caddy/pki/authorities/local/root.crt "$env:TEMP\caddy-root.crt"
Import-Certificate -FilePath "$env:TEMP\caddy-root.crt" -CertStoreLocation Cert:\CurrentUser\Root
```

O cliente exige HTTPS mesmo localmente, porque compara a própria origem com `https://{routes.client}`.

## Contas

O servidor **exige conta**, e o cadastro só acontece com um convite de uso único que vale 3 dias. Quem não tem conta continua como "Guest": não escolhe nome, não joga e não fala no chat.

### Primeira vez: criar a conta de admin

1. Coloque o seu nome em `PS_ADMINS` no `.env`, por exemplo `PS_ADMINS=Rafaciba`, e rode `docker compose up -d`.
2. Gere um convite reservado para esse nome:
   ```sh
   docker compose exec login node src/cli.ts convite --nome Rafaciba
   ```
3. Abra o link que o comando mostra (https://ps.localhost/cadastro?convite=...) e escolha sua senha ali. A senha nunca passa pelo terminal.
4. Entre no jogo com o seu nome e senha. Você terá o rank `~` (administrador).

### Convites e senhas

| Ação | No chat do jogo (admin) | No terminal |
|---|---|---|
| Gerar convite | `/convite` | `docker compose exec login node src/cli.ts convite` |
| Convite só para um nome | `/convite Nome` | `... convite --nome Nome` |
| Código para redefinir senha (24h) | `/redefinirsenha Nome` | `... redefinir Nome` |
| Contar contas e convites | — | `... usuarios` |

O código aparece só para quem gerou. Envie-o em particular.

No painel admin (`/ginasioadmin`), o botão **Convites** abre uma página que faz o mesmo: gerar convites (com nome reservado opcional), listar os pendentes, revogar um convite e gerar o código de redefinição de senha. A lista não mostra os códigos, que o login guarda só como hash: cada código aparece uma única vez, logo depois de gerado.

### Páginas

- `/cadastro`: criar conta com convite.
- `/redefinir`: usar o código de redefinição de senha.
- `/conta`: trocar a senha, sair ou **excluir a conta** (com aviso de que tudo será apagado). No jogo, `/conta` mostra o link.
- `/privacidade`: aviso de privacidade (LGPD).
- `/regras`: regras do servidor e do Desafio de Ginásios. O `/rules` do PS e o link "Rules" do rodapé apontam para ela.

Trocar a senha também funciona pela opção "Password..." do próprio cliente.

## Serviços

| Serviço | O que faz | Porta |
|---|---|---|
| `web` | Caddy: HTTPS, cliente estático e proxy | 80/443 (públicas) |
| `login` | login server próprio (`login/`) | 9000 (interna) |
| `server` | servidor de jogo do PS (`server/`) | 8000 (interna) |
| `volume-init` | ajusta o dono dos volumes e encerra (único com root, só com permissão de trocar donos) | — |
| `server-setup` | instala as dependências do servidor, compila e encerra | — |
| `client-build` | compila o cliente e encerra | — |

Endurecimento (ver `docs/revisao-seguranca-lgpd.md`, seção "Containers"): os serviços rodam sem root (`PS_UID:PS_GID`), com o sistema de arquivos somente leitura, sem capabilities (o `web` só com a de abrir as portas 80 e 443), sem ganho de privilégios e com limite de memória e de processos. O `server` só grava em `config/`, `databases/` e `logs/`; o código, o build e as dependências ficam somente leitura para ele.

Rotas no domínio:

- `/showdown/*` → servidor de jogo (WebSocket)
- `/~~custom/action.php` e `/api/*` → login server
- `/` e `/{sala}` → cliente clássico
- só o **cliente clássico** é servido; `/preactalpha` e as demais rotas do cliente novo também abrem o clássico (decisão de 2026-10-17)

## Comandos do dia a dia

| Situação | Comando |
|---|---|
| Mudou código do `server/` | `docker compose up -d --force-recreate server` (refaz o `server-setup` e o `client-build`). O `restart` sozinho não compila |
| Mudou formatos/mods e quer que o teambuilder enxergue | `CLIENT_FORCE_BUILD=1 docker compose up -d --force-recreate server` |
| Mudou código do `client/` | `docker compose run --rm client-build` |
| Mudou o `login/` | `docker compose restart login` |
| Mudou o `docker-compose.yml` ou o `Caddyfile` | `docker compose up -d --force-recreate` |
| Rodar os testes do servidor | `docker compose run --rm --no-deps server-setup sh /opt/ps/test.sh test/main.js test/server/chat-plugins/gym-challenge.js` (no Git Bash, com `MSYS_NO_PATHCONV=1` na frente) |
| Rodar os testes do login | `docker compose run --rm --no-deps login npm test` |
| Teste de ponta a ponta (site, contas, convites, jornada) | `sh scripts/e2e.sh` (ver [testes-e2e.md](testes-e2e.md)) |
| Parar tudo | `docker compose down` |
| Apagar tudo, incluindo contas, chaves e certificados | `docker compose down -v` |

## Configuração

As variáveis ficam no arquivo `.env`, que é ignorado pelo git. Use `.env.example` como modelo.

| Variável | Padrão | Para que serve |
|---|---|---|
| `PS_HOST` | `ps.localhost` | Domínio do site. **Não use `localhost` puro**: com ele, o cliente clássico tenta conectar por `ws://` sem TLS e falha com "Couldn't connect to server". Qualquer `*.localhost` aponta para a própria máquina. |
| `PS_NO_IP_CHECKS` | `0` | Com `1`, a ladder pareia jogadores do mesmo IP e os limites por IP ficam desligados. Serve para testar com duas abas. Sem isso, a busca fica infinita, porque o PS nunca junta dois jogadores do mesmo IP. |
| `CLIENT_FORCE_BUILD` | `0` | Com `1`, força o build completo do cliente. |
| `LOGIN_KEY_ID` | `1` | ID da chave de login. |
| `PS_UID` / `PS_GID` | `1000` | Usuário e grupo com que os containers rodam. Na VPS, os do usuário dono da pasta do projeto. |

Depois de mudar o `.env`, rode `docker compose up -d --force-recreate`.

Nada de configuração é alterado dentro dos forks. Os templates ficam em `docker/`:

- `docker/server/config.js` é montado somente leitura em `server/config/config.js` no `server`, e copiado para lá pelo `server-setup` (para os testes). Esse destino é ignorado pelo git do fork.
- `docker/server/derive-package.cjs` gera o `package.json` usado na instalação das dependências, sem as que não usamos. O do fork não muda.
- `docker/client/config.js` e `docker/client/routes.json` são templates. O build substitui `__PS_HOST__` pelo valor configurado e grava o resultado no volume `client-config`, que o Caddy serve em `/config/*`. A pasta `config/` do fork não é tocada.
- `docker/caddy/Caddyfile` contém as regras equivalentes ao `.htaccess` original do cliente.

## Segredos e dados do login

No primeiro start, o login server gera:

- um par RSA de 3072 bits. A chave **privada** fica no volume `login-data`, acessível só pelo serviço `login`. A **pública** fica no volume `login-shared`, montado somente leitura no `server`;
- um **token interno**, também no `login-shared`. Com ele o servidor de jogo pede convites ao login pela API `/internal/*`, que o Caddy não expõe.

O banco SQLite de contas (`login.db`) fica no volume `login-data`. Nada disso vai para o git.

Dados guardados (LGPD):

- **contas:** nome de usuário e hash scrypt da senha. Sem e-mail e sem IP;
- **sessões:** hash do token, com validade de 30 dias renovada a cada uso;
- **códigos de convite e de redefinição:** guardados como hash e apagados ao serem usados ou ao vencerem;
- **trilha de segurança:** senhas erradas e bloqueios, códigos inválidos, mudanças nas contas, convites e pedidos recusados, com data, conta e IP, por 30 dias (também depois da exclusão da conta). O admin consulta pelo botão **Segurança** do painel.

Os registros vencidos são apagados a cada hora.

## Pendências conhecidas

Nenhuma no momento.
