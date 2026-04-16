# Documentação Técnica Detalhada - DRE View

Este documento fornece uma visão técnica aprofundada da aplicação DRE View, detalhando a arquitetura, gestão de usuários, estruturas de dados e integrações.

## 1. Gestão de Usuários e Permissões

A aplicação utiliza um modelo de permissões granular baseado em "Tenants" (Clientes) e "Sub-tenants" (Empresas).

### 1.1 Tabelas Envolvidas
- **`profiles`**: Extensão da tabela `auth.users` do Supabase. Armazena metadados do usuário como `full_name`, `username` (sincronizado com o e-mail), `function` e `website`. O campo `bio` foi removido.
- **`rel_prof_cli_empr`**: Tabela central de permissões. Define quais usuários têm acesso a quais clientes e empresas.
    - `profile_id`: ID do usuário.
    - `cliente_id`: ID do cliente (Grupo Econômico).
    - `empresa_id`: ID da empresa específica. Se for `NULL`, indica **acesso total** a todas as empresas do cliente.
    - `rel_situacao_id`: Status da permissão (ex: 'ATV' para Ativo).

### 1.2 Fluxo de Criação e Atribuição
1. **Criação:** Administradores criam novos usuários via interface, que dispara um `signUp` no Supabase Auth.
2. **Configuração Granular:**
    - **Nível Cliente:** Seleção dos grupos econômicos que o usuário pode visualizar.
    - **Nível CNPJ Raiz:** Filtro facilitador na UI para selecionar todas as empresas de uma mesma "raiz" de CNPJ.
    - **Nível Empresa:** Seleção individual de empresas para acesso restrito.
3. **Persistência:** O sistema limpa as relações antigas e insere novas linhas na `rel_prof_cli_empr`. Se o usuário selecionou todas as empresas de um cliente, o sistema otimiza salvando apenas uma linha com `empresa_id = NULL`.

---

## 2. Estrutura de Templates e Visões

O DRE View é altamente configurável através de Templates (Estrutura) e Visões (Filtros de Dados).

### 2.1 Visões (Filtros de Consolidação)
As visões determinam quais empresas compõem os números exibidos no Dashboard.
- **Tabelas:** `dre_visao`, `rel_visao_empresa`, `dre_visao_grupo_cnpj`.
- **Tipos de Visão:**
    - **CLIENTE:** Consolida todas as empresas vinculadas ao cliente.
    - **CNPJ RAIZ:** Consolida empresas que compartilham os primeiros 8 dígitos do CNPJ.
    - **GRUPO:** Permite selecionar múltiplos CNPJs Raiz para consolidar.
    - **CUSTOMIZADO:** Seleção manual e arbitrária de empresas individuais.

### 2.2 Templates (Estrutura do Relatório)
Os templates definem as linhas, cálculos e formatação do DRE.
- **Tabelas:** `dre_template`, `dre_template_linhas`, `dre_template_card`.
- **Atributos da Linha (`dre_template_linhas`):**
    - `dre_linha_seq`: Ordem de exibição.
    - `tipo_linha_id`: Define o comportamento (TITULO, SEPARADOR, CONTA, FORMULA, CONSTANTE, ACUM VLR ANT).
    - `dre_linha_valor`: Dependendo do tipo, armazena o código da conta contábil, a fórmula (ex: `L1-L2`) ou um valor fixo.
    - `visao_id`: Permite que uma linha seja **exclusiva** de uma visão específica.
    - `perc_ref`: Código de referência para cálculos de análise vertical (%).
    - `estilo_linha_id`: Vincula a estilos CSS pré-definidos (Negrito, Itálico, Cores).

---

## 3. API e Integrações (Webhooks)

A aplicação se integra com um backend de processamento (n8n) via webhooks.

### 3.1 Consulta de Dados DRE (Dashboard)
- **Endpoint:** `GET https://webhook.synapiens.com.br/webhook/dre_busca`
- **Query Params:**
    - `carga`: Período de referência (ex: `202401`).
    - `id`: ID da Visão (`dre_visao.id`).
- **Retorno Esperado:** Array de objetos representando as linhas processadas.
    ```json
    [
      {
        "dre_linha_seq": 1,
        "dre_linha_descri": "RECEITA BRUTA",
        "vlr_mes": 150000.00,
        "vlr_mes_ant": 140000.00,
        "perc_vlr": 7.14,
        "vlr_acum_ano": 150000.00,
        "vlr_acum_ano_ant": 140000.00
      }
    ]
    ```

