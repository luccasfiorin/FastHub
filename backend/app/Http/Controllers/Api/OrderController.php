<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'requires_forklift' => 'boolean',
            'picker_id' => 'nullable|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.location_id' => 'required|exists:locations,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-' . strtoupper(Str::random(6)),
            'status' => 'pending',
            'picker_id' => $validated['picker_id'] ?? null,
            'requires_forklift' => $validated['requires_forklift'] ?? false,
        ]);

        foreach ($validated['items'] as $item) {
            $order->items()->create([
                'product_id' => $item['product_id'],
                'location_id' => $item['location_id'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'] ?? 0.00,
                'picked_quantity' => 0,
                'is_picked' => false,
            ]);
        }

        return response()->json($order->load('items.product', 'items.location', 'picker'), 201);
    }
}
