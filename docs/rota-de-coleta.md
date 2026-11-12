# Algoritmo da rota de coleta

**Requisito:** RF04 (calcular a ordem das posições a visitar, saindo e voltando à expedição) · RNF04 (desempenho) · RN04 (rota própria para itens grandes)
**Status:** decidido
**Data:** 10/11/2026
**Implementação:** `backend/app/Services/RouteService.php`, exposto em `GET /api/orders/{order}/route`

## O problema

Um pedido tem itens espalhados por várias posições do armazém. O coletor sai da expedição, passa por todas
as posições do pedido e volta para a expedição. Queremos a ordem de visita que faz ele andar menos.

É o problema do caixeiro-viajante: achar a melhor ordem garantida exige testar um número de combinações que
cresce exponencialmente com o número de paradas. Por isso a escolha é entre **uma heurística rápida e
"boa o bastante"** e **a rota ótima, que fica lenta a partir de 15 a 18 paradas**.

Premissas usadas no cálculo:

- Cada posição tem `coord_x` e `coord_y` em metros (tabela `locations`).
- O coletor anda pelos corredores. No mesmo corredor, a distância é o deslocamento ao longo dele. Para
  trocar de corredor, ele vai até uma travessa (a frente do armazém, na altura da expedição, ou o vão
  entre duas prateleiras, calculado a partir das posições cadastradas), atravessa e entra no outro,
  usando a travessa que der o menor percurso.
- A API devolve o traçado de cada trecho (`path_from_previous` em cada parada e `return_path`), que é
  exatamente o percurso medido. Os mapas do frontend só desenham esse traçado; nada é recalculado no
  navegador.
- As simulações abaixo foram feitas com a distância `|dx| + |dy|`, antes da regra das travessas. A
  comparação entre os algoritmos continua valendo, mas os metros absolutos hoje saem maiores.
- A expedição ainda não existe no banco: fica em `config('fasthub.dock')`, com padrão (0, 0).
- Itens do mesmo pedido na mesma posição viram uma parada só.
- Se o pedido já começou, as paradas coletadas ficam fixas no início, e só o que falta é reordenado.

## Opções avaliadas

| Opção | Como funciona | Custo de cálculo |
|---|---|---|
| **Ordem do cadastro** | Visita na ordem em que os itens foram lançados no pedido. Serve só como referência. | nenhum |
| **Corredor por corredor (S-shape)** | Entra em cada corredor que tem item, percorre de ponta a ponta alternando o sentido e passa ao próximo. É a regra prática mais comum em armazéns. | O(n log n) |
| **Vizinho mais próximo** | A partir do ponto atual, vai sempre para a parada mais próxima que ainda falta. | O(n²) |
| **Vizinho mais próximo + 2-opt** | Faz o vizinho mais próximo e depois inverte trechos da rota sempre que isso a encurta (desfaz "cruzamentos"), até não melhorar mais. | O(n²) por passada; limitado a 50 passadas |
| **Ótimo exato (Held-Karp)** | Programação dinâmica que garante a menor rota possível. | O(2ⁿ · n²) |

## Comparação

Simulação com pedidos aleatórios na planta de exemplo do projeto (5 corredores com 19 posições cada, 3 m
entre corredores, 1,2 m entre posições, expedição em 0,0). Foram 200 pedidos por tamanho até 12 paradas e
300 pedidos por tamanho acima disso. O tempo é só o do cálculo, em PHP 8.3, sem contar o banco.

### Distância média percorrida (metros)

| Paradas | Ordem do cadastro | Corredor por corredor | Vizinho mais próximo | Vizinho + 2-opt | Ótimo |
|---:|---:|---:|---:|---:|---:|
| 5 | 91,8 | 80,4 | 70,8 | **66,9** | 66,8 |
| 10 | 153,4 | 104,7 | 85,9 | **78,8** | 77,5 |
| 12 | 179,1 | 114,4 | 95,1 | **84,3** | 82,4 |
| 25 | 340,3 | 143,0 | 121,6 | **106,2** | — |
| 50 | 651,0 | 155,9 | 152,4 | **134,1** | — |

