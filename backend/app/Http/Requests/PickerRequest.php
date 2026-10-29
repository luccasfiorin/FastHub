<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PickerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $picker = $this->route('picker');
        $creating = $this->isMethod('POST');

        return [
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'email' => [$creating ? 'required' : 'sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($picker)],
            'password' => [$creating ? 'required' : 'nullable', 'string', 'min:8'],
            'picker_type' => ['sometimes', Rule::in(['foot', 'forklift'])],
            'operator_name' => ['nullable', 'string', 'max:255'],
            'work_status' => ['sometimes', Rule::in(['active', 'paused', 'offline'])],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Informe o nome do coletor.',
            'email.required' => 'Informe o e-mail de acesso.',
            'email.email' => 'Informe um e-mail válido.',
            'email.unique' => 'Já existe um usuário com esse e-mail.',
            'password.required' => 'Informe uma senha de acesso.',
            'password.min' => 'A senha precisa ter no mínimo 8 caracteres.',
            'picker_type.in' => 'Função inválida.',
            'work_status.in' => 'Status inválido.',
        ];
    }
}
