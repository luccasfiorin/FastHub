<?php

namespace Database\Seeders;

use App\Models\Aisle;
use App\Models\Location;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PickerBreak;
use App\Models\Product;
use App\Models\ScanEvent;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Armazém de exemplo completo, para todas as telas terem o que mostrar.
 *
 * - Planta: corredores A–E, 19 posições cada (prateleira 1 = posições 01–10, prateleira 2 = 11–19),
 *   com coord_x/coord_y em metros (3 m entre corredores, 1,2 m entre posições) e coord_z pelo nível.
 * - 40 produtos guardados nas posições, 6 deles grandes (requires_forklift).
 * - 4 coletores com histórico: Ana e João (a pé, ativos), Bruna (a pé, em pausa agora) e
 *   Marcos na Empilhadeira 02. O "Coletor de Campo" do login de teste fica offline com pedidos na fila.
 * - Pedidos em todos os status: concluídos hoje e nos últimos dias (para o ranking de semana/mês),
 *   um em andamento por coletor ativo, pendentes (atribuídos e sem coletor) e cancelados.
 * - Bipagens de cada unidade coletada, com algumas divergências, e pausas no histórico.
 *
 * Tudo relativo a agora: rodar de novo outro dia gera um "hoje" coerente.
 * Os números aleatórios usam semente fixa, então o resultado é sempre o mesmo.
 *
 * Rodar num banco limpo:  php artisan migrate:fresh --seed
 */
class ArmazemSeeder extends Seeder
{
    private const CORREDORES = ['A', 'B', 'C', 'D', 'E'];
    private const POSICOES_POR_CORREDOR = 19;
    private const METROS_ENTRE_CORREDORES = 3.0;
    private const METROS_POR_POSICAO = 1.2;
    private const NIVEIS = 4;
    private const ALTURA_POR_NIVEL = 0.6;

    /** [nome, código da posição, peso kg, volume L, grande?] */
    private const PRODUTOS = [
        ['Copo térmico 500 ml', 'A-02', 0.4, 1, false],
        ['Kit talheres 24 peças', 'A-03', 1.8, 3, false],
        ['Liquidificador 3 velocidades', 'A-05', 2.9, 9, false],
        ['Mixer de mão', 'A-07', 1.1, 3, false],
        ['Ventilador de mesa 30 cm', 'A-09', 3.2, 22, false],
        ['Ferro de passar a vapor', 'A-12', 1.4, 4, false],
        ['Cafeteira elétrica', 'A-14', 2.1, 8, false],
        ['Torradeira inox', 'A-16', 1.9, 6, false],
        ['Pote hermético 1 L', 'B-01', 0.2, 1, false],
        ['Chaleira elétrica', 'B-02', 1.2, 4, false],
        ['Pote de vidro com tampa', 'B-03', 0.6, 1, false],
        ['Sanduicheira', 'B-05', 1.7, 5, false],
        ['Forma de bolo', 'B-08', 0.5, 3, false],
        ['Jogo de panelas 5 peças', 'B-09', 6.5, 30, false],
        ['Tábua de corte', 'B-11', 0.9, 2, false],
        ['Garrafa térmica 1 L', 'B-14', 0.8, 2, false],
        ['Jarra de vidro', 'B-17', 1.0, 2, false],
        ['Batedeira planetária', 'C-03', 4.8, 18, false],
        ['Cafeteira italiana', 'C-04', 0.7, 2, false],
        ['Escorredor de louça', 'C-07', 1.3, 12, false],
        ['Assadeira retangular', 'C-10', 0.9, 4, false],
        ['Assadeira redonda', 'C-12', 0.8, 4, false],
        ['Panela de arroz elétrica', 'C-15', 2.4, 10, false],
        ['Kit de facas', 'C-18', 1.2, 2, false],
        ['Secador de cabelo', 'D-03', 0.7, 3, false],
        ['Jarra de suco 2 L', 'D-05', 0.6, 3, false],
        ['Chapinha de cabelo', 'D-08', 0.5, 2, false],
        ['Panela elétrica multiuso', 'D-13', 4.2, 16, false],
        ['Porta-temperos giratório', 'D-16', 1.1, 4, false],
        ['Panela de pressão 4,5 L', 'E-02', 3.0, 9, false],
        ['Fruteira de bancada', 'E-06', 1.6, 10, false],
        ['Jogo de copos 6 peças', 'E-09', 2.2, 5, false],
        ['Escorredor de massa', 'E-13', 0.4, 4, false],
        ['Air fryer 4 L', 'E-15', 4.6, 24, false],
        // Itens grandes: sempre na prateleira de baixo, saem na rota da empilhadeira (RN04).
        ['Geladeira compacta 120 L', 'C-11', 28.0, 160, true],
        ['Micro-ondas 30 L', 'D-11', 14.5, 70, true],
        ['Forno elétrico 45 L', 'E-17', 16.0, 85, true],
        ['Lava-louças 8 serviços', 'D-19', 32.0, 150, true],
        ['Freezer horizontal 150 L', 'E-19', 41.0, 290, true],
        ['Fogão 4 bocas', 'C-19', 30.0, 210, true],
    ];

