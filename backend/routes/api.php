<?php

use App\Http\Controllers\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::middleware('role:manager')->group(function () {
        Route::get('/manager/dashboard', function () {
            return response()->json(['message' => 'Painel do Gestor autorizado com sucesso!']);
        });
    });

    Route::middleware('role:picker')->group(function () {
        Route::get('/picker/tasks', function () {
            return response()->json(['message' => 'Tarefas do Coletor autorizadas com sucesso!']);
        });
    });
});