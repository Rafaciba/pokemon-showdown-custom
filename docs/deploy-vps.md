# Deploy na VPS

Domínio: **ligadesafios.com.br** (Liga de Desafios).

Passo a passo para subir o projeto numa VPS **limpa**, a partir da opção "SO simples" com **Ubuntu 22.04 LTS** (sem painel e sem aplicações pré-instaladas). Foi escrito para a VPS NVMe da HostGator, mas serve para qualquer VPS Ubuntu com acesso root.

Plano recomendado: **2 vCPU, 4 GB de RAM e 100 GB NVMe** (NVMe 4). Com 2 GB, o build do cliente fica no limite da memória.

Nos comandos, troque:

| Marcador | Por |
|---|---|
| `IP_DA_VPS` | o IPv4 que a HostGator informa no painel |
| `deploy` | o nome do usuário de administração, se quiser outro |

> **Antes de começar:** ative a verificação em duas etapas na conta da HostGator e na do registro do domínio (registro.br ou outro). Quem entra nessas contas controla o servidor e o domínio.

## 1. Chave SSH (no seu computador)

No PowerShell do Windows, gere uma chave só para a VPS. Proteja-a com uma senha (passphrase):

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\ps-vps" -C "ps-vps"
```

A chave **privada** (`ps-vps`) nunca sai do seu computador. A **pública** (`ps-vps.pub`) vai para a VPS no passo 3.

## 2. Primeiro acesso e atualização

Entre como root com a senha que a HostGator enviou:

```powershell
ssh root@IP_DA_VPS
```

Na VPS:

```sh
apt update && apt full-upgrade -y
timedatectl set-timezone America/Sao_Paulo
reboot
```

Espere um minuto e entre de novo como root.

## 3. Usuário de administração

```sh
adduser deploy                 # escolha uma senha forte: ela é usada no sudo
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
```

No **seu computador**, em outra janela do PowerShell, copie a chave pública para a VPS:

```powershell
Get-Content "$env:USERPROFILE\.ssh\ps-vps.pub" | ssh root@IP_DA_VPS "cat >> /home/deploy/.ssh/authorized_keys"
```

De volta na VPS (como root):

```sh
chown -R deploy:deploy /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Para facilitar, crie no seu computador o arquivo `%USERPROFILE%\.ssh\config` com:

```
Host ps-vps
    HostName IP_DA_VPS
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

Teste de novo em outra janela: `ssh ps-vps` deve entrar e `ssh root@IP_DA_VPS` deve ser recusado. A partir daqui, use sempre `ssh ps-vps`.

## 5. Firewall e proteção do SSH

```sh
sudo apt install -y ufw fail2ban
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo systemctl enable --now fail2ban
```

O fail2ban já protege o SSH na configuração padrão do Ubuntu: bloqueia por um tempo os IPs com muitas falhas de login.

> **Atenção ao Docker:** portas publicadas por containers (`ports:` no compose) **passam por fora do ufw**. O compose só publica 80 e 443 (Caddy), que são as portas que devem ficar abertas mesmo. **Nunca** publique as portas 8000 (servidor) ou 9000 (login).

Se o painel da HostGator tiver um firewall próprio (lista de segurança), libere nele as mesmas portas: 22, 80 e 443 (TCP) e 443 (UDP).

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
```

`PS_NO_IP_CHECKS` fica em `0` na VPS (decisão de 2026-10-17): a ladder não pareia jogadores do mesmo IP. Quem joga da mesma casa usa desafio direto.

## 10. Primeiro start

```sh
docker compose up -d
docker compose logs -f client-build server web
```

O primeiro start leva vários minutos: instala dependências, compila o servidor, gera os dados do teambuilder e compila o cliente. Está pronto quando o log do `server` mostra `Worker 1 now listening` e o `web` mostra que obteve o certificado (`certificate obtained successfully`). Saia do log com `Ctrl+C`; os serviços continuam rodando.

Confira o estado:

```sh
docker compose ps
```

`login`, `server` e `web` devem estar `Up` (os dois primeiros com `healthy`), e o `client-build` com `Exited (0)`.

Abra `https://ligadesafios.com.br` no navegador.

## 11. Conta de admin

```sh
docker compose exec login node src/cli.ts convite --nome Rafaciba
```

