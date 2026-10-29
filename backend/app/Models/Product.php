<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['sku', 'name', 'weight', 'volume', 'barcode_primary', 'batch_code', 'requires_forklift'])]
class Product extends Model
{
    use HasFactory;
}
