# Prompt de Especificação Técnica: DRE View - Sistema de Consolidação Financeira

Atue como um Engenheiro de Software Sênior especializado em React, TypeScript e Supabase. Sua tarefa é reconstruir uma aplicação web complexa chamada **"DRE View"**.

Esta aplicação é um sistema de **BI Financeiro e Consolidação de DREs (Demonstrativo do Resultado do Exercício)** com foco em multi-tenancy (múltiplos clientes) e controle de acesso granular.

Abaixo estão as especificações detalhadas do projeto.

---

## 1. Stack Tecnológica

*   **Core:** React 18 (Vite), TypeScript.
*   **Estilização:** Tailwind CSS (foco em Dark Mode: `bg-gray-900`, `bg-gray-800`, texto `gray-300/white`).
*   **Backend & Auth:** Supabase (PostgreSQL, Auth, RLS).
*   **Integração de Dados:** Webhook Externo (`https://webhook.moondog-ia.tech/webhook/dre`) para processamento de saldos.
*   **Bibliotecas Auxiliares:**
    *   `jspdf` + `jspdf-autotable` (Exportação PDF).
    *   `xlsx` (Exportação Excel).
    *   `font-awesome` (Ícones via CDN).
    *   Context API (Gerenciamento de Estado).

---

## 2. Arquitetura e Fluxo de Usuário

### A. Autenticação e Contexto
1.  **Login:** Usuário se autentica via Supabase Auth.
2.  **Seleção de Cliente (Contexto):**
    *   Após o login, o sistema verifica na tabela `rel_prof_cli_empr` quais clientes o usuário tem acesso.
    *   Se houver > 1 cliente, exibe uma tela intermediária (`ClientSelectionPage`) para o usuário escolher o contexto de trabalho.
    *   Se houver apenas 1, entra direto.
    *   O "Cliente Selecionado" deve ser persistido em um Contexto Global (`AuthContext`) e usado para filtrar **todas** as queries subsequentes do sistema.
3.  **Sidebar:** Menu lateral retrátil contendo: Dashboard, Análise & Modelos, Estrutura, Configurações e Administração.

### B. Controle de Acesso (Granularidade)
O sistema de permissões é complexo e possui 3 níveis:
1.  **Cliente:** Acesso macro.
2.  **Raiz de CNPJ (Grupo):** Acesso a um grupo de empresas sob a mesma raiz (8 primeiros dígitos do CNPJ).
3.  **Empresa Específica:** Acesso apenas a filiais específicas.

*Regra:* Se na tabela de relacionamento `empresa_id` for NULL, o usuário tem acesso total ao Cliente. Caso contrário, deve-se respeitar a lista de IDs permitidos.

---

## 3. Funcionalidades Principais

### 1. Dashboard (Core)
*   **Cards de KPI:** 4 cartões no topo configuráveis via Template. Devem exibir valores acumulados ou percentuais e variação vs. mês anterior.
*   **Tabela DRE:** Renderização dinâmica baseada em dados retornados pelo Webhook.
    *   Colunas: Descrição, Meses (Jan-Dez) conforme período selecionado, Acumulado, Análise Vertical (%).
    *   Estilização: Linhas devem respeitar configurações de Negrito, Itálico e Indentação (Nível) vindas do banco ou do template.
*   **Filtros:**
    *   **Período:** Dropdown populado via view SQL.
    *   **Visão:** Dropdown de agrupamentos (Consolidado, Por CNPJ, etc.). **Importante:** O dropdown de visões deve filtrar apenas as visões que o usuário tem permissão de ver (baseado nas empresas que compõem a visão).

### 2. Gestão de Visões
CRUD para criar agrupamentos de empresas.
*   Tipos de Visão: Cliente (Todas), Grupo (Por Raiz), Customizado (Seleção manual).
*   **Regra de Unicidade:** O sistema deve impedir a criação de visões duplicadas para o mesmo escopo.
*   **Componente Shuttle:** Usar um componente de "Transfer List" (Shuttle) para selecionar empresas no modo Customizado.

