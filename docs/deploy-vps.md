# Deploy na VPS

Domínio: **ligadesafios.com.br** (Liga de Desafios).

Passo a passo para subir o projeto numa VPS **limpa**, a partir da opção "SO simples" com **Ubuntu 22.04 LTS** (sem painel e sem aplicações pré-instaladas). Foi escrito para a VPS NVMe da HostGator, mas serve para qualquer VPS Ubuntu com acesso root.

Plano recomendado: **2 vCPU, 4 GB de RAM e 100 GB NVMe** (NVMe 4). Com 2 GB, o build do cliente fica no limite da memória.

Nos comandos, troque:

| Marcador | Por |
|---|---|
| `IP_DA_VPS` | o IPv4 que a HostGator informa no painel |
| `PORTA_SSH` | a porta do SSH da VPS. Na HostGator ela vem como **22022**, não a 22. Confira no painel ou, já na VPS, com `sudo ss -tlnp` |
| `deploy` | o nome do usuário de administração, se quiser outro |
| `SEU_USUARIO` | a sua pasta de usuário no Windows (`C:\Users\SEU_USUARIO`) |

> **Antes de começar:** ative a verificação em duas etapas na conta da HostGator e na do registro do domínio (registro.br ou outro). Quem entra nessas contas controla o servidor e o domínio.

## 1. Chave SSH (no seu computador)

Gere uma chave só para a VPS e proteja-a com uma senha (passphrase). Use o caminho completo, com barras normais: assim o comando funciona em qualquer terminal (PowerShell, Prompt de Comando ou Git Bash). `$env:USERPROFILE` só existe no PowerShell; em outro terminal o caminho fica vazio e dá "No such file or directory".

```
ssh-keygen -t ed25519 -f C:/Users/SEU_USUARIO/.ssh/ps-vps -C ps-vps
```

A chave **privada** (`ps-vps`) nunca sai do seu computador. A **pública** (`ps-vps.pub`) vai para a VPS no passo 3.

## 2. Primeiro acesso e atualização

Entre como root com a senha que a HostGator enviou:

```
ssh -p PORTA_SSH root@IP_DA_VPS
```

Na VPS:

```sh
apt update && apt full-upgrade -y
timedatectl set-timezone America/Sao_Paulo
reboot
```

Espere um minuto e entre de novo como root. Para conferir: `timedatectl | grep "Time zone"` deve mostrar `America/Sao_Paulo`.

## 3. Usuário de administração

```sh
adduser deploy                 # escolha uma senha forte: ela é usada no sudo
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
```

No **seu computador**, em outra janela, copie a chave pública para a VPS. No PowerShell ou no Prompt de Comando:

```
type C:\Users\SEU_USUARIO\.ssh\ps-vps.pub | ssh -p PORTA_SSH root@IP_DA_VPS "cat >> /home/deploy/.ssh/authorized_keys"
```

No Git Bash, troque `type C:\Users\...` por `cat C:/Users/SEU_USUARIO/.ssh/ps-vps.pub`.

De volta na VPS (como root):

```sh
chown -R deploy:deploy /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
cat /home/deploy/.ssh/authorized_keys     # deve mostrar a linha "ssh-ed25519 ... ps-vps"
```

Para facilitar, abra no seu computador o arquivo de configuração do SSH: `notepad C:\Users\SEU_USUARIO\.ssh\config`. Se ele já existir com outros servidores, **não apague nada**: acrescente no final, depois de uma linha em branco:

```
Host ps-vps
    HostName IP_DA_VPS
    Port PORTA_SSH
    User deploy
    IdentityFile ~/.ssh/ps-vps
```

Teste em **outra janela, sem fechar a sessão de root**: `ssh ps-vps` e depois `sudo whoami`, que deve responder `root`. Só siga se isso funcionar.

## 4. SSH só por chave

Ainda como root, crie `/etc/ssh/sshd_config.d/00-hardening.conf`. O nome começa com `00` porque, no OpenSSH, vale o primeiro valor lido, e o Ubuntu da nuvem traz um `50-cloud-init.conf` que pode liberar senha.

