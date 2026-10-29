<?php

use App\Http\Controllers\AisleController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PickerController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\OrderController;

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

    Route::middleware('role:manager')->group(function () {
        Route::get('/manager/dashboard', function () {
            return response()->json(['message' => 'Painel do Gestor autorizado com sucesso!']);
        });

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
    });

    Route::middleware(['auth:sanctum', 'role:manager'])->group(function () {
        Route::apiResource('orders', OrderController::class)->only(['store']);
    });
});