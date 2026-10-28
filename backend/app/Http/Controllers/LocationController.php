<?php

namespace App\Http\Controllers;

use App\Http\Requests\LocationRequest;
use App\Models\Location;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function index(Request $request)
    {
        $locations = Location::query()
            ->with('aisle')
            ->when($request->query('aisle_id'), fn ($q, $aisleId) => $q->where('aisle_id', $aisleId))
            ->orderBy('aisle_id')
            ->orderBy('shelf')
            ->orderBy('position')
            ->get();

        return response()->json($locations);
    }

    public function store(LocationRequest $request)
    {
        $location = Location::create($request->validated());

        return response()->json($location->load('aisle'), 201);
    }

    public function show(Location $location)
    {
        return response()->json($location->load('aisle'));
    }

    public function update(LocationRequest $request, Location $location)
    {
        $location->update($request->validated());

        return response()->json($location->load('aisle'));
    }

    public function destroy(Location $location)
    {
        $location->delete();

        return response()->json(['message' => 'Posição excluída com sucesso.']);
    }
}
