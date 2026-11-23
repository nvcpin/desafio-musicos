# Desafio dos Pequenos Músicos

App web (sem login para os pais) para registrar uma estrela por dia de estudo (23–27/11/2026), com progresso coletivo público e Painel da professora protegido.

## Estrutura
```
desafio/
├─ index.html        página dos pais
├─ app.js            lógica dos pais (só chama funções públicas do banco)
├─ painel.html       Painel da professora
├─ painel.js         lógica do painel (login Google via Supabase)
├─ style.css         visual
├─ config.js         URL + chave PUBLISHABLE do Supabase (única coisa a editar)
├─ CNAME             desafio.tomdavoz.com.br
├─ supabase/schema.sql   tabelas, segurança (RLS) e funções
└─ tests/            test_sql.mjs (45 testes do banco) e e2e.mjs (42 testes no navegador)
```

## Passo 1 — Banco (Supabase, projeto NOVO)
1. supabase.com → New project (nome: `desafio-musicos`, região South America/São Paulo, senha forte guardada). Plano Free.
2. **SQL Editor** → New query → cole todo o `supabase/schema.sql` → **Run**. (Pode rodar de novo sem problema.) Isso cria as 14 crianças e autoriza o e-mail da professora.
3. **Project Settings → API Keys**: copie a **Project URL** (`https://xxxx.supabase.co`, sem `/rest/v1/`) e a chave **publishable** (`sb_publishable_...`). **Nunca** use/cole a chave `secret`/`service_role`.
4. Abra `config.js` e cole os dois valores.

## Passo 2 — Login Google da professora
1. Supabase → **Authentication → Providers → Google → Enable**. Precisa de Client ID/Secret do Google Cloud (você já fez isso no Tom da Voz: Google Cloud → APIs e serviços → Credenciais → ID do cliente OAuth → Aplicativo da Web). No Google, em *URIs de redirecionamento autorizados*, adicione a **Callback URL** que o Supabase mostra nessa tela (`https://xxxx.supabase.co/auth/v1/callback`).
2. Supabase → **Authentication → URL Configuration**: *Site URL* = `https://desafio.tomdavoz.com.br`; em *Redirect URLs* adicione `https://desafio.tomdavoz.com.br/painel.html`.
3. Acesso: só entra no painel quem estiver na tabela `teachers` (já tem `nvcpinheiro@gmail.com`). Para incluir outra pessoa: SQL Editor → `insert into teachers(email) values ('outra@gmail.com');`.

## Passo 3 — Publicar (GitHub Pages, repositório NOVO)
1. GitHub → New repository `desafio-musicos` (público). Faça upload de **todos os arquivos da raiz** (index.html, app.js, painel.html, painel.js, style.css, config.js, CNAME) — pastas `supabase/` e `tests/` são opcionais.
2. Settings → Pages → Branch `main` / root → Save.
3. Settings → Pages → Custom domain: `desafio.tomdavoz.com.br` → Save.

## Passo 4 — Domínio (Registro.br)
Registro.br → seu domínio `tomdavoz.com.br` → DNS → **Editar zona** → novo registro:
- Tipo **CNAME**, nome `desafio`, dados `nvcpin.github.io.`

(Não mexe no registro do site principal.) Aguarde de minutos a algumas horas; depois, em Settings → Pages, marque **Enforce HTTPS** (certificado gratuito automático).
Enquanto o DNS não propaga, o app também abre em `https://nvcpin.github.io/desafio-musicos/` — mas o login Google do painel só funciona no domínio configurado no passo 2 (ou adicione essa URL também em Redirect URLs).

## Variáveis de ambiente
Não há: é um site estático. A URL e a chave pública ficam em `config.js` (podem ser públicas). Segredos não existem no projeto.

## Como a professora acessa
`https://desafio.tomdavoz.com.br/painel.html` → **Entrar com Google** → conta autorizada. Tabela geral, aba **Por dia**, **Atualizar**, **Exportar CSV** (abre no Excel). Atualiza sozinho a cada 30 s.

## Segurança (resumo)
- Tabelas fechadas (RLS sem policies): ninguém lê/grava direto. Só funções específicas: lista de crianças (id/nome), estrelas de uma criança, registrar estrela, progresso agregado, hora do servidor.
- Data decidida pelo servidor em `America/Sao_Paulo` (só hoje, 23–27/11); relógio do celular é ignorado; `UNIQUE(criança, dia)` + `CHECK` de data na tabela.
- Painel: funções exigem login e e-mail na tabela `teachers`; sem senha no código.
- Anti-abuso: limite de 40 tentativas/10 min por IP, campo isca para robôs, confirmação antes de registrar.

## Limites conhecidos (sem login, por escolha)
Quem tiver o link pode registrar a estrela de hoje de qualquer criança listada, e a lista de nomes é pública. Se quiser, dá para adicionar um código da turma (combinado no grupo) — não foi feito sem sua autorização.

## Testes
`node tests/test_sql.mjs` (datas/fuso, duplicidade, persistência, permissões, abuso) e `node tests/e2e.mjs` (fluxo completo em navegador, relógio adulterado, painel, CSV). Requer `@electric-sql/pglite` e `playwright`.