### Quanto fica acima da rota ótima (média)

| Paradas | Corredor por corredor | Vizinho mais próximo | Vizinho + 2-opt |
|---:|---:|---:|---:|
| 5 | +20% | +6% | **+0,1%** |
| 10 | +35% | +11% | **+1,7%** |
| 12 | +39% | +15% | **+2,3%** |

No pior pedido sorteado, o vizinho mais próximo sozinho chegou a ficar 44% acima do ótimo; com 2-opt, o pior
caso foi 19%. O 2-opt encontrou exatamente a rota ótima em 98% dos pedidos de 5 paradas e em 57% dos de 12.

### Tempo de cálculo por pedido

| Paradas | Vizinho mais próximo | Vizinho + 2-opt | Ótimo |
|---:|---:|---:|---:|
| 10 | 0,01 ms | 0,05 ms | 3,9 ms |
| 12 | 0,02 ms | 0,08 ms | 22,5 ms |
| 25 | 0,03 ms | 0,29 ms | inviável |
| 50 | 0,12 ms | 1,2 ms | inviável |

O ótimo multiplica o tempo por cerca de 6 a cada 2 paradas a mais, e o consumo de memória cresce no
mesmo ritmo. Pela mesma conta, ficaria em torno de 0,3 s com 15 paradas, 3 s com 18 e 16 s com 20.

## Decisão

**Vizinho mais próximo + 2-opt.**

- **Fica perto do ótimo:** em média, até 2,3% acima da melhor rota possível nos tamanhos em que dá para
  comparar. O vizinho mais próximo sozinho fica de 6% a 15% acima, e corredor por corredor, de 20% a 39%.
- **Atende o RNF04 com folga:** até 50 paradas, o cálculo leva cerca de 1 ms. A requisição inteira é
  dominada pelas 5 consultas ao banco (número fixo, não cresce com o pedido).
- **O tempo é previsível:** não explode com pedidos grandes, ao contrário do ótimo exato. O 2-opt tem limite
  de 50 passadas.
- **É determinístico:** o mesmo pedido sempre gera a mesma rota, porque as paradas são ordenadas pelo id da
  posição antes do cálculo. O coletor não vê a rota mudar sozinha entre uma atualização e outra.
- **Continua a regra que o frontend já usava:** a ordem do vizinho mais próximo, só que melhorada. A tela
  de Pedidos agora desenha a rota que vem do backend e só calcula sozinha se a API falhar.

### Descartadas

- **Ótimo exato:** ganharia no máximo cerca de 2% de distância, mas fica lento e consome muita memória a partir
  de 15 a 18 paradas. Poderia ser usado só para pedidos pequenos, mas isso traz dois algoritmos para manter por um
  ganho pequeno.
- **Corredor por corredor:** é simples e fácil para o coletor entender, mas nesta planta andou de 20% a 39%
  a mais. Ver a ressalva abaixo.
- **Vizinho mais próximo sozinho:** é rápido, mas às vezes deixa uma parada isolada para o fim e obriga a
  voltar longe (até 44% acima do ótimo). O 2-opt corrige isso por menos de 1 ms.

## Limitações e próximos passos

- **A distância é uma aproximação.** Manhattan supõe que dá para atravessar de um corredor para outro em
  qualquer altura. Num armazém real, a estante bloqueia e só se troca de corredor nas pontas (corredores
  transversais). Nessa situação, corredor por corredor costuma se sair melhor do que aparece aqui. Quando a
  planta real tiver os corredores transversais cadastrados, a função `distancia()` do `RouteService` deve
  passar a considerá-los. O resto do algoritmo não muda.
- **Os pedidos da simulação são aleatórios.** Com o histórico real de pedidos, vale repetir a comparação.
- **A expedição é fixa por configuração.** Se houver mais de uma doca, ela deve vir do pedido.
- **Itens grandes (RN04):** itens de produtos com `requires_forklift` saem da rota a pé e formam uma
  rota própria (`forklift_route` na API), calculada com o mesmo algoritmo e desenhada em laranja no mapa.
  Se a empilhadeira tiver corredores proibidos, isso entra como restrição na distância dessa rota.
