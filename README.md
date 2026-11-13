# RETENZA

**Inteligência operacional de retenção para provedores de internet.**
Não espere o cliente cancelar: identifique o risco, entenda o motivo e aja antes da perda.

O RETENZA não é um painel de clientes insatisfeitos. É uma central que transforma dados do provedor em **ações preventivas** e **mede o resultado** dessas ações. Este repositório contém o MVP funcional: uma aplicação web SaaS, responsiva e multi-tenant.

> **Estado atual:** protótipo funcional para validação com provedores-piloto. Roda com dados fictícios de demonstração ou com dados reais importados por CSV. Os conectores diretos de ERP ainda não existem (ver [O que ainda não está implementado](#o-que-ainda-não-está-implementado)).

## Como executar

Requisitos: Node.js 20.9 ou superior.

```bash
npm install
```

```bash
npm run dev
```

Abra `http://localhost:3000`. Sem nenhuma configuração a aplicação sobe em **modo demonstração**: usa um PostgreSQL embarcado (PGlite, gravado em `.data/`), cria um provedor fictício com 1.800 assinantes e 12 meses de histórico e já deixa o acesso preenchido na tela de login (`demo@retenza.app` / `retenza-demo`). O primeiro carregamento leva alguns segundos enquanto a base é gerada.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários do motor de risco e da leitura de CSV |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm run build` e `npm start` | Build e servidor de produção |
| `npm run demo:check` | Gera a base fictícia e imprime os números-chave (churn, faixas, validação do score) |
| `npm run db:generate` | Gera uma nova migração SQL a partir de `src/db/schema.ts` |

## Módulos

| Módulo | Rota | O que entrega |
|---|---|---|
| Dashboard executivo | `/` | Assinantes ativos, churn voluntário e involuntário, clientes e receita em risco, regiões com falhas concentradas, ações pendentes e resultado das ações |
| Radar de risco | `/radar`, `/clientes/[id]` | Classificação de cada cliente (crítico, alto, moderado, baixo) com os fatores, as evidências, a linha do tempo e a ação recomendada |
| Inteligência geográfica | `/regioes` | Concentração de falhas por bairro e CTO, evolução do risco da região e lista prioritária para a equipe técnica |
| Central de ações | `/acoes` | Ações preventivas com problema, recomendação, responsável e prazo; registro da solução e histórico da intervenção |
| Indicadores de retenção | `/indicadores` | Taxa de intervenção, tempo de resolução, comparação entre clientes com e sem intervenção, receita preservada (observada x estimada) e validação do score |
| Integrações | `/integracoes` | Importação por CSV (clientes e cancelamentos, chamados, eventos de rede, faturas) com modelos de arquivo |
| Configurações | `/configuracoes` | Regras e pesos do score, usuários e perfis, privacidade, exclusão de dados e registro de atividades |

## Como o risco é calculado

O MVP usa **regras de negócio configuráveis**, não um modelo estatístico. O motor (`src/lib/risk/engine.ts`) é uma função pura que observa cinco grupos de sinais:

1. **Qualidade do serviço**: quedas e instabilidades recorrentes, tempo fora do ar, lentidão.
2. **Atendimento**: volume de chamados, reclamação reincidente, problema não resolvido.
3. **Financeiro**: fatura em atraso, pagamentos fora do prazo recorrentes.
4. **Insatisfação**: nota baixa, intenção de cancelamento manifestada, pedido de desconto.
5. **Relacionamento**: cliente recente, tentativa anterior de retenção.

Cuidados embutidos:

- **Sem dupla contagem.** Um chamado técnico aberto logo após uma queda registrada para o mesmo cliente é tratado como o mesmo incidente e não soma em "volume de chamados". Pedidos de cancelamento e desconto contam só em "insatisfação".
- **Teto por grupo.** Nenhum tipo de evidência domina o score. Com os tetos padrão, atraso de pagamento isolado nunca passa de risco baixo, risco alto exige ao menos dois grupos e risco crítico exige a convergência de pelo menos três.
- **Explicável.** Todo score guarda as regras disparadas, os pontos e a evidência em texto ("4 quedas/instabilidades nos últimos 30 dias"), além das observações de transparência.
- **Recalculável no passado.** O motor só considera fatos conhecidos até a data de referência. Isso permite reconstruir o score semana a semana a partir do histórico importado e confrontá-lo com os cancelamentos reais.

Os pesos iniciais (`src/lib/risk/config.ts`) são um ponto de partida ilustrativo e precisam ser calibrados com a taxa real de cancelamento de cada provedor.

## Do alerta à ação

A cada recálculo (`src/lib/retention/generate.ts`):

- regiões em que muitos clientes apresentam falhas viram **uma ação regional** para a equipe técnica, em vez de dezenas de ocorrências isoladas;
- cada cliente em risco crítico sem ação em aberto recebe uma **ação individual** com a recomendação adequada à causa predominante. Quem já está coberto por uma ação regional só recebe a individual se manifestou intenção de cancelar;
- nenhuma ação em aberto é duplicada.

O recálculo acontece após cada importação, pelo botão "Recalcular risco" ou por um agendador externo chamando `POST /api/cron/recalcular` com `Authorization: Bearer $CRON_SECRET`.

## Como o resultado é medido

- **Validação do score** (`src/lib/metrics/validation.ts`): dos clientes que cancelaram voluntariamente, quantos estavam em risco alto ou crítico nos 30 dias anteriores; taxa de cancelamento por faixa em fotografias sem sobreposição; volume de alertas. A meta de antecipar 60% dos cancelamentos é uma hipótese a testar no piloto, não uma promessa.
- **Efeito das intervenções** (`src/lib/metrics/interventions.ts`): compara clientes sinalizados que receberam intervenção com clientes sinalizados na mesma janela que não receberam, acompanhados por 45 dias. A tela separa o **resultado observado** (receita dos clientes que ficaram) da **estimativa de efeito** (diferença entre os grupos) e avisa que a comparação é observacional. Um cliente que recebeu uma ação e não cancelou nunca é contado automaticamente como "recuperado".

Sem o histórico de cancelamentos dos últimos 6 a 12 meses o sistema ainda detecta eventos problemáticos, mas não consegue afirmar que o score prevê churn. A interface avisa quando esse histórico está ausente.

## Importação de dados

Quatro arquivos CSV, nesta ordem: clientes (incluindo cancelados), chamados, eventos de rede e faturas. Os modelos ficam em `public/modelos/` e a lista de colunas aceitas aparece na tela de Integrações.

- Separador vírgula ou ponto e vírgula, datas `dd/mm/aaaa hh:mm` ou ISO, valores `99,90` ou `99.90`, UTF-8 ou Windows-1252.
- Cabeçalhos com acento e sinônimos comuns são reconhecidos (`bairro`/`regiao`, `id_cliente`/`codigo_cliente` etc.).
- A importação é idempotente: a chave é o identificador do ERP, então reimportar atualiza sem duplicar.
- Categorias livres de chamado ("Suporte técnico", "Ouvidoria", "Cancelamento") são normalizadas para as categorias do motor.

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Interface e servidor | Next.js 16 (App Router, Server Components e Server Actions), TypeScript, Tailwind CSS 4 |
| Gráficos | Recharts |
| Banco | PostgreSQL via Drizzle ORM. Produção: qualquer Postgres (Supabase, RDS, Neon). Demonstração: PGlite embarcado, com o mesmo SQL |
| Autenticação | Sessão própria em cookie `httpOnly` assinado (JWT HS256), senhas com scrypt |
| Testes | Vitest |

Estrutura principal:

```
src/app/(auth)        login e cadastro do provedor
src/app/(app)         módulos autenticados
src/app/actions       Server Actions (mutações), sempre com checagem de sessão e perfil
src/db                schema e conexão
src/lib/risk          motor de risco, configuração, recomendações, recálculo
src/lib/retention     geração e consulta de ações preventivas
src/lib/metrics       dashboard, regiões, validação do score, efeito das intervenções
src/lib/import        leitura e carga de CSV
src/lib/demo          gerador da base fictícia
drizzle/              migrações SQL
```

### Produção

Defina `DATABASE_URL` e `SESSION_SECRET` (ver `.env.example`). As migrações de `drizzle/` são aplicadas na primeira conexão. Com `DATABASE_URL` definido, o modo demonstração fica desligado, a menos que `RETENZA_DEMO=true`.

O build de produção e todos os fluxos foram testados localmente contra PostgreSQL 16 e contra o banco embarcado. A publicação em Vercel + Supabase ainda não foi exercitada.

## Segurança e LGPD

- **Isolamento por provedor.** Toda tabela operacional tem `provider_id` e toda consulta parte do provedor da sessão, nunca de um parâmetro enviado pelo navegador.
- **Acesso por função.** Proprietário, gestor e atendente. Regras, importações e recálculo exigem gestor; usuários e exclusão de dados exigem proprietário.
- **Minimização.** CPF/CNPJ, endereço completo e dados de pagamento não são importados nem armazenados; a localização fica em nível de bairro e CTO.
- **Somente leitura.** A plataforma não altera contratos, não bloqueia clientes e não envia mensagens.
- **Score explicável e sem decisão automatizada** sobre o titular (LGPD, art. 20): o score orienta a equipe, que decide e executa.
- **Auditoria.** Logins, importações, alterações de regras, ações e exclusões ficam registrados.
- **Exclusão.** O proprietário pode apagar todos os dados operacionais do provedor.

Pontos a endurecer antes de receber dados reais em produção: Row Level Security no Postgres como segunda camada de isolamento, criptografia em repouso garantida pelo provedor do banco, política formal de retenção de dados, recuperação de senha e segundo fator, limite de tentativas de login distribuído (hoje é em memória) e contrato de tratamento de dados com cada provedor.

## O que ainda não está implementado

Seguindo o recorte do MVP, ficaram de fora de propósito:

- **Conectores de ERP** (HubSoft, IXC, SGP, MK). A entrada de dados é por CSV; o primeiro conector deve ser o do ERP do provedor-piloto.
- **IA generativa e modelos preditivos.** O score é por regras. Modelos estatísticos dependem de histórico real de quem cancelou e de quem ficou.
- **Mapa geográfico.** A análise regional é tabular (bairro e CTO), sem geocodificação.
- **Automação de WhatsApp ou qualquer disparo de mensagem.**
- **Planos, cobrança e limite por número de assinantes.**
- **Convite de usuários por e-mail e recuperação de senha.**

## Dados de demonstração

A base fictícia (`src/lib/demo/generate.ts`) simula 56 semanas de um provedor regional: falhas individuais e regionais, chamados, pesquisas de satisfação, faturas, intervenções e cancelamentos. O cancelamento depende de uma "frustração" latente alimentada pelos mesmos eventos que o motor observa, e parte dos cancelamentos não tem sinal prévio nenhum. Por isso os indicadores da demonstração são plausíveis, mas **não dizem nada sobre o desempenho com dados reais**. A base é gerada em relação à data de carga; recarregue-a em Configurações antes de uma apresentação.