Abra o link que o comando mostra, escolha a senha na página (ela nunca passa pelo terminal) e entre no jogo. Você terá o rank `~`. Os demais convites saem pelo chat, com `/convite`.

## 12. Backup

A HostGator **não** faz backup das VPS, então o backup é nosso. O script [scripts/vps-backup.sh](../scripts/vps-backup.sh) copia todos os dados que não podem ser recriados:
- contas e chaves do login;
- jornadas e conquistas;
- ranks, salas, ladders e punições;
- o `.env`.

O arquivo sai **criptografado** com `age` para uma chave pública. A chave privada fica só no seu computador, então quem invadir a VPS não consegue abrir os backups.

**No seu computador**, instale o age (`winget install FiloSottile.age`) e gere o par de chaves:

```powershell
age-keygen -o "$env:USERPROFILE\.ssh\ps-backup-key.txt"
```

O comando mostra a chave pública (`age1...`). Guarde o arquivo da chave privada também fora do computador, por exemplo num gerenciador de senhas: **sem ele, nenhum backup pode ser aberto**.

**Na VPS**, registre a chave pública e agende o backup diário às 04:00:

```sh
sudo mkdir -p /etc/ps-custom
echo 'age1...COLE_A_CHAVE_PUBLICA...' | sudo tee /etc/ps-custom/backup-recipient.txt
echo '0 4 * * * root BACKUP_GROUP=deploy /bin/sh /opt/pokemon-showdown-custom/scripts/vps-backup.sh >> /var/log/ps-custom-backup.log 2>&1' | sudo tee /etc/cron.d/ps-custom-backup
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
age -d -i "$env:USERPROFILE\.ssh\ps-backup-key.txt" ps-custom-AAAA-MM-DD_HHMM.tar.gz.age | tar -tzf -
```

> **LGPD:** quem exclui a conta continua nos backups até eles vencerem (14 dias na VPS, e o prazo que você mantiver no seu computador). O aviso de privacidade ainda **não** menciona isso. Decida o prazo das cópias fora da VPS e me avise, para atualizarmos o aviso (`login/src/privacy.ts`).

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
   docker compose create            # cria os volumes sem iniciar nada
   sudo cp -a /tmp/restore/login/. /var/lib/docker/volumes/pokemon-showdown-custom_login-data/_data/
   rm -rf /tmp/restore /tmp/backup.tar.gz
   docker compose up -d
   ```
   Só a chave privada precisa voltar: a pública é sempre derivada dela, e o token interno é recriado sozinho.
4. Se o IP mudou, atualize o registro A do domínio.

## 13. Atualizar o projeto

Depois de um push nos repositórios:

```sh
cd /opt/pokemon-showdown-custom
git pull
git -C server pull
git -C client pull
docker compose run --rm client-build
docker compose up -d
docker compose restart server
```

Se a mudança mexeu em formatos ou mods que o teambuilder precisa enxergar, troque a 5ª linha por `CLIENT_FORCE_BUILD=1 docker compose run --rm client-build`. Se mexeu só no `login/`, basta `docker compose restart login`.

Reiniciar o `server` interrompe as batalhas em andamento: a batalha de jornada é anulada, sem contar nem vitória nem derrota. Prefira horários vazios.

**Não rode os testes na VPS.** Eles são para o ambiente local.

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
- **"Couldn't connect to server" no cliente.** O `PS_HOST` do `.env` precisa ser exatamente o domínio usado no navegador. Depois de mudá-lo, rode `docker compose run --rm client-build` e `docker compose up -d`.

## Pendências antes de abrir para os amigos

Estes pontos já estão no relatório de segurança ([revisao-seguranca-lgpd.md](revisao-seguranca-lgpd.md)) e **ainda não foram feitos**. O deploy funciona sem eles, mas o ideal é fechá-los antes de abrir o servidor:

- **Sprites e sons próprios** (decisão: feito no deploy da VPS). Hoje o Caddy os busca no site oficial, sem repassar dados do jogador. Hospedá-los na VPS ocupa alguns GB de disco.
- **Containers de produção endurecidos:**
  - usuário sem privilégios;
  - código somente leitura;
  - `cap_drop: ALL` e `no-new-privileges`;
  - imagens fixadas por digest;
  - dependências sem pacotes opcionais e `npm audit`.
- **Prazo de retenção do modlog** e **prazo das cópias de backup fora da VPS**, para constarem no aviso de privacidade.