### 3.2 Carga de Dados CSV
- **Endpoint:** `POST https://webhook.synapiens.com.br/webhook/csv-upsert`
- **Payload:**
    ```json
    {
      "file_path": "caminho/no/storage.csv",
      "bucket": "conta_upload",
      "table": "dre_plano_contabil",
      "on_conflict": "id"
    }
    ```
- **Fluxo:** O frontend faz o upload para o Supabase Storage e envia o caminho para este webhook iniciar o processamento assíncrono.

### 3.3 Preview de Template
- **Endpoint:** `GET https://webhook.moondog-ia.tech/webhook/temp_dre`
- **Query Params:** `cntr` (Código de controle do template).
- **Uso:** Utilizado na tela de edição de templates para visualizar como a estrutura será processada antes de aplicá-la oficialmente.

### 3.4 Carga do Movimento (Fluxo Carga + Cálculo)
- **Carga do Movimento:** Interface para upload de arquivos de movimentação contábil por empresa e período.
- **Processamento em Duas Etapas:** Fluxo sequencial que realiza a carga dos dados (`movto_upsert`) e, em seguida, dispara o cálculo do DRE (`calc_dre`).
- **Estabilidade de Interface:** Implementada proteção contra recarregamentos acidentais ao alternar abas do navegador, preservando a seleção de arquivos e o estado do processamento.
- **Payload (Carga):**
    ```json
    {
      "file_path": "caminho/do/arquivo/no/storage.csv",
      "bucket": "movto_upload",
      "table": "dre_carga_contabil",
      "on_conflict": "id",
      "cliente_id": "ID_DO_CLIENTE",
      "emp_cod_integra": "CODIGO_INTEGRACAO",
      "cnpj_emp": "CNPJ_COMPLETO",
      "crg_emp_periodo_ano": 2026,
      "crg_emp_periodo_mes": 4
    }
    ```
- **Payload (Cálculo):**
    ```json
    {
      "file_path": "caminho/do/arquivo/no/storage.csv",
      "bucket": "movto_upload",
      "table": "dre_calc_contabil",
      "on_conflict": "id",
      "cliente_id": "ID_DO_CLIENTE",
      "emp_cod_integra": "CODIGO_INTEGRACAO",
      "cnpj_emp": "CNPJ_COMPLETO",
      "crg_emp_periodo_ano": 2026,
      "crg_emp_periodo_mes": 4,
      "user_id": "email@usuario.com",
      "empresa_id": "ID_DA_EMPRESA"
    }
    ```
- **Fluxo Serializado:** O frontend executa o processamento em duas etapas sequenciais para cada empresa:
    1.  **Etapa de Carga:** Upload do arquivo para o bucket `movto_upload` e disparo do webhook `movto_upsert`.
    2.  **Etapa de Cálculo:** Após o sucesso da carga, dispara o webhook `calc_dre` para processar os resultados contábeis.
- **Feedback Visual:** A interface exibe o progresso individual de cada etapa (Carga e Cálculo) com ícones de status, barras de progresso e mensagens de erro específicas. O status geral da empresa é indicado por um check verde (sucesso total) ou alerta vermelho (falha em qualquer etapa).

---

## 4. Lógica de Cálculos e Indicadores

### 4.1 Cálculo do Delta (Variação Mensal)
Nos cards de resumo do Dashboard, a variação percentual (Delta) é calculada comparando o desempenho do mês atual com o mês imediatamente anterior dentro do período selecionado.

**Fórmula:**
$$Delta = \frac{(V_{atual} - V_{anterior})}{|V_{anterior}|} \times 100$$

**Regras de Negócio:**
- **V_atual:** Valor da conta no mês selecionado (ex: se o período é 202405, usa-se o valor de Maio).
- **V_anterior:** Valor da conta no mês anterior (ex: Abril).
- **Tratamento de Zero:**
    - Se $V_{anterior} = 0$ e $V_{atual} \neq 0$, o Delta é considerado **100%**.
    - Se ambos forem zero, o Delta é **0%**.
- **Sinalização:** O uso do valor absoluto ($|V_{anterior}|$) no denominador garante que o sentido da variação (positivo ou negativo) seja preservado corretamente, mesmo em contas que operam com valores negativos (como deduções ou despesas).

---

## 6. Fluxo Esperado da Aplicação

O fluxo de trabalho típico de um usuário no DRE View segue esta sequência:

1.  **Autenticação:** O usuário faz login com e-mail e senha.
2.  **Seleção de Cliente:** Se o usuário tiver acesso a mais de um cliente (Grupo Econômico), ele deve selecionar qual deseja gerenciar.
3.  **Dashboard Inicial:** O sistema carrega o DRE consolidado baseado na visão padrão do cliente.
4.  **Configuração (Admin):**
    -   Define a estrutura do relatório em **Templates**.
    -   Cria **Visões** para agrupar empresas (Holding, Filiais, etc).