### 3. Motor de Templates (DRE Builder)
Uma interface avançada para desenhar a estrutura do relatório financeiro.
*   **Cabeçalho:** Nome, Cliente associado, Código de Controle.
*   **Linhas (Itens):** Lista ordenável (Drag & Drop).
    *   **Tipos de Linha:**
        *   `CONTA`: Vincula a uma conta contábil (busca no plano de contas).
        *   `FORMULA`: Expressão matemática (ex: `L10 - L20`).
        *   `TITULO/SEPARADOR`: Apenas visual.
        *   `CONSTANTE`: Valor fixo numérico.
        *   `ACUM VLR ANT`: Busca valor de períodos anteriores.
    *   **Estilo:** Associação com tabela de estilos (Cor, Fonte).
    *   **Visibilidade:** Checkbox para ocultar linha na impressão/tela.
    *   **Inversão de Sinal:** Opção para inverter valores (D/C).
*   **Configuração de Cards:** Interface para selecionar qual linha do template alimenta qual Card (1 a 4) do Dashboard.
*   **Visualização:** Botão para pré-visualizar a árvore estrutural (via Webhook ou Fallback local).

### 4. Estrutura Societária (CRUDs)
*   **Clientes:** Cadastro básico.
*   **Empresas:** Cadastro com CNPJ, CNPJ Raiz, Código de Integração. Vínculo obrigatório com Cliente.
*   **Grupos Empresariais:** Agrupadores lógicos.

### 5. Plano Contábil & Comparador
*   **CRUD:** Listagem de contas contábeis (Estrutural, Descrição, Grau).
*   **Comparador (Diff):** Funcionalidade que permite selecionar duas empresas do mesmo cliente e comparar seus planos de contas lado a lado.
    *   Deve destacar contas que existem em A e não em B.
    *   Deve alertar se a mesma conta estrutural tem descrições diferentes.

### 6. Administração de Usuários
*   **Gestão de Perfis:** Criar/Editar usuários (tabela `profiles`).
*   **Matriz de Permissões (UI Complexa):**
    *   Ao editar um usuário, exibir abas por Cliente.
    *   Dentro de cada aba, permitir selecionar CNPJs Raiz (Checkboxes) para filtrar empresas.
    *   Componente Shuttle para selecionar as Empresas finais permitidas.
    *   Salvar na tabela `rel_prof_cli_empr`.

---

## 4. Estrutura de Banco de Dados (Referência Supabase)

Tabelas principais que devem ser consideradas:
*   `profiles`: Dados do usuário.
*   `dre_cliente`, `dre_empresa`, `dre_grupo_empresa`.
*   `dre_plano_contabil`: Plano de contas.
*   `dre_visao`: Cabeçalho das visões.
*   `rel_visao_empresa`: Itens da visão.
*   `dre_template`: Cabeçalho do template.
*   `dre_template_linhas`: Itens do template (estrutura).
*   `dre_template_card`: Configuração dos cards do dashboard.
*   `tab_tipo_linha`, `tab_estilo_linha`, `tab_situacao`: Tabelas de domínio.
*   `rel_prof_cli_empr`: Tabela pivot de permissões.

---

## 5. Diretrizes de Desenvolvimento

1.  **Componentização:** Crie componentes reutilizáveis para Modais (`Modal.tsx`), Listas de Transferência (`Shuttle.tsx`) e Ícones.
2.  **Segurança:** Sempre filtre dados pelo `cliente_id` selecionado no contexto. Nunca exiba dados de outros clientes.
3.  **Performance:** Utilize `useMemo` e `useCallback` para operações pesadas de filtragem e renderização de tabelas.
4.  **UX:** Feedback visual de "Carregando" (Spinners) em todas as requisições assíncronas. Tratamento de erros amigável (Toast ou Alertas).

---

Use este prompt para recriar a aplicação mantendo a fidelidade das regras de negócio e da interface visual escura e corporativa.