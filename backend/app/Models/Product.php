<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'sku', 
    'name', 
    'weight', 
    'volume', 
    'barcode_primary', 
    'batch_code', 
    'requires_forklift',
    'location_id'
])]
class Product extends Model
{
    use HasFactory;

    public function location()
    {
        return $this->belongsTo(Location::class);
    }
}