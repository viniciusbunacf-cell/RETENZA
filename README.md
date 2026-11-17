# RETENZA

**Inteligência operacional de retenção de clientes, para empresas de qualquer segmento.**

Academias, escolas e cursos, software por assinatura, clínicas, clubes de assinatura, serviços recorrentes e provedores de internet usam o mesmo motor de risco. No cadastro a empresa escolhe o segmento (`src/lib/segments.ts`) e a plataforma passa a usar os termos dela (aluno, paciente, conta, assinante; unidade, turma, bairro, CTO) e a ajustar o texto das recomendações. Provedores de internet são a primeira ramificação, com página própria no site (`/provedores`) e material de prospecção em `docs/prospeccao/`.
Não espere o cliente cancelar: identifique o risco, entenda o motivo e aja antes da perda.

O RETENZA não é um painel de clientes insatisfeitos. É uma central que transforma dados da empresa em **ações preventivas** e **mede o resultado** dessas ações. Este repositório contém o MVP funcional: uma aplicação web SaaS, responsiva e multi-tenant.

> **Estado atual:** protótipo funcional para validação com empresas-piloto. Roda com dados fictícios de demonstração ou com dados reais importados por CSV. Os conectores diretos de ERP ainda não existem (ver [O que ainda não está implementado](#o-que-ainda-não-está-implementado)).

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

## Site de divulgação

A página inicial (`/`) é o site público do RETENZA para qualquer empresa: proposta, segmentos atendidos, como funciona, diferenciais, segurança, planos, programa de empresas parceiras e o formulário de pedido de demonstração (com o segmento do visitante). A versão para provedores de internet fica em `/provedores`. O painel fica em `/painel`; a política de privacidade em `/privacidade`.

Cada pedido de demonstração:

1. é gravado no banco (tabela `demo_requests`), então nada se perde mesmo que o e-mail falhe;
2. é enviado por e-mail para `RETENZA_CONTATO_EMAIL` pelo serviço Resend, quando `RESEND_API_KEY` está definida;
3. pode ser enviado pelo WhatsApp: após o envio, o visitante vê o botão "Enviar pelo WhatsApp", que abre uma conversa com `RETENZA_CONTATO_WHATSAPP` e a mensagem já preenchida com os dados do pedido.

O envio automático para o WhatsApp, sem ação do visitante, exigiria a API oficial do WhatsApp Business e não está implementado. Os e-mails listados em `RETENZA_ADMIN_EMAILS` veem todos os pedidos em `/demonstracoes`. As variáveis estão descritas em `.env.example`.

## Módulos

| Módulo | Rota | O que entrega |
|---|---|---|
| Dashboard executivo | `/painel` | Clientes ativos (com o termo do segmento), churn voluntário e involuntário, clientes e receita em risco, regiões com falhas concentradas, ações pendentes e resultado das ações |
| Radar de risco | `/radar`, `/clientes/[id]` | Classificação de cada cliente (crítico, alto, moderado, baixo) com os fatores, as evidências, a linha do tempo e a ação recomendada |
| Concentração de falhas | `/regioes` | Concentração de falhas por região e subunidade (bairro e CTO, unidade e modalidade, segmento e carteira...), evolução do risco e lista prioritária para a equipe responsável |
| Central de ações | `/acoes` | Ações preventivas com problema, recomendação, responsável e prazo; registro da solução e histórico da intervenção |
| Indicadores de retenção | `/indicadores` | Taxa de intervenção, tempo de resolução, comparação entre clientes com e sem intervenção, receita preservada (observada x estimada) e validação do score |
| Integrações | `/integracoes` | Importação por CSV (clientes e cancelamentos, uso do serviço, chamados, falhas no serviço, faturas) com modelos de arquivo |
| Configurações | `/configuracoes` | Regras e pesos do score, usuários e perfis, privacidade, exclusão de dados e registro de atividades |

## Como o risco é calculado

O MVP usa **regras de negócio configuráveis**, não um modelo estatístico. O motor (`src/lib/risk/engine.ts`) é uma função pura que observa seis grupos de sinais:

1. **Qualidade do serviço**: interrupções e problemas recorrentes, tempo fora do ar, qualidade abaixo do esperado.
2. **Uso e engajamento**: queda de uso (visitas, aulas, acessos, consultas) em relação à média dos 90 dias anteriores e ausência de uso recente.
3. **Atendimento**: volume de chamados, reclamação reincidente, problema não resolvido.
4. **Financeiro**: fatura em atraso, pagamentos fora do prazo recorrentes.
5. **Insatisfação**: nota baixa, intenção de cancelamento manifestada, pedido de desconto.
6. **Relacionamento**: cliente recente, tentativa anterior de retenção.

Cuidados embutidos:

- **Sem dupla contagem.** Um chamado de suporte aberto logo após uma falha registrada para o mesmo cliente é tratado como o mesmo incidente e não soma em "volume de chamados". Pedidos de cancelamento e desconto contam só em "insatisfação".
- **Teto por grupo.** Nenhum tipo de evidência domina o score. Com os tetos padrão, atraso de pagamento isolado nunca passa de risco baixo, risco alto exige ao menos dois grupos e risco crítico exige a convergência de pelo menos três.
- **Explicável.** Todo score guarda as regras disparadas, os pontos e a evidência em texto ("Nenhum uso registrado há 23 dias; antes, a média era de 12 a cada 30 dias"), além das observações de transparência.
- **Recalculável no passado.** O motor só considera fatos conhecidos até a data de referência. Isso permite reconstruir o score semana a semana a partir do histórico importado e confrontá-lo com os cancelamentos reais.

Os pesos iniciais (`src/lib/risk/config.ts`) são um ponto de partida ilustrativo e precisam ser calibrados com a taxa real de cancelamento de cada empresa.

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

Cinco arquivos CSV: clientes (incluindo cancelados) primeiro e, depois, o que a empresa tiver: uso do serviço (uma linha por visita, aula, acesso ou consulta), chamados, falhas no serviço e faturas. Os modelos ficam em `public/modelos/` (`clientes.csv`, `uso.csv`, `chamados.csv`, `falhas.csv`, `faturas.csv`) e a lista de colunas aceitas, com sinônimos como `matricula`, `unidade` ou `turma`, aparece na tela de Integrações.

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
src/app/(auth)        login e cadastro da empresa (com escolha do segmento)
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

### Produção (Vercel + Supabase)

1. **Supabase:** crie um projeto na região São Paulo e copie a conexão do tipo *Transaction pooler* (botão **Connect**), trocando `[YOUR-PASSWORD]` pela senha do banco.
2. **Vercel:** importe o repositório do GitHub e, antes de publicar, defina as variáveis `DATABASE_URL` (a conexão acima) e, se quiser, `RETENZA_DEMO=true` (provedor de internet fictício para demonstrações), `CRON_SECRET` (recálculo diário automático) e as variáveis de contato do site (`.env.example`).
3. **Publicação:** o script `vercel-build` aplica as migrações do banco e gera o build. O `vercel.json` coloca as funções em São Paulo (`gru1`) e agenda o recálculo diário às 6h de Brasília.

Sem `SESSION_SECRET`, a chave das sessões é derivada de `DATABASE_URL`. Limite conhecido: na Vercel, cada envio de arquivo para o servidor aceita até cerca de 4,5 MB; arquivos CSV maiores precisam ser divididos.

## Segurança e LGPD

- **Isolamento por empresa.** Toda tabela operacional tem `provider_id` (o nome da tabela `providers` ficou da primeira versão; cada linha é uma empresa) e toda consulta parte da empresa da sessão, nunca de um parâmetro enviado pelo navegador.
- **Acesso por função.** Proprietário, gestor e atendente. Regras, importações e recálculo exigem gestor; usuários e exclusão de dados exigem proprietário.
- **Minimização.** CPF/CNPJ, endereço completo e dados de pagamento não são importados nem armazenados; a localização fica em nível de bairro e CTO.
- **Somente leitura.** A plataforma não altera contratos, não bloqueia clientes e não envia mensagens.
- **Score explicável e sem decisão automatizada** sobre o titular (LGPD, art. 20): o score orienta a equipe, que decide e executa.
- **Auditoria.** Logins, importações, alterações de regras, ações e exclusões ficam registrados.
- **Exclusão.** O proprietário pode apagar todos os dados operacionais da empresa.

Pontos a endurecer antes de receber dados reais em produção: Row Level Security no Postgres como segunda camada de isolamento, criptografia em repouso garantida pelo provedor do banco, política formal de retenção de dados, recuperação de senha e segundo fator, limite de tentativas de login distribuído (hoje é em memória) e contrato de tratamento de dados com cada empresa.

## O que ainda não está implementado

Seguindo o recorte do MVP, ficaram de fora de propósito:

- **Conectores diretos** (HubSoft, IXC, SGP e MK para provedores; EVO, Tecnofit, Stripe etc. para outros segmentos). A entrada de dados é por CSV; o primeiro conector deve ser o do sistema da empresa-piloto.
- **IA generativa e modelos preditivos.** O score é por regras. Modelos estatísticos dependem de histórico real de quem cancelou e de quem ficou.
- **Mapa geográfico.** A análise regional é tabular (bairro e CTO), sem geocodificação.
- **Automação de WhatsApp ou qualquer disparo de mensagem.**
- **Planos, cobrança e limite por número de clientes ativos.**
- **Convite de usuários por e-mail e recuperação de senha.**

## Dados de demonstração

A base fictícia (`src/lib/demo/generate.ts`) simula 56 semanas de um provedor regional: falhas individuais e regionais, chamados, pesquisas de satisfação, faturas, intervenções e cancelamentos. O cancelamento depende de uma "frustração" latente alimentada pelos mesmos eventos que o motor observa, e parte dos cancelamentos não tem sinal prévio nenhum. Por isso os indicadores da demonstração são plausíveis, mas **não dizem nada sobre o desempenho com dados reais**. A base é gerada em relação à data de carga; recarregue-a em Configurações antes de uma apresentação.
