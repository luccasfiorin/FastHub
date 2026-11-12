<?php

return [
    // Meta de tempo ocioso exibida no indicador (em %). Valor a confirmar com a Telecontrol.
    'idle_target_percent' => (float) env('FASTHUB_IDLE_TARGET', 10),

    // Sem sinal do coletor por esse tempo, o status passa a Offline.
    'offline_after_minutes' => (int) env('FASTHUB_OFFLINE_AFTER_MINUTES', 10),

    // Meta de itens coletados por hora, por coletor (linha de meta nos relatórios). Valor a confirmar.
    'items_per_hour_target' => (int) env('FASTHUB_ITEMS_PER_HOUR_TARGET', 70),

    // Valores padrão da tela de Configurações, usados enquanto o gestor não salvar outros (tabela settings).
    'settings' => [
        'warehouse_name' => 'Galpão 1',
        'levels_per_rack' => 4,
        'level_height_m' => 0.6,
        'dock_position' => 'left',
        'forklift_height_m' => 1.5,
        'forklift_weight_kg' => 25,
        'max_items_per_route' => 40,
        'group_orders' => true,
        'orders_per_group' => 3,
    ],

    // Ponto da expedição (início e fim da rota de coleta), em metros na planta.
    'dock' => [
        'x' => (float) env('FASTHUB_DOCK_X', 0),
        'y' => (float) env('FASTHUB_DOCK_Y', 0),
    ],
];