    /** @var array<string, Location> */
    private array $posicoes = [];

    /** @var list<Product> */
    private array $pequenos = [];

    /** @var list<Product> */
    private array $grandes = [];

    private int $proximoNumero = 4700;

    private CarbonImmutable $agora;

    public function run(): void
    {
        if (Aisle::where('code', 'A')->exists()) {
            $this->command?->warn('O armazém de exemplo já existe. Para recriar: php artisan migrate:fresh --seed');

            return;
        }

        mt_srand(2026);
        $this->agora = CarbonImmutable::now()->startOfMinute();

        // Uma transação só: no SQLite isso deixa o seeder dezenas de vezes mais rápido.
        DB::transaction(function () {
            $this->criarPlanta();
            $this->criarProdutos();
            $coletores = $this->criarColetores();

            $this->historico($coletores);
            $this->hoje($coletores);
            $this->fila($coletores);
        });

        $this->command?->info(sprintf(
            'Armazém criado: %d posições, %d produtos, %d pedidos, %d bipagens.',
            Location::count(), Product::count(), Order::count(), ScanEvent::count(),
        ));
    }

    // -----------------------------------------------------------------------------------------
    // Planta, produtos e pessoas
    // -----------------------------------------------------------------------------------------

    private function criarPlanta(): void
    {
        foreach (self::CORREDORES as $i => $letra) {
            $corredor = Aisle::create([
                'code' => $letra,
                'name' => "Corredor {$letra}",
                'description' => $i < 2 ? 'Utilidades e eletroportáteis leves' : 'Eletroportáteis e linha branca',
            ]);

            for ($p = 1; $p <= self::POSICOES_POR_CORREDOR; $p++) {
                $nivel = (($p - 1) % self::NIVEIS) + 1;
                $codigo = sprintf('%s-%02d', $letra, $p);

                $this->posicoes[$codigo] = Location::create([
                    'aisle_id' => $corredor->id,
                    'shelf' => $p <= 10 ? '1' : '2',
                    'position' => sprintf('%02d', $p),
                    'coord_x' => ($i + 1) * self::METROS_ENTRE_CORREDORES,
                    'coord_y' => round((self::POSICOES_POR_CORREDOR + 0.5 - $p) * self::METROS_POR_POSICAO, 2),
                    'coord_z' => round($nivel * self::ALTURA_POR_NIVEL, 2),
                ]);
            }
        }
    }

    private function criarProdutos(): void
    {
        foreach (self::PRODUTOS as $n => [$nome, $codigo, $peso, $volume, $grande]) {
            $produto = Product::create([
                'sku' => sprintf('%s-%04d', $grande ? 'LB' : 'UT', 101 + $n),
                'name' => $nome,
                'weight' => $peso,
                'volume' => $volume,
                'barcode_primary' => sprintf('7891000%06d', 1000 + $n * 37),
                'batch_code' => 'L'.(12 + mt_rand(0, 14)),
                'requires_forklift' => $grande,
                'location_id' => $this->posicoes[$codigo]->id,
            ]);

            if ($grande) {
                $this->grandes[] = $produto;
            } else {
                $this->pequenos[] = $produto;
            }
        }
    }