5.  **Operação:**
    -   Realiza a **Carga** de arquivos CSV/XLSX com a movimentação contábil.
    -   O sistema processa os dados via webhook.
6.  **Análise:** O usuário consulta o Dashboard, filtra por períodos e visões, e exporta os relatórios.

---

## 10. Otimização de Performance e Estabilidade

### 10.1 Persistência de Sessão e Prevenção de Refresh
Para evitar que a aplicação recarregue ou resete o estado ao alternar entre abas do navegador ou aplicativos externos (como Excel), a aplicação implementa uma lógica de proteção em múltiplos níveis:
- **AuthContext:** Utiliza `lastLoadedUserId` (Ref) e `profileRef` (Ref) para rastrear o ID do último usuário e o perfil, ignorando eventos de revalidação de token que não alteram a identidade do usuário.
- **Carga do Movimento & Carga de Plano:** Utilizam `lastLoadedClientId` (Ref) para garantir que a lista de empresas e arquivos selecionados não sejam limpos ao retornar para a aba, a menos que o cliente selecionado mude efetivamente.
- **Estabilidade de Dependências:** Hooks de busca de dados utilizam propriedades primitivas (`user?.id`, `selectedClient?.id`) em vez de objetos complexos nos arrays de dependência, prevenindo disparos de `useEffect` causados por novas instâncias de objetos com os mesmos dados.

Atualmente, a aplicação adota um modelo de **Hierarquia Funcional** baseada em permissões de dados, em vez de papéis (roles) fixos de sistema.

### 9.1 Tipos de Usuários (Hierarquia de Função)
Os usuários são tipificados através do campo `function` na tabela `profiles`, seguindo uma hierarquia definida:

1.  **MASTER:** Acesso irrestrito e controle total da plataforma. Pode atribuir qualquer função a outros usuários.
2.  **GESTOR CLIENTE:** Gerencia todos os aspectos de um ou mais clientes específicos. Pode atribuir funções até o nível de GESTOR CLIENTE. Tem acesso automático a todas as empresas dos clientes que gerencia.
3.  **ADMIN:** Administrador com permissões de configuração e gestão de usuários. Ao criar um cliente, este é automaticamente associado ao seu acesso, garantindo controle total sobre as empresas desse cliente.
4.  **GESTOR CONTA:** Responsável pela gestão financeira e estrutural das contas. Não tem acesso ao CRUD de Cliente, Configurações ou Administração de Usuários.
5.  **COLABORADOR:** Usuário operacional. Não tem acesso ao CRUD de Cliente, Empresa, Análise & Modelos, Configurações ou Administração de Usuários. Pode realizar cargas de plano contábil e visualizar o plano.
6.  **LEITOR:** Acesso exclusivo para consulta de dashboards e exportação de relatórios. O menu lateral é dinamicamente filtrado para exibir apenas o Dashboard.

### 9.2 Gestão de Senhas e Segurança
- **E-mail como Login:** O campo de login é ocultado e sincronizado com o e-mail do usuário.
- **Validação de Senha:** O formulário exige que a senha e a confirmação sejam idênticas.
- **Troca de Senha pelo Usuário:** No cabeçalho da aplicação, ao clicar no nome do usuário, é possível acessar a opção "Troca de senha". O sistema exige a senha atual para validar a operação, além da nova senha e sua confirmação.
- **Redefinição por Administrador:** Administradores podem redefinir senhas de outros usuários através da tela de Gestão de Usuários. Para usuários existentes, a alteração de senha exige a validação da "Senha Atual" via re-autenticação no Supabase Auth.
- **Visibilidade:** Implementado toggle (ícone de olho) para alternar visibilidade dos campos de senha.

### 9.3 Campos de Restrição (MASTER/GESTOR CLIENTE)
- **`cli_restrito_sn` (dre_cliente):** Indica se um cliente é restrito. Visível apenas para MASTER e GESTOR CLIENTE.
- **`emp_restrito_sn` (dre_empresa):** Indica se uma empresa é restrita. Visível apenas para MASTER e GESTOR CLIENTE.

### 9.4 Segurança de Interface vs. Banco
- **Interface:** Os menus são filtrados dinamicamente com base na função do usuário. Usuários com função `LEITOR` são redirecionados para o Dashboard se tentarem acessar URLs restritas.
- **Banco de Dados (RLS):** A segurança real reside no PostgreSQL. Se um usuário sem permissão tentar acessar a lista de usuários ou editar um template de outro cliente, o Supabase retornará erro de permissão negada, garantindo a integridade do sistema.

