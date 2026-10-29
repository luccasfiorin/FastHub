<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'picker_type', 'operator_name', 'work_status', 'last_seen_at', 'job_title'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_seen_at' => 'datetime',
        ];
    }

    public function scopePickers(Builder $query): Builder
    {
        return $query->where('role', 'picker');
    }

    /**
     * Status exibido: o informado pelo coletor, ou Offline se ele sumiu há muito tempo.
     * Sem last_seen_at (cadastro manual, nunca conectou) vale o status gravado.
     */
    public function effectiveStatus(): string
    {
        $limit = now()->subMinutes(config('fasthub.offline_after_minutes'));

        if ($this->last_seen_at && $this->last_seen_at->lt($limit)) {
            return 'offline';
        }

        return $this->work_status;
    }

    /** Muda o status e mantém o histórico de pausas em dia. */
    public function setWorkStatus(string $status): void
    {
        $open = PickerBreak::where('picker_id', $this->id)->whereNull('ended_at');

        if ($status === 'paused' && ! $open->exists()) {
            PickerBreak::create(['picker_id' => $this->id, 'started_at' => now()]);
        } elseif ($status !== 'paused') {
            $open->update(['ended_at' => now()]);
        }

        $this->update(['work_status' => $status]);
    }

    public function isDemo(): bool
    {
        return str_ends_with($this->email, '@demo.fasthub');
    }
}
