# FastHub

Web app que resolve o problema de separação e roteirização de estoque
proposto pela Telecontrol: mapeia o armazém, calcula a rota de coleta
e acompanha o coletor até a conclusão do pedido.


## Linguagens

- PHP 8.3+: backend (Laravel)
- JavaScript: frontend (React)
- HTML e CSS: estrutura e estilo das telas
- SQL: banco SQLite

## Tecnologias

- Backend: Laravel 13 + Sanctum (autenticação por token)
- Banco: SQLite (arquivo `backend/database/database.sqlite`)
- Frontend: React 19 + Vite
- Design: Figma
- Node: versão 20, gerenciado via nvm (`.nvmrc`)

## Como rodar

Pré-requisitos: PHP 8.3+ com a extensão `pdo_sqlite`, Composer e nvm.
Não precisa instalar nem criar servidor de banco: o SQLite é um arquivo
dentro do projeto e fica fora do git.

Backend (terminal 1), sobe em http://localhost:8000:

```bash
cd backend
composer install
cp .env.example .env               # já vem com DB_CONNECTION=sqlite, não precisa mexer
touch database/database.sqlite     # cria o arquivo do banco
php artisan key:generate
php artisan migrate
php artisan db:seed --class=UserSeeder        # usuários de acesso
php artisan db:seed --class=DemoPickersSeeder # opcional: coletores, pedidos e bipagens de demonstração
php artisan serve
```

Frontend (terminal 2), sobe em http://localhost:5173:

```bash
nvm use
cd frontend
npm install
npm run dev
```

O Vite repassa as chamadas de `/api` para o Laravel em `localhost:8000`,
então os dois precisam estar rodando.

## Acesso

Usuários criados pelo `UserSeeder`:

| Perfil  | E-mail              | Senha       |
| ------- | ------------------- | ----------- |
| Gestor  | gestor@fasthub.com  | password123 |
| Coletor | coletor@fasthub.com | password123 |

Os coletores do `DemoPickersSeeder` usam e-mail `@demo.fasthub` e a mesma
senha. Para remover só eles:

```bash
php artisan tinker --execute 'App\Models\User::where("email","like","%@demo.fasthub")->delete();'
```

Para zerar o banco e começar de novo: `php artisan migrate:fresh` e rode os
seeders outra vez.

## Testes

```bash
cd backend
php artisan test
```

Os testes usam SQLite em memória (`phpunit.xml`) e não tocam no
`database.sqlite` local.

## Documentação

- [docs/rota-de-coleta.md](docs/rota-de-coleta.md): algoritmo da rota de coleta (RF04, RNF04, RN04)
- `backend/postman/`: coleção do Postman para corredores e posições