    /** @return array<string, User> */
    private function criarColetores(): array
    {
        $dados = [
            'ana' => ['Ana Paula', 'ana.paula@fasthub.com', 'foot', 'active', null],
            'joao' => ['João Ricardo', 'joao.ricardo@fasthub.com', 'foot', 'active', null],
            'bruna' => ['Bruna Souza', 'bruna.souza@fasthub.com', 'foot', 'paused', null],
            'marcos' => ['Marcos Teixeira', 'marcos.teixeira@fasthub.com', 'forklift', 'active', 'Empilhadeira 02'],
        ];

        $coletores = [];
        foreach ($dados as $chave => [$nome, $email, $tipo, $status, $operador]) {
            $coletores[$chave] = User::updateOrCreate(['email' => $email], [
                'name' => $nome,
                'password' => Hash::make('password123'),
                'role' => 'picker',
                'picker_type' => $tipo,
                'operator_name' => $operador,
                'work_status' => $status,
                'job_title' => $tipo === 'forklift' ? 'Operador de empilhadeira' : 'Separador',
            ]);
        }

        // Conta de teste do login de coletor (UserSeeder/DatabaseSeeder): offline, sem histórico.
        $coletores['campo'] = User::firstWhere('email', 'coletor@fasthub.com');

        return $coletores;
    }

    // -----------------------------------------------------------------------------------------
    // Pedidos
    // -----------------------------------------------------------------------------------------

    /** Últimos 12 dias (sem domingo): 2 a 4 pedidos concluídos por coletor, para semana e mês. */
    private function historico(array $c): void
    {
        for ($dias = 12; $dias >= 1; $dias--) {
            $dia = $this->agora->subDays($dias);
            if ($dia->isSunday()) {
                continue;
            }

            foreach (['ana', 'joao', 'bruna', 'marcos'] as $chave) {
                $relogio = $dia->setTime(8, mt_rand(0, 40), mt_rand(0, 59));
                $quantos = $chave === 'marcos' ? mt_rand(2, 3) : mt_rand(3, 4);

                for ($n = 0; $n < $quantos; $n++) {
                    // de vez em quando alguém bipa o produto errado (cerca de 1 em 12 pedidos)
                    $relogio = $this->pedidoConcluido($c[$chave], $relogio, divergencia: mt_rand(1, 12) === 1);

                    // pausa do almoço / café entre um pedido e outro
                    if ($n === 1) {
                        $fim = $relogio->addMinutes(mt_rand(15, 30));
                        PickerBreak::create(['picker_id' => $c[$chave]->id, 'started_at' => $relogio, 'ended_at' => $fim]);
                        $relogio = $fim;
                    }
                    $relogio = $relogio->addMinutes(mt_rand(3, 8));
                }
            }

            // um pedido cancelado de vez em quando (pedido do ERP que voltou)
            if ($dias % 4 === 0) {
                $this->novoPedido('cancelled', null, $this->itensAPe(mt_rand(3, 6)), $dia->setTime(9, 30));
            }
        }
    }