```sh
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no
AllowUsers deploy
EOF
sshd -t && systemctl restart ssh
```

Antes de reiniciar o SSH, confira o que ficou valendo. Se alguma linha vier diferente, não reinicie:

```sh
sshd -T | grep -Ei "^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|allowusers)"
# esperado: permitrootlogin no / passwordauthentication no / kbdinteractiveauthentication no / allowusers deploy
```

(Esta conferência vem antes do `systemctl restart ssh` acima: rode-a depois do `sshd -t`.)

Teste de novo em outra janela:
- `ssh ps-vps` deve entrar;
- `ssh -p PORTA_SSH root@IP_DA_VPS` deve ser recusado, com `Permission denied (publickey)`.

A partir daqui, use sempre `ssh ps-vps`.

**Se o `sudo` avisar "unable to resolve host ...":** o nome da máquina não está no `/etc/hosts`, o que acontece na HostGator. Corrija com:

```sh
echo "127.0.1.1 $(hostname) $(hostname -s)" | sudo tee -a /etc/hosts
```

## 5. Firewall e proteção do SSH

Antes, veja se a imagem já traz regras de firewall. Algumas imagens da Oracle Cloud, a infraestrutura da HostGator, bloqueiam tudo menos o SSH. O esperado é `Chain INPUT (policy ACCEPT)`, sem nenhuma regra:

```sh
sudo iptables -L INPUT -n --line-numbers
```

Libere a **porta real do SSH** (`PORTA_SSH`). Se liberar a errada, o `ufw enable` tranca você para fora:

```sh
sudo apt install -y ufw fail2ban
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow PORTA_SSH/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw show added          # confira que aparece "ufw allow PORTA_SSH/tcp"
sudo ufw enable
```

O fail2ban bloqueia por um tempo os IPs com muitas falhas de login no SSH. Ele precisa saber a porta, porque o padrão dele é a 22:

```sh
printf '[sshd]\nport = PORTA_SSH\n' | sudo tee /etc/fail2ban/jail.d/sshd-port.local
sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban
sudo ufw status verbose
sudo fail2ban-client status sshd
```

Teste `ssh ps-vps` numa janela nova, já com o firewall ligado.

> **Atenção ao Docker:** portas publicadas por containers (`ports:` no compose) **passam por fora do ufw**. O compose só publica 80 e 443 (Caddy), que são as portas que devem ficar abertas mesmo. **Nunca** publique as portas 8000 (servidor) ou 9000 (login).

Se o painel da HostGator tiver um firewall próprio (lista de segurança), libere nele as mesmas portas: `PORTA_SSH`, 80 e 443 (TCP) e 443 (UDP).

## 6. Atualizações automáticas e limites do sistema

As atualizações de segurança automáticas já vêm no Ubuntu. Confirme que estão ligadas:

```sh
sudo dpkg-reconfigure -plow unattended-upgrades    # responda "Sim"
```

Reiniciar sozinho quando uma atualização pede é opcional. A reinicialização interrompe batalhas em andamento, por isso o horário sugerido é de madrugada. Para ligar:

```sh
echo 'Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "05:00";' | sudo tee /etc/apt/apt.conf.d/52-reboot
```

Limite os logs do sistema (os dos containers já são limitados no compose):

```sh
sudo mkdir -p /etc/systemd/journald.conf.d
echo '[Journal]
SystemMaxUse=200M
MaxRetentionSec=30day' | sudo tee /etc/systemd/journald.conf.d/limite.conf
sudo systemctl restart systemd-journald
```

Crie um swap de 2 GB, que serve de folga para os picos de memória do build do cliente:

```sh
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 7. Docker

Instale o Docker pelo repositório oficial (não o pacote `docker.io` do Ubuntu, que é mais antigo):

```sh
sudo apt install -y ca-certificates curl git sqlite3 age
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

Saia e entre de novo (`exit` e `ssh ps-vps`) para o grupo valer. Teste com `docker run --rm hello-world`.

