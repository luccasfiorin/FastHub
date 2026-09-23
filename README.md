# FastHub

Web app que resolve o problema de picking e roteirização de estoque
proposto pela Telecontrol: mapeia o armazém, calcula a rota de coleta
e acompanha o coletor até a conclusão do pedido — tudo pela web.

## Stack

- Backend: PHP + Laravel + MySQL (API REST)
- Frontend: HTML/CSS + React (Vite)
- Design: Figma
- Node: gerenciado via nvm (`.nvmrc` na raiz)



## Setup

```bash
nvm use 20

# backend (precisa de PHP 8.2+ e Composer)
cd backend && composer create-project laravel/laravel . && cp .env.example .env && php artisan key:generate && php artisan migrate

# frontend  
cd frontend && npm install && npm run dev
```
