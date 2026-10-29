<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with('location');

        if ($request->has('location_id')) {
            $query->where('location_id', $request->location_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sku' => 'required|string|unique:products,sku',
            'name' => 'required|string|max:255',
            'weight' => 'sometimes|numeric|min:0',
            'volume' => 'sometimes|numeric|min:0',
            'barcode_primary' => 'required|string|unique:products,barcode_primary',
            'batch_code' => 'nullable|string',
            'requires_forklift' => 'sometimes|boolean',
            'location_id' => 'nullable|exists:locations,id',
        ]);

        $product = Product::create($validated);

        return response()->json($product->load('location'), 201);
    }

    public function show(Product $product)
    {
        return response()->json($product->load('location'));
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'sku' => 'sometimes|string|unique:products,sku,' . $product->id,
            'name' => 'sometimes|string|max:255',
            'weight' => 'sometimes|numeric|min:0',
            'volume' => 'sometimes|numeric|min:0',
            'barcode_primary' => 'sometimes|string|unique:products,barcode_primary,' . $product->id,
            'batch_code' => 'nullable|string',
            'requires_forklift' => 'sometimes|boolean',
            'location_id' => 'nullable|exists:locations,id',
        ]);

        $product->update($validated);

        return response()->json($product->load('location'));
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json(['message' => 'Produto eliminado com sucesso.']);
    }
}