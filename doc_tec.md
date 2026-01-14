# Documentação Técnica: DRE View

## 1. Stack Tecnológico

### Core
*   **Framework:** React 18
*   **Build Tool:** Vite
*   **Linguagem:** TypeScript (ES2020)

### Estilização & UI
*   **CSS Framework:** Tailwind CSS (via CDN na versão atual, foco em Dark Mode).
*   **Ícones:** Font Awesome (via CDN).
*   **Fontes:** Google Fonts (Inter, Roboto).
*   **Componentes Customizados:** Modal, Shuttle (Transfer List).

### Backend & Auth
*   **Plataforma:** Supabase (BaaS).
*   **Banco de Dados:** PostgreSQL.
*   **Autenticação:** Supabase Auth (Email/Password).
*   **Segurança:** Row Level Security (RLS) policies no banco de dados (gerenciado via Client no Frontend).

### Integração de Dados
*   **Cliente HTTP:** Fetch API nativa.
*   **Webhooks Externos:** Integração com `webhook.moondog-ia.tech` para processamento pesado de DRE e visualização de estruturas.

### Bibliotecas Auxiliares
*   **PDF:** `jspdf` e `jspdf-autotable`.
*   **Excel:** `xlsx` (SheetJS).
*   **Gerenciamento de Estado:** React Context API (`AuthContext`).

---

## 2. Arquitetura e Fluxo de Usuário

### Arquitetura
O sistema opera como uma **Single Page Application (SPA)**. A lógica de negócio é dividida entre o Frontend (regras de visualização, validação de formulários, composição de payloads) e o Backend (Supabase para persistência e Auth, Webhooks para processamento de dados financeiros).

### Fluxo de Autenticação e Contexto
1.  **Login:** Usuário realiza login via `LoginPage.tsx`.
2.  **Verificação de Vínculos:** O sistema consulta a tabela `rel_prof_cli_empr` para identificar a quais clientes o usuário tem acesso.
3.  **Seleção de Contexto (`AuthContext`):**
    *   Se o usuário possui acesso a múltiplos clientes, é direcionado para `ClientSelectionPage.tsx`.
    *   Ao selecionar, o objeto `selectedClient` é armazenado no Contexto e no `localStorage`.
    *   **Regra de Ouro:** Todas as requisições de dados subsequentes injetam o `cliente_id` do contexto para garantir isolamento de dados (Multi-tenancy).
4.  **Dashboard:** O usuário acessa a aplicação principal.

### Controle de Acesso (RBAC Granular)
O acesso é definido em três níveis na tabela `rel_prof_cli_empr`:
1.  **Nível Cliente:** Se `empresa_id` for `NULL`, o usuário tem acesso total ao cliente.
2.  **Nível Raiz CNPJ:** Acesso a todas as filiais com a mesma raiz de CNPJ.
3.  **Nível Empresa:** Acesso restrito a um `empresa_id` específico.

---

## 3. Funcionalidades Principais

1.  **Dashboard Financeiro:** Visualização consolidada de resultados (DRE) com filtros dinâmicos e cartões de KPI.
2.  **Gestão de Visões:** Criação de agrupamentos de empresas (Por Cliente, Por Grupo/Raiz, Customizado) e associação com um **Template de DRE** para formatação do relatório.
3.  **Motor de Templates:** Construtor de relatórios DRE com *drag-and-drop*, permitindo definir fórmulas, contas contábeis e formatação.
4.  **CRUDs Estruturais:** Gestão de Clientes, Grupos Empresariais, Empresas e Planos Contábeis.
5.  **Comparador de Planos:** Ferramenta para auditar divergências entre planos de contas de empresas distintas.
6.  **Gestão de Usuários:** Administração de perfis e matriz de permissões complexa.

---

## 4. Estrutura de Banco de Dados e Webhooks

### Tabelas Consumidas
*   **Autenticação/Perfil:** `profiles` (tabela pública espelhada do `auth.users`).
*   **Estrutura Societária:** `dre_cliente`, `dre_grupo_empresa`, `dre_empresa`.
*   **Financeiro:** `dre_plano_contabil`.
*   **Análise (Visões):** `dre_visao`, `rel_visao_empresa`, `dre_visao_grupo_cnpj`.
*   **Templates:** `dre_template`, `dre_template_linhas`, `dre_template_card`.
*   **Configurações (Domínio):** `tab_situacao`, `tab_tipo_linha`, `tab_estilo_linha`, `tab_tipo_visao`.
*   **Permissões:** `rel_prof_cli_empr`.

### Views (Vistas SQL)
*   `viw_cnpj_raiz`: Retorna lista distinta de raízes de CNPJ por cliente.
*   `viw_periodo_calc`: Retorna os períodos (competências) disponíveis para consulta.

### Webhooks
1.  **Dados do DRE:**
    *   **URL:** `https://webhook.moondog-ia.tech/webhook/dre`
    *   **Parâmetros:** `?carga={YYYYMM}&id={visao_id}&modelo={template_id}`
    *   **Uso:** Retorna o JSON calculado com os saldos para o Dashboard.
2.  **Estrutura do Template:**
    *   **URL:** `https://webhook.moondog-ia.tech/webhook/temp_dre`
    *   **Parâmetros:** `?cntr={codigo_controle_template}`
    *   **Uso:** Retorna a árvore estrutural processada para pré-visualização.

---

## 5. Diretrizes de Desenvolvimento

