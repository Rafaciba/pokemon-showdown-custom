# Teste de ponta a ponta

Teste automático do ambiente **local**, feito com o Playwright Test. Ele passa pelo site como um admin e um jogador fariam, no navegador, e confere o resultado. Serve para rodar antes de cada deploy ou depois de mudanças grandes.

## Como rodar

Com o ambiente de pé (`docker compose up -d`), na raiz do projeto, no Git Bash:

```sh
sh scripts/e2e.sh
```

Leva cerca de 2 minutos. No fim, o relatório fica em `tests/e2e/results/report/index.html`. Quando um passo falha, o relatório guarda a captura de tela e o rastro (trace) do passo, e a mensagem mostra o texto que a página tinha no momento.

Para rodar só uma parte, passe os argumentos do Playwright, por exemplo `sh scripts/e2e.sh --grep convites`. Como os passos dependem uns dos outros, rodar uma parte sozinha só funciona para as que não dependem das anteriores.

**Não rode na VPS.** O script se recusa a rodar se o `PS_HOST` do `.env` não terminar em `.localhost`, porque ele cria um admin temporário e apaga contas e dados.

## O que é testado

| Passo | O que confere |
|---|---|
| Páginas do site | `/privacidade` e `/regras` em pt e en; CSP nas páginas do login e HSTS no site |
| Contas | cadastro do admin pelo convite; o mesmo convite recusado na segunda vez; nome sem conta não recebe assertion; o admin entra no jogo e abre o painel |
| Assertion forjada | o servidor de jogo recusa um login com assinatura falsa |
| Convites | gerar um convite pela página do painel; o código aparece uma vez só; convite reservado listado e revogado; nome em uso recusado; redefinição de senha para jogador inexistente e para o admin |
| Segurança | uma senha errada para o admin aparece na página Segurança, no filtro por conta |
| Troca de nome | conta nova pelo convite do painel, `/renomearconta`, sessão antiga encerrada, nome novo entra com a mesma senha e o antigo deixa de existir |
| Nome com acento | cadastro de "E2E ZéPe": no cliente, o nome aparece com o acento e o identificador é `e2ezepe` |
| Desafio (admin) | criar dois treinadores (o Campeão em dupla) e um desafio com a IA Mestre pelos formulários do painel, atribuir o líder e o Campeão e abrir o desafio |
| Pacotes | exportar o desafio E2E pela página Importar e exportar (com os dois treinadores) e importar uma cópia com outro nome e um líder novo: o Campeão, que já está no banco, é pulado e reaproveitado, e o desafio importado entra como rascunho pronto para abrir |
| Desafio (jogador) | o jogador se cadastra com o convite gerado pelo admin, começa a jornada, vence o ginásio e o Campeão (em dupla, na variante em dupla do formato) e vê os times vencedores no perfil |
| IA Mestre | a página IA Mestre do painel mostra os modelos em uso, conta a batalha individual contra o líder e a batalha em dupla contra o Campeão, cada uma nos dados do seu tipo, e mostra a força dos níveis |
| Exclusão | troca de senha em `/conta`, exclusão da conta e, em até um minuto, as jornadas apagadas pelo servidor de jogo |

Os treinadores de teste só têm Pokémon com Splash (o líder, um Magikarp; o Campeão, em dupla, Magikarp e Feebas), e o jogador usa Pikachu e Raichu com Thunderbolt. Assim as batalhas terminam sempre com a vitória do jogador, em poucos turnos.

## Como funciona

`scripts/e2e.sh`:

1. Confere que o ambiente é local e que o servidor está saudável.
2. Prepara o admin temporário: acrescenta `E2E Admin,~,` ao `usergroups.csv`, reinicia o servidor e gera um convite reservado para esse nome pelo CLI do login. A senha das contas de teste é sorteada a cada rodada.
3. Roda `tests/e2e` no container do Playwright (`mcr.microsoft.com/playwright`, versão e digest fixos), na rede do Docker do projeto. O domínio do site aponta para o serviço `web`, e o teste da assertion forjada fala direto com o servidor de jogo.
4. Limpa tudo, passe ou falhe (também com Ctrl+C):
   - no login (`tests/e2e/cleanup/login.mjs`): exclui as contas `e2e*` pela mesma rotina da exclusão pelo jogador, inclusive a fila que apaga os dados de jogo, os códigos criados durante o teste e os eventos de segurança das contas `e2e*`;
   - no Desafio de Ginásios (`tests/e2e/cleanup/gym.cjs`): apaga os desafios e treinadores `E2E*` e as jornadas deles;
   - tira a linha do admin do `usergroups.csv`, reinicia o servidor e espera a exclusão das contas terminar (o nome só fica livre de novo depois dela).

## Cuidados

- O servidor é reiniciado duas vezes: as batalhas locais em andamento são interrompidas (as do Desafio de Ginásios ficam salvas).
- A limpeza apaga **todos** os códigos de convite e de redefinição criados durante a rodada. Não gere convites no ambiente local enquanto o teste roda.
- Nomes começando com "E2E" são do teste: contas, desafios e treinadores com esse prefixo são apagados.
- O pacote `@playwright/test` (versão fixa em `tests/e2e/package.json`) só é instalado dentro do container do teste. Nada de `tests/` vai para os containers do site.

## Ao mudar o projeto

- Textos que o teste procura: ele aceita a versão em inglês e em português dos textos das páginas. Se um texto mudar, ajuste a expressão no `tests/e2e/e2e.spec.ts`.
- Funcionalidade nova visível ao jogador ou ao admin: acrescente um passo ao teste.
- Para atualizar o Playwright, troque a versão no `package.json` (e regere o `package-lock.json`) e a imagem com o digest em `scripts/e2e.sh`, sempre na mesma versão.