> O grupo `docker` equivale a acesso root. Só o usuário `deploy` deve estar nele.

## 8. Domínio

No painel de DNS do domínio `ligadesafios.com.br` (no registro.br, se usar o DNS do próprio Registro.br), crie:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` (o próprio domínio) | `IP_DA_VPS` |
| AAAA | `@` | o IPv6 da VPS, **só se** a HostGator fornecer um |
| CNAME | `www` | `ligadesafios.com.br.` |

O `www` só redireciona para o endereço principal (`https://ligadesafios.com.br`). Sem esse registro, o Caddy fica tentando obter o certificado do `www` e registra erros no log.

Confira, do seu computador, se já propagou (pode levar de minutos a algumas horas):

```powershell
Resolve-DnsName ligadesafios.com.br
Resolve-DnsName www.ligadesafios.com.br
```

**O passo 10 só funciona depois disso.** O Caddy pede o certificado HTTPS ao Let's Encrypt no primeiro start, e o Let's Encrypt precisa achar a VPS pelo domínio.

## 9. Código do projeto

```sh
sudo mkdir -p /opt/pokemon-showdown-custom
sudo chown deploy:deploy /opt/pokemon-showdown-custom
cd /opt/pokemon-showdown-custom
git clone https://github.com/Rafaciba/pokemon-showdown-custom.git .
git clone https://github.com/Rafaciba/pokemon-showdown.git server
git clone https://github.com/Rafaciba/pokemon-showdown-client.git client
git -C server checkout main
git -C client checkout main
```

Crie o `.env` a partir do modelo:

```sh
cp .env.example .env
chmod 600 .env
nano .env
```

Valores para produção:

```
PS_HOST=ligadesafios.com.br
LOGIN_KEY_ID=1
CLIENT_FORCE_BUILD=0
PS_NO_IP_CHECKS=0
PS_ADMINS=Rafaciba
PS_ACCESS_LOG_DIR=/var/log/ps-custom/caddy
PS_UID=1000
PS_GID=1000
```

`PS_ACCESS_LOG_DIR` é a pasta do log de acesso do site (com IP, guardado por 14 dias para segurança; ver o passo 12 e `docs/revisao-seguranca-lgpd.md`). Crie a pasta, fechada para os outros usuários:

```sh
sudo install -d -m 700 /var/log/ps-custom /var/log/ps-custom/caddy
```

No start, o serviço `volume-init` passa o dono dela para o usuário dos containers.

`PS_UID` e `PS_GID` são o usuário com que os containers rodam (nenhum roda como root). Use os do `deploy`, para que ele continue dono dos arquivos e o `git pull` funcione. Confira com:

```sh
id -u deploy; id -g deploy
```

O normal é `1000` e `1000`. Se for outro número, ajuste no `.env`.

`PS_NO_IP_CHECKS` fica em `0` na VPS (decisão de 2026-10-17): a ladder não pareia jogadores do mesmo IP. Quem joga da mesma casa usa desafio direto.

### Sprites e sons

Os sprites e os sons do jogo vêm dos pacotes oficiais do PS, baixados direto na VPS (cerca de 1,1 GB; ver [recursos-ps.md](recursos-ps.md)). Precisa de uns 3 GB livres durante a instalação:

```sh
df -h /
sudo apt install -y unzip
cd /opt/pokemon-showdown-custom
sh scripts/recursos-ps.sh
```

O passo 10 (`client-build`) gera o `pokedex-mini.js` a partir deles. Sem os pacotes, o jogo funciona do mesmo jeito, buscando as imagens e os sons no site oficial pelo nosso servidor.

### Imagens das insígnias

As imagens das insígnias não ficam no git (ver [insignias.md](insignias.md)). Gere-as no seu computador com o importador (passos 1 a 3 de "Como importar" em `docs/insignias.md`) e copie para a VPS. Na VPS:

```sh
mkdir -p /opt/pokemon-showdown-custom/assets/badges
```

No seu computador (PowerShell), na pasta do projeto:

