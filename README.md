# FastHub

Web app que resolve o problema de separação e roteirização de estoque
proposto pela Telecontrol: mapeia o armazém, calcula a rota de coleta
e acompanha o coletor até a conclusão do pedido.


## Linguagens

- PHP 8.3+: backend (Laravel)
- JavaScript: frontend (React)
- HTML e CSS: estrutura e estilo das telas
- SQL: banco MySQL

## Tecnologias

- Backend: Laravel + MySQL 
- Frontend: React + Vite
- Design: Figma
- Node: gerenciado via nvm 

## Como rodar

Pré-requisitos: PHP 8.3+, Composer, MySQL e nvm. Crie o banco antes:

`CREATE DATABASE fasthub;`

Backend (terminal 1), sobe em http://localhost:8000:

```bash
cd backend
composer install
cp .env.example .env    # troque DB_CONNECTION para mysql e descomente/ajuste as linhas DB_*
php artisan key:generate
php artisan migrate
php artisan serve
```

Frontend (terminal 2), sobe em http://localhost:5173:

```bash
nvm use
cd frontend
npm install
npm run dev
```
