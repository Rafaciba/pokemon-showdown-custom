# Liga de Desafios

**https://ligadesafios.com.br**

Servidor casual de batalhas Pokémon para jogar com amigos. Ele é construído sobre o **[Pokémon Showdown](https://pokemonshowdown.com/)** e tem modos de jogo próprios, como o **Desafio de Ginásios**.

## Código-fonte

Todo o código da Liga de Desafios é aberto. O que roda em ligadesafios.com.br é a branch `main` destes repositórios:

| Repositório | O que é | Licença |
|---|---|---|
| [Rafaciba/pokemon-showdown-custom](https://github.com/Rafaciba/pokemon-showdown-custom) | este repositório: login server, Docker, Caddy, scripts e documentação | MIT |
| [Rafaciba/pokemon-showdown](https://github.com/Rafaciba/pokemon-showdown) | fork do servidor de jogo, com os modos próprios | MIT |
| [Rafaciba/pokemon-showdown-client](https://github.com/Rafaciba/pokemon-showdown-client) | fork do cliente web | AGPL-3.0 |

O cliente é AGPL-3.0: como ele é servido pela rede com modificações, o rodapé do jogo e as páginas de conta têm o link "Código-fonte" para este repositório.

## Créditos

Este projeto só existe graças ao trabalho do **Pokémon Showdown** e da comunidade **[Smogon](https://www.smogon.com/)**:

- [smogon/pokemon-showdown](https://github.com/smogon/pokemon-showdown): servidor de jogo e simulador de batalhas (licença MIT)
- [smogon/pokemon-showdown-client](https://github.com/smogon/pokemon-showdown-client): cliente web (licença AGPL-3.0)

Os nomes, líderes, tipos e imagens das insígnias do Desafio de Ginásios vêm da [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Badge) (as imagens não ficam no repositório; ver [docs/insignias.md](docs/insignias.md)).

Pokémon Showdown foi criado por Guangcong Luo (Zarel) e é mantido por seus contribuidores. Pokémon e todos os nomes relacionados são marcas registradas de Nintendo, Game Freak e The Pokémon Company. Este é um projeto de fãs, sem fins lucrativos e sem afiliação com essas empresas.

## Estrutura

```
.
├── docker/          # imagens e configuração do ambiente (local e VPS)
├── login/           # login server próprio (simplificado, com mínimo de dados pessoais)
├── docs/            # documentação do projeto
├── scripts/         # setup e utilitários
├── server/          # fork de smogon/pokemon-showdown (repositório git próprio, ignorado aqui)
└── client/          # fork de smogon/pokemon-showdown-client (repositório git próprio, ignorado aqui)
```

`server/` e `client/` são forks independentes. Cada um tem dois remotes:

- `origin`: o fork no nosso GitHub
- `upstream`: o repositório oficial da Smogon

As branches funcionam assim:

- `master`: espelho do upstream, nunca recebe commits nossos
- `main`: nossas personalizações. Para atualizar, faça merge de `master` em `main`

## Como rodar

```sh
git clone https://github.com/Rafaciba/pokemon-showdown-custom.git
cd pokemon-showdown-custom
git clone -c core.longpaths=true https://github.com/Rafaciba/pokemon-showdown.git server
git clone -c core.longpaths=true https://github.com/Rafaciba/pokemon-showdown-client.git client
git -C server remote add upstream https://github.com/smogon/pokemon-showdown.git
git -C client remote add upstream https://github.com/smogon/pokemon-showdown-client.git
docker compose up -d
```

Depois abra https://ps.localhost. Os detalhes estão em [docs/ambiente-local.md](docs/ambiente-local.md).

Para subir numa VPS (Ubuntu 22.04 limpo), siga [docs/deploy-vps.md](docs/deploy-vps.md).

## Idiomas

O jogo funciona em português do Brasil e em inglês. O botão com o globo, no topo do cliente, troca o idioma; na primeira visita vale o idioma do navegador. A tradução e as ferramentas para traduzir textos novos estão em [docs/traducao-pt-br.md](docs/traducao-pt-br.md).

## Privacidade (LGPD)

A conta guarda apenas o **nome de usuário** e o **hash da senha**. Não coletamos e-mail, e o IP não vai para os registros (só fica em memória, para a conexão e o limite de tentativas de senha). Logs de batalha da ladder são apagados depois de 30 dias, e excluir a conta apaga todos os dados de jogo.

O aviso de privacidade completo fica em `/privacidade` (código em [login/src/privacy.ts](login/src/privacy.ts)). A revisão de segurança e LGPD, com o inventário de dados, está em [docs/revisao-seguranca-lgpd.md](docs/revisao-seguranca-lgpd.md).

O cadastro só é feito por convite.

Os times ficam no navegador de cada jogador.
