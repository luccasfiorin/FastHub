<?php

use App\Http\Controllers\AisleController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PickerController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\OrderStatusController;
use App\Http\Controllers\Api\PickerOrderController;
use App\Http\Controllers\Api\ScanEventController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::apiResource('aisles', AisleController::class)->only(['index', 'show']);
    Route::apiResource('locations', LocationController::class)->only(['index', 'show']);
    Route::apiResource('products', ProductController::class)->only(['index', 'show']);

    // Rota de coleta: gestor vê qualquer pedido, coletor só os dele (checado no controller).
    Route::get('/orders/{order}/route', [OrderController::class, 'route']);

    // Status do pedido: as regras de quem pode o quê ficam no OrderStatusController.
    Route::post('/orders/{order}/start', [OrderStatusController::class, 'start']);
    Route::post('/orders/{order}/complete', [OrderStatusController::class, 'complete']);
    Route::post('/orders/{order}/cancel', [OrderStatusController::class, 'cancel']);

    // Configurações: todos leem (o mapa usa o nome do armazém e os níveis); só o gestor salva.
    Route::get('/settings', [SettingController::class, 'show']);

    Route::middleware('role:manager')->group(function () {
        Route::get('/dashboard', DashboardController::class);
        Route::get('/reports', ReportController::class);
        Route::get('/scan-events', [ScanEventController::class, 'index']);
        Route::put('/settings', [SettingController::class, 'update']);
        Route::apiResource('users', UserController::class)->except(['show']);

        Route::apiResource('aisles', AisleController::class)->except(['index', 'show']);
        Route::apiResource('locations', LocationController::class)->except(['index', 'show']);
        Route::apiResource('products', ProductController::class)->except(['index', 'show']);

        Route::get('/pickers/ranking', [PickerController::class, 'ranking']);
        Route::apiResource('pickers', PickerController::class)->except(['show']);
    });

    Route::middleware('role:picker')->group(function () {
        Route::get('/picker/tasks', function () {
            return response()->json(['message' => 'Tarefas do Coletor autorizadas com sucesso!']);
        });

        Route::post('/picker/status', [PickerController::class, 'updateOwnStatus']);
        Route::get('/picker/orders', [PickerOrderController::class, 'index']);
        Route::post('/scan-events', [ScanEventController::class, 'store']);
    });

    Route::middleware(['auth:sanctum', 'role:manager'])->group(function () {
        Route::apiResource('orders', OrderController::class)->only(['index', 'store']);
    });
});
