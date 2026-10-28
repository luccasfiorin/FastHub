<?php

namespace App\Http\Controllers;

use App\Http\Requests\AisleRequest;
use App\Models\Aisle;
use Illuminate\Http\Request;

class AisleController extends Controller
{
    public function index(Request $request)
    {
        $aisles = Aisle::query()
            ->withCount('locations')
            ->when($request->query('search'), function ($query, $search) {
                $query->where(fn ($q) => $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%"));
            })
            ->orderBy('code')
            ->get();

        return response()->json($aisles);
    }

    public function store(AisleRequest $request)
    {
        $aisle = Aisle::create($request->validated());

        return response()->json($aisle->loadCount('locations'), 201);
    }

    public function show(Aisle $aisle)
    {
        $aisle->load(['locations' => fn ($q) => $q->orderBy('shelf')->orderBy('position')]);

        return response()->json($aisle);
    }

    public function update(AisleRequest $request, Aisle $aisle)
    {
        $aisle->update($request->validated());

        return response()->json($aisle->loadCount('locations'));
    }

    public function destroy(Aisle $aisle)
    {
        if ($aisle->locations()->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir um corredor que ainda tem posições cadastradas.',
            ], 409);
        }

        $aisle->delete();

        return response()->json(['message' => 'Corredor excluído com sucesso.']);
    }
}
