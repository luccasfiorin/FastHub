<?php

use App\Http\Controllers\AisleController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\LocationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Corredores e posições: qualquer usuário logado consulta, só o gestor altera.
    Route::apiResource('aisles', AisleController::class)->only(['index', 'show']);
    Route::apiResource('locations', LocationController::class)->only(['index', 'show']);

    Route::middleware('role:manager')->group(function () {
        Route::get('/manager/dashboard', function () {
            return response()->json(['message' => 'Painel do Gestor autorizado com sucesso!']);
        });

        Route::apiResource('aisles', AisleController::class)->except(['index', 'show']);
        Route::apiResource('locations', LocationController::class)->except(['index', 'show']);
    });

    Route::middleware('role:picker')->group(function () {
        Route::get('/picker/tasks', function () {
            return response()->json(['message' => 'Tarefas do Coletor autorizadas com sucesso!']);
        });
    });
});