    /**
     * Turno de hoje: começou há ~3h. Cada coletor conclui pedidos até perto de agora e fica
     * com um em andamento (Bruna está em pausa no meio do dela).
     */
    private function hoje(array $c): void
    {
        $inicioTurno = $this->agora->subHours(3)->subMinutes(10);

        foreach (['ana' => 0, 'joao' => 6, 'bruna' => 3, 'marcos' => 12] as $chave => $atraso) {
            $coletor = $c[$chave];
            $relogio = $inicioTurno->addMinutes($atraso);
            $limite = $this->agora->subMinutes($chave === 'bruna' ? 40 : 20);
            $n = 0;

            while ($relogio->lt($limite)) {
                $relogio = $this->pedidoConcluido($coletor, $relogio, divergencia: $chave === 'joao' && $n === 1);
                $relogio = $relogio->addMinutes(mt_rand(2, 6));

                // pausa do café, se ainda couber antes do fim do turno simulado
                if ($n === 1 && $chave !== 'marcos' && $relogio->addMinutes(15)->lt($limite)) {
                    $fim = $relogio->addMinutes(mt_rand(10, 15));
                    PickerBreak::create(['picker_id' => $coletor->id, 'started_at' => $relogio, 'ended_at' => $fim]);
                    $relogio = $fim;
                }
                $n++;
            }

            // o pedido atual começa de modo que a última bipagem seja de poucos minutos atrás
            // (a da Bruna fica antes da pausa, que começou há 12 minutos)
            $comeco = $this->agora->subMinutes(['ana' => 7, 'joao' => 6, 'bruna' => 17, 'marcos' => 6][$chave]);
            $this->pedidoEmAndamento($coletor, $relogio->max($comeco), $chave);
            // em pausa o app continua mandando sinal, então ninguém aparece como offline
            $coletor->update(['last_seen_at' => $this->agora->subMinute()]);
        }

        // Bruna entrou em pausa há 12 minutos e ainda não voltou.
        PickerBreak::create(['picker_id' => $c['bruna']->id, 'started_at' => $this->agora->subMinutes(12), 'ended_at' => null]);

        // Cancelado hoje: o cliente desistiu antes de começar.
        $this->novoPedido('cancelled', null, $this->itensAPe(4), $this->agora->subHours(2));
    }

    /** Pedidos ainda na fila: atribuídos e sem coletor, um deles misturando item grande (RN04). */
    private function fila(array $c): void
    {
        $chegada = $this->agora->subMinutes(30);

        $this->novoPedido('pending', $c['ana'], $this->itensAPe(7), $chegada);
        $this->novoPedido('pending', $c['marcos'], $this->itensGrandes(2), $chegada);

        if ($c['campo']) {
            $this->novoPedido('pending', $c['campo'], $this->itensAPe(5), $chegada);
            $this->novoPedido('pending', $c['campo'], $this->itensAPe(3), $chegada->addMinutes(5));
        }

        $this->novoPedido('pending', null, $this->itensAPe(9), $chegada->addMinutes(8));
        $this->novoPedido('pending', null, [...$this->itensAPe(5), ...$this->itensGrandes(1)], $chegada->addMinutes(12));
        $this->novoPedido('pending', null, $this->itensAPe(12), $chegada->addMinutes(15));
        $this->novoPedido('pending', null, $this->itensAPe(4), $chegada->addMinutes(20));
    }

    /** Cria um pedido, coleta tudo a partir de $relogio e conclui. Devolve o horário em que terminou. */
    private function pedidoConcluido(User $coletor, CarbonImmutable $relogio, bool $divergencia = false): CarbonImmutable
    {
        $itens = $coletor->picker_type === 'forklift' ? $this->itensGrandes(mt_rand(2, 3)) : $this->itensAPe(mt_rand(5, 10));
        $pedido = $this->novoPedido('in_progress', $coletor, $itens, $relogio->subMinutes(mt_rand(10, 40)), $relogio);

        $fim = $this->coletar($pedido, $coletor, $relogio, $pedido->items->count(), $divergencia);
        $pedido->update(['status' => 'completed', 'completed_at' => $fim->addSeconds(40)]);

        return $fim->addSeconds(40);
    }

    /** Pedido em andamento: parte dos itens já coletada, a última bipagem há poucos minutos. */
    private function pedidoEmAndamento(User $coletor, CarbonImmutable $relogio, string $chave): void
    {
        [$itens, $coletados] = match ($chave) {
            'ana' => [$this->itensAPe(8), 5],
            'joao' => [$this->itensAPe(10), 3],
            'bruna' => [$this->itensAPe(6), 2],
            'marcos' => [$this->itensGrandes(3), 1],
        };

        $pedido = $this->novoPedido('in_progress', $coletor, $itens, $relogio->subMinutes(15), $relogio);
        $this->coletar($pedido, $coletor, $relogio, $coletados, divergencia: $chave === 'joao');
    }