```powershell
scp -r assets/badges ps-vps:/opt/pokemon-showdown-custom/assets/
```

Use a pasta inteira com `-r`: o PowerShell não expande `*.png` para o `scp`.

Confira na VPS: `ls /opt/pokemon-showdown-custom/assets/badges | wc -l` deve mostrar 68. Sem as imagens, o jogo funciona, mas as insígnias aparecem quebradas.

## 10. Primeiro start

```sh
docker compose up -d
docker compose logs -f server-setup client-build server web
```

O primeiro start leva vários minutos: o `server-setup` instala as dependências e compila o servidor, e o `client-build` gera os dados do teambuilder e compila o cliente. Está pronto quando o log do `server` mostra `Worker 1 now listening` e o `web` mostra que obteve o certificado (`certificate obtained successfully`). Saia do log com `Ctrl+C`; os serviços continuam rodando.

Confira o estado:

```sh
docker compose ps
```

`login`, `server` e `web` devem estar `Up` (os dois primeiros com `healthy`), e `volume-init`, `server-setup` e `client-build` com `Exited (0)`: eles preparam tudo e terminam.

Abra `https://ligadesafios.com.br` no navegador.

## 11. Conta de admin

```sh
docker compose exec login node src/cli.ts convite --nome Rafaciba
```

Abra o link que o comando mostra, escolha a senha na página (ela nunca passa pelo terminal) e entre no jogo. Você terá o rank `~`. Os demais convites saem pelo chat, com `/convite`.

## 12. Log de acesso e backup

### Log de acesso (14 dias)

O Caddy grava cada acesso ao site (IP, data, caminho sem códigos, status) em `/var/log/ps-custom/caddy/access.log`. A rotação diária e o apagamento depois de 14 dias ficam com o logrotate do sistema:

```sh
cd /opt/pokemon-showdown-custom
sudo install -m 644 docker/logrotate/ps-custom-caddy /etc/logrotate.d/ps-custom-caddy
sudo logrotate -d /etc/logrotate.d/ps-custom-caddy 2>&1 | tail -5
```

O `-d` só simula: não deve mostrar erro. Para consultar o log (a pasta é do usuário dos containers, o `deploy`; os outros usuários não a leem):

```sh
sudo tail -n 20 /var/log/ps-custom/caddy/access.log
```

O log de acesso **não** entra no backup, de propósito: o backup duraria mais que os 14 dias.

### Backup

A HostGator **não** faz backup das VPS, então o backup é nosso. O script [scripts/vps-backup.sh](../scripts/vps-backup.sh) copia todos os dados que não podem ser recriados:
- contas e chaves do login;
- jornadas e conquistas;
- ranks, salas, ladders e punições;
- o `.env`;
- as imagens das insígnias, que ficam fora do git.

O arquivo sai **criptografado** com `age` para uma chave pública. A chave privada fica só no seu computador, então quem invadir a VPS não consegue abrir os backups.

**No seu computador**, instale o age (`winget install FiloSottile.age`) e gere o par de chaves:

```powershell
age-keygen -o "$env:USERPROFILE\.ssh\ps-backup-key.txt"
```

O comando mostra a chave pública (`age1...`). Guarde o arquivo da chave privada também fora do computador, por exemplo num gerenciador de senhas: **sem ele, nenhum backup pode ser aberto**.

**Na VPS**, registre a chave pública e agende o backup diário às 03:00. O horário precisa ser antes do reinício automático do passo 6, se ele estiver ligado (o exemplo usa 04:00 ou 05:00), para o backup não ser interrompido:

```sh
sudo mkdir -p /etc/ps-custom
echo 'age1...COLE_A_CHAVE_PUBLICA...' | sudo tee /etc/ps-custom/backup-recipient.txt
echo '0 3 * * * root BACKUP_GROUP=deploy /bin/sh /opt/pokemon-showdown-custom/scripts/vps-backup.sh >> /var/log/ps-custom-backup.log 2>&1' | sudo tee /etc/cron.d/ps-custom-backup
sudo BACKUP_GROUP=deploy sh /opt/pokemon-showdown-custom/scripts/vps-backup.sh     # primeiro backup, para testar
```

