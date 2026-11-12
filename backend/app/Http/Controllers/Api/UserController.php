<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Usuários de todos os perfis, para a tela de Configurações (só gestor).
 *
 * Perfil ("profile") junta role e picker_type:
 * manager = gestor, picker = coletor a pé, forklift = coletor com empilhadeira.
 * Regras: ninguém muda o próprio perfil nem remove a si mesmo; o último gestor não pode
 * deixar de ser gestor; coletor com pedido em andamento não pode ser removido.
 */
class UserController extends Controller
{
    private const PERFIS = ['manager', 'picker', 'forklift'];

    public function index(): JsonResponse
    {
        $usuarios = User::query()
            ->withMax('tokens', 'last_used_at')
            ->orderByRaw("case when role = 'manager' then 0 else 1 end")
            ->orderBy('name')
            ->get();

        return response()->json($usuarios->map(fn (User $u) => $this->present($u))->values());
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'profile' => ['required', Rule::in(self::PERFIS)],
        ], $this->mensagens());

        $usuario = User::create([
            'name' => $dados['name'],
            'email' => strtolower($dados['email']),
            'password' => $dados['password'],
            ...$this->camposDoPerfil($dados['profile']),
        ]);

        return response()->json($this->present($usuario->refresh()), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $dados = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'password' => 'nullable|string|min:8',
            'profile' => ['sometimes', Rule::in(self::PERFIS)],
        ], $this->mensagens());

        if (isset($dados['profile']) && $dados['profile'] !== $this->perfil($user)) {
            if ($user->is($request->user())) {
                return response()->json(['message' => 'Você não pode mudar o seu próprio perfil.'], 409);
            }
            if ($user->role === 'manager' && $this->ultimoGestor()) {
                return response()->json(['message' => 'É preciso ter pelo menos um gestor.'], 409);
            }
            $dados += $this->camposDoPerfil($dados['profile']);
        }
        unset($dados['profile']);

        if (empty($dados['password'])) {
            unset($dados['password']);
        }

        $user->update($dados);

        return response()->json($this->present($user->refresh()));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->is($request->user())) {
            return response()->json(['message' => 'Você não pode remover o seu próprio acesso.'], 409);
        }
        if ($user->role === 'manager' && $this->ultimoGestor()) {
            return response()->json(['message' => 'É preciso ter pelo menos um gestor.'], 409);
        }
        if (Order::where('picker_id', $user->id)->where('status', 'in_progress')->exists()) {
            return response()->json(['message' => 'Não é possível remover um coletor com pedido em andamento.'], 409);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Acesso removido.']);
    }

    private function ultimoGestor(): bool
    {
        return User::where('role', 'manager')->count() <= 1;
    }

    private function perfil(User $u): string
    {
        if ($u->role === 'manager') {
            return 'manager';
        }

        return $u->picker_type === 'forklift' ? 'forklift' : 'picker';
    }

    private function camposDoPerfil(string $perfil): array
    {
        return match ($perfil) {
            'manager' => ['role' => 'manager', 'picker_type' => 'foot'],
            'forklift' => ['role' => 'picker', 'picker_type' => 'forklift'],
            default => ['role' => 'picker', 'picker_type' => 'foot'],
        };
    }

    private function present(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'profile' => $this->perfil($u),
            'job_title' => $u->job_title,
            'last_seen_at' => $this->ultimoAcesso($u),
        ];
    }

    /** Último sinal do usuário: uso do token de login ou bipagem/status do coletor, o mais recente. */
    private function ultimoAcesso(User $u): ?string
    {
        $datas = array_filter([
            $u->last_seen_at,
            $u->tokens_max_last_used_at ? Carbon::parse($u->tokens_max_last_used_at) : null,
        ]);

        return $datas === [] ? null : max($datas)->toIso8601String();
    }

    private function mensagens(): array
    {
        return [
            'name.required' => 'Informe o nome da pessoa.',
            'email.required' => 'Informe o e-mail.',
            'email.email' => 'Informe um e-mail válido.',
            'email.unique' => 'Já existe um usuário com esse e-mail.',
            'password.required' => 'Informe uma senha inicial.',
            'password.min' => 'A senha precisa ter pelo menos 8 caracteres.',
        ];
    }
}
