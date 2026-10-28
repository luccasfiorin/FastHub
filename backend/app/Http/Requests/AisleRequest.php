<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AisleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $aisle = $this->route('aisle');
        $required = $this->isMethod('PATCH') ? 'sometimes' : 'required';

        return [
            'code' => [$required, 'string', 'max:20', Rule::unique('aisles', 'code')->ignore($aisle)],
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.required' => 'Informe o código do corredor.',
            'code.unique' => 'Já existe um corredor com esse código.',
            'code.max' => 'O código do corredor pode ter no máximo 20 caracteres.',
        ];
    }
}
