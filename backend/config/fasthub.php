<?php

return [
    // Meta de tempo ocioso exibida no indicador (em %). Valor a confirmar com a Telecontrol.
    'idle_target_percent' => (float) env('FASTHUB_IDLE_TARGET', 10),

    // Sem sinal do coletor por esse tempo, o status passa a Offline.
    'offline_after_minutes' => (int) env('FASTHUB_OFFLINE_AFTER_MINUTES', 10),

    // Ponto da expedição (início e fim da rota de coleta), em metros na planta.
    'dock' => [
        'x' => (float) env('FASTHUB_DOCK_X', 0),
        'y' => (float) env('FASTHUB_DOCK_Y', 0),
    ],
];
