<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $location = $this->route('location');
        $required = $this->isMethod('PATCH') ? 'sometimes' : 'required';

        $aisleId = $this->input('aisle_id', $location?->aisle_id);
        $shelf = $this->input('shelf', $location?->shelf);

        return [
            'aisle_id' => [$required, 'integer', 'exists:aisles,id'],
            'shelf' => [$required, 'string', 'max:20'],
            'position' => [
                $required, 'string', 'max:20',
                Rule::unique('locations', 'position')
                    ->where('aisle_id', $aisleId)
                    ->where('shelf', $shelf)
                    ->ignore($location),
            ],
            'coord_x' => ['sometimes', 'numeric', 'between:-999999.99,999999.99'],
            'coord_y' => ['sometimes', 'numeric', 'between:-999999.99,999999.99'],
            'coord_z' => ['sometimes', 'numeric', 'between:-999999.99,999999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'aisle_id.required' => 'Informe o corredor.',
            'aisle_id.exists' => 'Corredor não encontrado.',
            'shelf.required' => 'Informe a prateleira.',
            'position.required' => 'Informe a posição.',
            'position.unique' => 'Já existe essa posição nessa prateleira do corredor.',
        ];
    }
}
