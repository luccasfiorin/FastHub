# FastHub

Sistema web de separação de pedidos para armazéns, feito para o desafio da
Telecontrol. O FastHub mapeia o armazém, calcula a rota de coleta de cada
pedido e acompanha o coletor em tempo real, da primeira bipagem até a
conclusão.

São duas interfaces sobre a mesma API:

- **Painel do gestor:** acompanha a operação, cria e controla pedidos, vê o
  mapa ao vivo, mede a equipe e configura o armazém.
- **Tela do coletor:** pensada para celular, mostra a fila de pedidos, a rota
  parada a parada e registra cada bipagem.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Algoritmo de rota](#algoritmo-de-rota)
- [Como as métricas são calculadas](#como-as-métricas-são-calculadas)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar](#como-rodar)
- [Acesso](#acesso)
- [Roteiro de demonstração](#roteiro-de-demonstração)
- [API](#api)
- [Configuração](#configuração)
- [Testes](#testes)
- [Limitações e próximos passos](#limitações-e-próximos-passos)

## Funcionalidades

### Painel do gestor

| Tela          | O que faz |
| ------------- | --------- |
| Início        | Indicadores do dia comparados com ontem no mesmo horário (pedidos separados, em andamento, tempo por item, acurácia), pedidos de hoje com a rota no mapa, eficiência de rota, pedidos de empilhadeira, última divergência, pedidos por hora e situação dos coletores. |
| Pedidos       | Lista com filtros (aguardando, em andamento, concluídos, com divergência, empilhadeira), rota de cada pedido a pé e de empilhadeira, novo pedido, atribuição ou troca do coletor e botões de iniciar, concluir e cancelar. Só é possível iniciar um pedido que já tem coletor. |
| Mapa          | Planta do armazém com as posições, os produtos guardados, as divergências abertas e a rota de cada coletor em andamento, com a posição atual dele. |
| Coletores     | Cards com status e métricas do dia de cada coletor, ranking por dia, semana ou mês e cadastro de coletores. |
| Relatórios    | Indicadores de um período comparados com o período anterior, pedidos por dia ou por hora, distância por pedido, itens por hora por coletor contra a meta e ocorrências de bipagem. Exporta a planilha (CSV com a série por dia, ou por hora no período "Hoje") e o PDF, pela impressão do navegador. |
| Configurações | Dados do armazém, regras de rota e usuários de todos os perfis. |

Início, Pedidos e Mapa se atualizam sozinhos a cada 5 segundos, só enquanto a
aba está visível.

### Tela do coletor

- Fila de pedidos atribuídos a ele, com o em andamento primeiro.
- Rota no mapa, com a próxima parada em destaque (posição, produto e quantas
  unidades faltam).
- Bipagem por leitor de código de barras ou digitando. O código de cada item
  aparece na tela, para testar sem leitor.
- Código errado vira divergência na hora, também no painel do gestor.
- Concluir o pedido quando tudo foi coletado, pausar e retomar.

## Algoritmo de rota

A rota é calculada só no backend, em
[`RouteService`](backend/app/Services/RouteService.php), e exposta em
`GET /api/orders/{id}/route`. O frontend não recalcula nada: desenha o
traçado que vem da API, e a distância informada é o comprimento exato desse
traçado.

### Problema

Um pedido tem itens espalhados pelo armazém. O coletor sai da doca, passa por
todas as posições e volta. Achar a ordem de menor percurso é o problema do
caixeiro-viajante: a solução exata cresce exponencialmente com o número de
paradas, então o FastHub usa uma heurística rápida e muito próxima do ótimo.

### Como a distância é medida

Cada posição tem `coord_x` e `coord_y` em metros. O coletor anda pelos
corredores e não atravessa as estantes:

- **No mesmo corredor** (mesmo `x`), a distância é o deslocamento ao longo dele.
- **Para trocar de corredor**, ele vai até uma **travessa**, atravessa e entra
  no outro corredor. As travessas são a frente do armazém (na altura da doca) e
  o vão entre duas prateleiras, calculado a partir das posições cadastradas.
  Vale a travessa que der o menor percurso.

```
mesmo corredor:      distância(a, b) = |ya − yb|
corredores distintos: distância(a, b) = |xa − xb| + menor valor de (|ya − t| + |yb − t|) entre as travessas t
```

### Passo a passo

1. **Agrupa** os itens do pedido por posição: itens na mesma posição viram uma
   parada só.
2. **Separa os itens grandes (RN04):** produtos com `requires_forklift` saem da
   rota a pé e formam uma rota própria da empilhadeira, calculada com as mesmas
   regras.
3. **Fixa o que já foi coletado:** se o pedido já começou, as paradas
   coletadas ficam no início, na ordem em que foram bipadas. Só o que falta é
   reordenado, a partir de onde o coletor está.
4. **Vizinho mais próximo:** a partir do ponto atual, vai sempre para a parada
   mais próxima que ainda falta.
5. **2-opt:** percorre a rota invertendo trechos sempre que isso encurta o
   percurso (desfaz "cruzamentos"), até não melhorar mais, com limite de 50
   passadas.
6. **Volta para a doca** e monta a resposta: ordem das paradas, distância de
   cada trecho, distância total e restante, próxima parada e o traçado de cada
   trecho (`path_from_previous`), além da volta (`return_path`).

### Por que vizinho mais próximo + 2-opt

Comparação feita na planta de exemplo, com pedidos aleatórios (detalhes em
[docs/rota-de-coleta.md](docs/rota-de-coleta.md)):

| Algoritmo                        | Distância acima da rota ótima (5 a 12 paradas) | Tempo com 50 paradas |
| -------------------------------- | ---------------------------------------------- | -------------------- |
| Corredor por corredor            | +20% a +39%                                    | desprezível          |
| Vizinho mais próximo             | +6% a +15%                                     | 0,12 ms              |
| **Vizinho mais próximo + 2-opt** | **+0,1% a +2,3%**                              | **1,2 ms**           |
| Ótimo exato (Held-Karp)          | 0%                                             | inviável acima de ~18 paradas |

- Fica a até 2,3% da melhor rota possível, em média.
- Atende o requisito de desempenho (RNF04) com folga: cerca de 1 ms com 50
  paradas, e a requisição faz um número fixo de consultas ao banco, qualquer
  que seja o tamanho do pedido.
- É determinístico: o mesmo pedido sempre gera a mesma rota, então o coletor
  não vê a ordem mudar sozinha entre uma atualização e outra.

A simulação foi feita antes da regra das travessas, com a distância
`|dx| + |dy|`. A comparação entre os algoritmos continua valendo, mas os
metros absolutos hoje são maiores.

### Eficiência de rota

O Início e os Relatórios comparam a rota do FastHub com o percurso de visitar
as posições na ordem em que os itens aparecem no pedido, como numa lista de
papel sem ordenação. As duas distâncias usam a mesma regra dos corredores.

## Como as métricas são calculadas

Calculadas em [`PickerMetrics`](backend/app/Services/PickerMetrics.php) e
[`OperationReport`](backend/app/Services/OperationReport.php), sempre a partir
das bipagens, pausas e pedidos gravados no banco.

| Métrica              | Regra |
| -------------------- | ----- |
| Pedidos separados    | Pedidos concluídos no período. |
| Tempo ativo          | Da primeira à última bipagem do dia, menos as pausas. Em períodos de vários dias, soma dia a dia. |
| Itens por hora       | Unidades coletadas divididas pelo tempo ativo. Só é calculado com pelo menos 10 minutos de tempo ativo; antes disso aparece "—", para poucas bipagens seguidas não gerarem números absurdos. |
| Tempo por item       | Tempo ativo dividido pelas unidades coletadas, com o mesmo mínimo de 10 minutos. |
| Acurácia             | Bipagens corretas divididas pelo total de bipagens. |
| Distância percorrida | Soma da distância pelos corredores entre as posições coletadas em sequência no mesmo pedido. |
| Status do coletor    | Ativo, em pausa ou offline. Sem sinal por mais de 10 minutos, vira offline. |

As regras de tempo ativo e acurácia ainda precisam ser confirmadas com a
Telecontrol.

## Tecnologias

| Camada   | Tecnologia |
| -------- | ---------- |
| Backend  | PHP 8.3, Laravel 13, Laravel Sanctum (autenticação por token) |
| Banco    | SQLite (arquivo local, sem servidor) |
| Frontend | React 19, Vite 8, CSS puro, gráficos e mapas em SVG |
| Node     | Versão 20, gerenciada pelo nvm (`.nvmrc`) |
| Design   | Figma |

## Estrutura do projeto

```
backend/
  app/Services/          RouteService (rota), PickerMetrics e OperationReport (métricas)
  app/Http/Controllers/  API: pedidos, status, bipagem, coletores, relatórios, configurações, usuários
  database/seeders/      ArmazemSeeder: armazém de exemplo completo
  tests/Feature/         testes da API
frontend/src/
  pages/                 telas do gestor (Dashboard, Pedidos, Mapa, Coletores, Relatorios,
                         Configuracoes) e do coletor (Coletor)
  hooks/                 busca e atualização dos dados de cada tela
  services/api.js        todas as chamadas à API
  utils/                 conversão da rota da API, regras da coleta, atualização periódica
docs/
  rota-de-coleta.md      estudo e decisão do algoritmo de rota
```

## Como rodar

Pré-requisitos: PHP 8.3+ com a extensão `pdo_sqlite`, Composer e nvm. Não
precisa de servidor de banco: o SQLite é um arquivo dentro do projeto, fora do
git.

Backend (terminal 1), em http://localhost:8000:

```bash
cd backend
composer install
cp .env.example .env              # já vem com DB_CONNECTION=sqlite
touch database/database.sqlite
php artisan key:generate
php artisan migrate --seed        # tabelas + usuários + armazém de exemplo
php artisan serve
```

Frontend (terminal 2), em http://localhost:5173:

```bash
nvm use
cd frontend
npm install
npm run dev
```

O Vite repassa as chamadas de `/api` para o Laravel, então os dois precisam
estar rodando.

Depois de cada `git pull`, rode `php artisan migrate` no backend. Para zerar o
banco e recriar o exemplo: `php artisan migrate:fresh --seed`.

## Acesso

Usuários criados pelo seed. A senha de todos é `password123`.

| Perfil                 | E-mail                      | Situação no exemplo              |
| ---------------------- | --------------------------- | -------------------------------- |
| Gestor                 | gestor@fasthub.com          | painel completo                  |
| Coletor                | coletor@fasthub.com         | 2 pedidos na fila, sem histórico |
| Coletor                | ana.paula@fasthub.com       | ativo, pedido em andamento       |
| Coletor                | joao.ricardo@fasthub.com    | ativo, pedido com divergência    |
| Coletor                | bruna.souza@fasthub.com     | em pausa                         |
| Coletor (empilhadeira) | marcos.teixeira@fasthub.com | ativo, Empilhadeira 02           |

O armazém de exemplo tem 5 corredores (A a E) com 19 posições cada, 40
produtos (6 de empilhadeira) e cerca de 190 pedidos em todos os status, com
bipagens, divergências e pausas dos últimos 12 dias. Os horários são relativos
ao momento em que o seed roda, então o "hoje" das telas sempre tem movimento.

## Roteiro de demonstração

1. Rode `php artisan migrate:fresh --seed` pouco antes de apresentar. Depois de
   10 minutos sem sinal, os coletores do exemplo aparecem como offline.
2. Abra duas janelas: o gestor no Mapa do armazém e o coletor
   (`coletor@fasthub.com`) no celular ou numa janela estreita.
3. No gestor, em Pedidos, use "Atribuir coletor" num pedido "Sem coletor" e
   escolha o `coletor@fasthub.com`: o pedido aparece na fila dele.
4. No coletor, abra Pedidos, inicie o primeiro da fila e vá para Coleta.
5. Bipe um código qualquer para mostrar a divergência: ela aparece no coletor
   e, em até 5 segundos, no Mapa e no Início do gestor.
6. Bipe os itens tocando no código de barras de cada um. A cada parada, o
   marcador do coletor e a linha da rota avançam no Mapa do gestor.
7. Conclua o pedido e mostre o Início e os Relatórios atualizados.

O itens por hora do coletor da demonstração aparece como "—" nos primeiros
10 minutos de coleta: é a regra do tempo mínimo, não um erro.

## API

Todas as rotas ficam em `/api`. Exceto o login, pedem o token do Sanctum no
cabeçalho `Authorization: Bearer <token>`.

| Rota | Quem | Para quê |
| ---- | ---- | -------- |
| `POST /login`, `POST /logout`, `GET /me` | todos | autenticação |
| `GET /aisles`, `/locations`, `/products` | todos | planta e produtos (criar, editar e excluir só o gestor) |
| `GET /settings` | todos | configurações do armazém e tamanho da planta |
| `PUT /settings` | gestor | salvar configurações |
| `GET /orders`, `POST /orders` | gestor | listar e criar pedidos |
| `PATCH /orders/{id}` | gestor | atribuir, trocar ou remover (`null`) o coletor de um pedido pendente |
| `GET /orders/{id}/route` | gestor e coletor dono | rota de coleta com o traçado de cada trecho |
| `POST /orders/{id}/start`, `/complete` | gestor e coletor dono | iniciar e concluir (só com tudo coletado) |
| `POST /orders/{id}/cancel` | gestor | cancelar |
| `GET /dashboard` | gestor | indicadores do dia |
| `GET /reports?from=&to=` | gestor | relatório do período (até 90 dias) |
| `GET /scan-events` | gestor | divergências de bipagem (`?open=1`: só de pedidos abertos) |
| `GET /pickers`, `/pickers/ranking`, `POST/PUT/DELETE /pickers` | gestor | coletores, métricas e ranking |
| `GET/POST/PUT/DELETE /users` | gestor | usuários de todos os perfis |
| `GET /picker/orders` | coletor | pedidos do coletor logado, com progresso |
| `POST /scan-events` | coletor | registrar uma bipagem |
| `POST /picker/status` | coletor | ficar ativo, em pausa ou offline |

Transição de status inválida responde 409, inclusive trocar o coletor de um
pedido já iniciado. O gestor iniciar um pedido sem coletor responde 422.
Bipagem com código errado grava a divergência e responde 422. A coleção do Postman para corredores e posições
fica em `backend/postman/`.

## Configuração

Variáveis do `backend/.env`, com o valor padrão entre parênteses:

| Variável | Para quê |
| -------- | -------- |
| `FASTHUB_DOCK_X`, `FASTHUB_DOCK_Y` (0, 0) | posição da doca na planta, em metros |
| `FASTHUB_OFFLINE_AFTER_MINUTES` (10) | minutos sem sinal até o coletor aparecer como offline |
| `FASTHUB_ITEMS_PER_HOUR_TARGET` (70) | meta de itens por hora dos Relatórios (a confirmar) |
| `FASTHUB_IDLE_TARGET` (10) | meta de tempo ocioso em %, na tela Coletores (a confirmar) |

## Testes

```bash
cd backend
php artisan test
```

Os testes cobrem a rota de coleta (ordem, travessas, empilhadeira, traçado),
o ciclo do pedido, a bipagem, as métricas, os relatórios, as configurações e
os usuários. Rodam com SQLite em memória e não tocam no banco local.