Os backups ficam em `/var/backups/ps-custom` por **14 dias** (`KEEP_DAYS` no script). Com `BACKUP_GROUP=deploy`, o usuário `deploy` pode ler os arquivos (já criptografados) sem sudo.

**Cópia fora da VPS.** Um backup que só existe na própria VPS se perde junto com ela. Do seu computador, traga os arquivos de tempos em tempos:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\Backups\ps-custom" | Out-Null
scp "ps-vps:/var/backups/ps-custom/*.age" "$env:USERPROFILE\Backups\ps-custom\"
```

**Para conferir um backup** no seu computador (não precisa restaurar):

```powershell
age -d -i C:\Users\SEU_USUARIO\.ssh\ps-backup-key.txt -o teste.tar.gz ps-custom-AAAA-MM-DD_HHMM.tar.gz.age
tar -tzf teste.tar.gz
Remove-Item teste.tar.gz      # é a cópia sem criptografia: não deixe no disco
```

Não use `age ... | tar ...` no Windows PowerShell 5.1: ele trata o que passa pelo `|` como texto e corrompe o arquivo ("Unrecognized archive format").

> **LGPD:** quem exclui a conta continua nos backups até eles vencerem (14 dias na VPS, como diz o aviso de privacidade). As cópias no seu computador ficam a seu critério: apague as antigas de tempos em tempos.

### Restaurar numa VPS nova

1. Faça os passos 1 a 9 (sem o 10).
2. Copie o backup para a VPS e abra-o com a chave privada. No seu computador:
   ```powershell
   age -d -i "$env:USERPROFILE\.ssh\ps-backup-key.txt" -o backup.tar.gz ps-custom-AAAA-MM-DD_HHMM.tar.gz.age
   scp backup.tar.gz ps-vps:/tmp/
   ```
   Apague o `backup.tar.gz` do computador depois: ele não está criptografado.
3. Na VPS:
   ```sh
   cd /opt/pokemon-showdown-custom
   mkdir /tmp/restore && tar -xzf /tmp/backup.tar.gz -C /tmp/restore
   cp /tmp/restore/env .env && chmod 600 .env
   cp -a /tmp/restore/server/config/. server/config/
   mkdir -p server/databases && cp /tmp/restore/server/databases/*.db server/databases/
   mkdir -p assets && cp -a /tmp/restore/assets/badges assets/
   docker compose create            # cria os volumes sem iniciar nada
   sudo cp -a /tmp/restore/login/. /var/lib/docker/volumes/pokemon-showdown-custom_login-data/_data/
   rm -rf /tmp/restore /tmp/backup.tar.gz
   docker compose up -d
   ```
   Só a chave privada precisa voltar: a pública é sempre derivada dela, e o token interno é recriado sozinho. O `volume-init` ajusta o dono dos arquivos copiados com `sudo`.
4. Se o IP mudou, atualize o registro A do domínio.

## 13. Atualizar o projeto

Depois de um push nos repositórios:

```sh
cd /opt/pokemon-showdown-custom
git pull
git -C server pull
git -C client pull
docker compose up -d --force-recreate
```

O `--force-recreate` recria todos os serviços na ordem certa: `volume-init`, `server-setup` (dependências e build do servidor), `client-build`, `login`, `server` e `web`. Assim também entram as mudanças do `login/`, do `docker/caddy/Caddyfile` e do `docker-compose.yml`. O site fica fora do ar enquanto isso, em torno de 1 minuto (mais, se o cliente precisar do build completo).

**Não use `docker compose restart server` depois de um `git pull`:** o servidor roda com o código somente leitura, e quem compila é o `server-setup`. O `restart` só reinicia o servidor com o build antigo.

Se a mudança mexeu em formatos ou mods que o teambuilder precisa enxergar, use `CLIENT_FORCE_BUILD=1 docker compose up -d --force-recreate`.

Reiniciar o `server` interrompe as batalhas em andamento. As batalhas do Desafio de Ginásios ficam salvas e reabrem do mesmo ponto quando o jogador entra de novo; as batalhas entre jogadores são perdidas. Prefira horários vazios.

Se o catálogo de insígnias mudou (reimportação), copie as imagens novas como no passo 9.

**Não rode os testes na VPS.** Eles são para o ambiente local. Antes de enviar mudanças grandes, rode no seu computador o teste de ponta a ponta (`sh scripts/e2e.sh`, ver [testes-e2e.md](testes-e2e.md)).

### Migrar para os containers endurecidos (uma vez)

Até 2026-10-19 os containers rodavam como root, e por isso parte dos arquivos do projeto ficou com o root como dono. O `volume-init` cuida dos volumes e da pasta do log de acesso, mas a pasta do projeto precisa de um ajuste manual, uma única vez:

```sh
cd /opt/pokemon-showdown-custom
docker compose down
git pull
git -C server pull
git -C client pull
grep -q '^PS_UID=' .env || printf 'PS_UID=%s
PS_GID=%s
' "$(id -u deploy)" "$(id -g deploy)" >> .env
sudo chown -R deploy:deploy /opt/pokemon-showdown-custom
docker compose up -d
docker compose logs volume-init server-setup
```

O `volume-init` mostra "ajustando o dono de ..." para cada volume na primeira vez, e nada nas seguintes. O `server-setup` reinstala as dependências (sem as que não usamos) e termina com `[setup] pronto`.

### Atualizar as imagens

As imagens (`node` e `caddy`) ficam fixadas por digest no `docker-compose.yml`: uma imagem trocada no Docker Hub não entra sem querermos. Para trazer as correções de segurança, atualize de tempos em tempos (por exemplo, uma vez por mês) no ambiente local:

```sh
docker pull node:24-bookworm-slim
docker pull caddy:2.10-alpine
docker image inspect node:24-bookworm-slim caddy:2.10-alpine --format '{{index .RepoDigests 0}}'
```

Troque os digests no `docker-compose.yml` (`x-node-image` e a imagem do `web`), teste localmente e faça o commit. Na VPS, a atualização normal (acima) baixa as imagens novas.

## 14. Comandos úteis

| Situação | Comando |
|---|---|
| Estado dos serviços | `docker compose ps` |
| Logs recentes | `docker compose logs --since 1h server` |
| Uso de memória e CPU | `docker stats --no-stream` |
| Espaço em disco | `df -h /` e `docker system df` |
| Limpar imagens antigas | `docker image prune` |
| IPs bloqueados pelo fail2ban | `sudo fail2ban-client status sshd` |
| Último backup | `tail /var/log/ps-custom-backup.log` |

## Problemas comuns

- **O navegador não abre o site ou o certificado não sai.**
  - Confira se o DNS já aponta para a VPS (`Resolve-DnsName ligadesafios.com.br`).
  - Confira se as portas 80 e 443 estão abertas no ufw e no firewall do painel da HostGator.
  - Veja o log: `docker compose logs web`.
  - Algumas imagens Ubuntu da Oracle Cloud (a infraestrutura da HostGator) vêm com regras de `iptables` que bloqueiam tudo menos o SSH. Se `sudo iptables -L INPUT -n` mostrar um `REJECT` antes das regras do ufw, avise para ajustarmos.
- **O build do cliente morre sem erro claro** (o log para no meio). Provavelmente faltou memória: confira o swap com `free -h`.
- **`Permission denied` ou `EACCES` no log de um serviço.** Algum arquivo ficou com outro dono, por exemplo depois de um comando com `sudo` na pasta do projeto. Rode `sudo chown -R deploy:deploy /opt/pokemon-showdown-custom` e `docker compose up -d --force-recreate`.
- **"Couldn't connect to server" no cliente.** O `PS_HOST` do `.env` precisa ser exatamente o domínio usado no navegador. Depois de mudá-lo, rode `docker compose up -d --force-recreate`.