1.  **Segurança de Dados:** Nunca realizar queries sem filtrar por `cliente_id` (exceto tabelas de domínio globais ou na seleção inicial de cliente). Use `selectedClient.id` do `useAuth`.
2.  **Performance:** Utilizar `Promise.all` para carregar comboboxes dependentes em paralelo. Implementar *debounce* em campos de busca de texto.
3.  **UI/UX:**
    *   Manter padrão *Dark Mode*.
    *   Sempre exibir *Spinners* de carregamento.
    *   Modais devem fechar com ESC ou clique fora.
    *   Feedback de erro deve ser claro (Toast ou Banner).
4.  **Integridade:** Ao trocar de Cliente no contexto, limpar estados locais que dependam do cliente anterior (ex: templates selecionados, visões).

---

## 6. Mapeamento de Páginas e Dados

### A. Dashboard (`DashboardPage.tsx`)
*   **Dependências de Dados:**
    *   `viw_periodo_calc`: Dropdown de Período.
    *   `dre_visao`: Dropdown de Visão (Filtrado por: `cliente_id` e permissões do usuário em `rel_prof_cli_empr`).
    *   `dre_template`: Lista de Templates (Filtrado por: `cliente_id` e compatibilidade com a Visão selecionada - match `cliente_cnpj`).
    *   `dre_template_card`: Configuração dos 4 KPIs.
    *   `dre_template_linhas` + `tab_estilo_linha`: Estilização da tabela.
*   **Webhooks:** Consome `/webhook/dre` para popular a tabela e os cards.
*   **Regras:**
    *   Se o usuário não tiver permissão em *todas* as empresas de uma visão, essa visão não deve aparecer.
    *   Templates devem ser filtrados para mostrar apenas os globais ou os específicos da Raiz CNPJ da visão selecionada.

### B. Gestão de Visões (`VisaoListPage.tsx`, `VisaoEditPage.tsx`)
*   **Tabelas Principais:** `dre_visao` (Header), `rel_visao_empresa` (Itens Empresas), `dre_visao_grupo_cnpj` (Itens Raiz).
*   **Comboboxes/Form:**
    *   `dre_cliente`: Seleção de Cliente.
    *   `tab_tipo_visao`: Tipo (Cliente, Grupo, Customizado).
    *   `dre_template`: Template associado à visão (Filtrado pelo cliente selecionado).
    *   `dre_empresa`: Para seleção no componente *Shuttle*.
*   **Regras:**
    *   Validar unicidade: Não permitir visões duplicadas para o mesmo escopo.
    *   Ao selecionar "Grupo", usar `viw_cnpj_raiz` para listar opções.
    *   A lista de templates disponíveis no cadastro deve ser filtrada pelo `cliente_id` selecionado na visão.

### C. Gestão de Templates (`TemplateListPage.tsx`, `TemplateEditPage.tsx`)
*   **Tabelas Principais:** `dre_template`, `dre_template_linhas`.
*   **Comboboxes/Form:**
    *   `viw_cnpj_raiz`: Para associar o template a um plano de contas específico.
    *   `tab_tipo_linha`: (Título, Conta, Fórmula, etc).
    *   `tab_estilo_linha`: Formatação visual.
    *   `dre_plano_contabil`: Busca de contas (Autocomplete).
    *   `dre_visao`: Associação de linha exclusiva a uma visão.
*   **Webhooks:** Consome `/webhook/temp_dre` no botão "Visualizar Estrutura".
*   **Regras:**
    *   Edição de linhas suporta *Drag and Drop*.
    *   O campo `cliente_id` é fixo no `selectedClient`.

### D. Configuração de Cards (`TemplateCardPage.tsx`)
*   **Tabelas:** `dre_template_card`.
*   **Lógica:** Mapeia uma linha do `dre_template_linhas` para uma posição (1-4) e define se mostra Valor Acumulado ou Percentual.

### E. Usuários e Permissões (`UsuarioPage.tsx`)
*   **Tabelas:** `profiles`, `rel_prof_cli_empr`.
*   **UX Complexa:**
    *   **Abas:** Uma aba por Cliente que o usuário tem acesso.
    *   **Checkboxes:** Seleção de Raízes CNPJ (`viw_cnpj_raiz`).
    *   **Shuttle:** Seleção fina de Empresas (`dre_empresa`), filtrada pelas raízes marcadas.
*   **Regras:**
    *   Ao criar usuário, se "Confirm Email" estiver ativo no Supabase, o fluxo deve tratar a inserção do `profile` com cuidado (pode falhar se não houver sessão).

### F. Plano Contábil (`PlanoContabilPage.tsx`, `PlanoContabilComparePage.tsx`)
*   **Tabelas:** `dre_plano_contabil`.
*   **Filtros:** Sempre requer seleção de `cnpj_raiz` (vindo da `viw_cnpj_raiz`).
*   **Comparador:** Realiza um `self-join` (lógico no front) de `dre_plano_contabil` para mostrar diferenças entre duas empresas (A vs B).

### G. Cadastros Básicos (Cliente, Grupo, Empresa)
*   **Tabelas:** `dre_cliente`, `dre_grupo_empresa`, `dre_empresa`.
*   **Regras:**
    *   Ao criar uma Empresa, o sistema tenta associá-la automaticamente a visões do tipo "CLIENTE" ou "CNPJ RAIZ" existentes.

---

## 7. Prompt para Atualização deste Documento

Caso realize alterações no código, utilize o prompt abaixo em uma nova sessão de IA para atualizar esta documentação:

> "Analise o arquivo `doc_tec.md` atual e o código fonte fornecido. Identifique alterações na estrutura do banco de dados, novas funcionalidades, mudanças na lógica de autenticação/permissões ou novos webhooks. Atualize o markdown mantendo a estrutura de tópicos (Stack, Arquitetura, Funcionalidades, Banco de Dados, Diretrizes, Páginas), destacando as modificações realizadas e garantindo que as regras de escopo de dados (Contexto de Cliente) estejam refletidas corretamente."