    /**
     * Cria o pedido com os itens (cada um na posição do produto).
     *
     * @param  list<array{0: Product, 1: int}>  $itens
     */
    private function novoPedido(string $status, ?User $coletor, array $itens, CarbonImmutable $criadoEm, ?CarbonImmutable $iniciadoEm = null): Order
    {
        $pedido = new Order([
            'order_number' => (string) $this->proximoNumero++,
            'status' => $status,
            'picker_id' => $coletor?->id,
            'requires_forklift' => collect($itens)->contains(fn ($i) => $i[0]->requires_forklift),
            'started_at' => $iniciadoEm,
        ]);
        $pedido->created_at = $criadoEm;
        $pedido->updated_at = $criadoEm;
        $pedido->save();

        foreach ($itens as [$produto, $quantidade]) {
            $pedido->items()->create([
                'product_id' => $produto->id,
                'location_id' => $produto->location_id,
                'quantity' => $quantidade,
                'unit_price' => $produto->requires_forklift ? mt_rand(1200, 3500) : mt_rand(25, 480) + 0.9,
                'picked_quantity' => 0,
                'is_picked' => false,
            ]);
        }

        return $pedido->load('items.location');
    }

    /**
     * Bipa os $quantos primeiros itens do pedido, na ordem de passagem pelos corredores,
     * e devolve o horário da última bipagem. Com $divergencia, o coletor bipa um produto
     * errado no segundo item antes de bipar o certo.
     */
    private function coletar(Order $pedido, User $coletor, CarbonImmutable $relogio, int $quantos, bool $divergencia = false): CarbonImmutable
    {
        $empilhadeira = $coletor->picker_type === 'forklift';
        $bipagens = [];

        $itens = $pedido->items
            ->sortBy(fn (OrderItem $item) => sprintf('%05.1f-%05.1f', $item->location->coord_x, 99 - $item->location->coord_y))
            ->values();

        foreach ($itens->take($quantos) as $n => $item) {
            // deslocamento até a posição (empilhadeira é mais lenta e manobra)
            $relogio = $relogio->addSeconds($empilhadeira ? mt_rand(90, 180) : mt_rand(20, 55));

            if ($divergencia && $n === 1) {
                $bipagens[] = $this->bipagem($coletor, $item, 'mismatch', $relogio);
                $relogio = $relogio->addSeconds(mt_rand(30, 60));
            }

            for ($u = 0; $u < $item->quantity; $u++) {
                $relogio = $relogio->addSeconds($empilhadeira ? mt_rand(40, 70) : mt_rand(6, 14));
                $bipagens[] = $this->bipagem($coletor, $item, 'ok', $relogio);
            }

            $item->update(['picked_quantity' => $item->quantity, 'is_picked' => true, 'picked_at' => $relogio]);
        }

        ScanEvent::insert($bipagens);

        return $relogio;
    }

    private function bipagem(User $coletor, OrderItem $item, string $tipo, CarbonImmutable $quando): array
    {
        return [
            'picker_id' => $coletor->id,
            'order_id' => $item->order_id,
            'order_item_id' => $item->id,
            'type' => $tipo,
            'scanned_at' => $quando,
            'created_at' => $quando,
            'updated_at' => $quando,
        ];
    }

    /** $linhas produtos pequenos diferentes, de 1 a 4 unidades cada. */
    private function itensAPe(int $linhas): array
    {
        return array_map(fn (Product $p) => [$p, mt_rand(1, 4)], $this->sortear($this->pequenos, $linhas));
    }

    /** $linhas produtos grandes diferentes, 1 ou 2 unidades cada. */
    private function itensGrandes(int $linhas): array
    {
        return array_map(fn (Product $p) => [$p, mt_rand(1, 2)], $this->sortear($this->grandes, $linhas));
    }

    /** Sorteia $n itens diferentes da lista (com a semente fixa do mt_rand). */
    private function sortear(array $lista, int $n): array
    {
        for ($i = count($lista) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            [$lista[$i], $lista[$j]] = [$lista[$j], $lista[$i]];
        }

        return array_slice($lista, 0, min($n, count($lista)));
    }
}
