# Documentação Técnica Detalhada - DRE View

Este documento fornece uma visão técnica aprofundada da aplicação DRE View, detalhando a arquitetura, gestão de usuários, estruturas de dados e integrações.

## 1. Gestão de Usuários e Permissões

A aplicação utiliza um modelo de permissões granular baseado em "Tenants" (Clientes) e "Sub-tenants" (Empresas).

### 1.1 Tabelas Envolvidas
- **`profiles`**: Extensão da tabela `auth.users` do Supabase. Armazena metadados do usuário como `full_name`, `username`, `function` e `bio`.
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
- **Endpoint:** `GET https://webhook.moondog-ia.tech/webhook/dre`
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
- **Endpoint:** `POST https://webhook.moondog-ia.tech/webhook/csv-upsert`
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

---

## 5. Regras de Negócio Críticas

### 5.1 Processamento de Fórmulas no Template
- As fórmulas nas linhas do template (ex: `L1-L2+L5`) são processadas pelo backend (n8n). 
- O frontend permite a edição dessas fórmulas, garantindo que o usuário utilize o prefixo `L` seguido do número da sequência da linha.
- **Validação:** O sistema valida se as linhas referenciadas na fórmula existem no mesmo template.

### 5.2 Lógica de Consolidação de Visões
- **Visão Cliente:** Sempre incluirá novas empresas adicionadas ao cliente automaticamente.
- **Visão CNPJ Raiz:** Filtra empresas pelo prefixo de 8 dígitos do CNPJ. Se uma nova empresa for cadastrada com o mesmo prefixo, ela é incluída automaticamente na visão.
- **Visão Grupo:** Permite agrupar múltiplos CNPJs Raiz. Útil para holdings com diferentes ramos de atividade.
- **Visão Customizada:** É a única que exige manutenção manual ao adicionar novas empresas, pois a relação é fixa por ID de empresa.

### 5.3 Hierarquia e Estilização do DRE
- O campo `dre_linha_nivel` define a indentação visual na tabela (Padding Left).
- Estilos como "Negrito" e "Itálico" são aplicados via classes CSS dinâmicas baseadas na tabela `tab_estilo_linha`.
- Linhas com `dre_linha_visivel = 'N'` são processadas para fins de cálculo (fórmulas), mas ocultadas na renderização final da tabela para o usuário.

### 5.4 Gestão de Acesso Granular
- Ao atribuir acesso a um cliente para um usuário, o administrador pode escolher "Acesso Total" ou selecionar empresas específicas.
- Se o administrador selecionar todas as empresas individualmente, o sistema converte para "Acesso Total" (`empresa_id IS NULL`) para facilitar a manutenção futura (novas empresas serão herdadas automaticamente).
- O filtro de CNPJ Raiz na tela de usuários é apenas um facilitador de interface; a permissão real é sempre gravada por ID de empresa ou ID de cliente.

