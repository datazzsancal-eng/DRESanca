# Documentação Técnica - DRE View

Este documento fornece uma visão técnica detalhada da aplicação DRE View para desenvolvedores e equipe de manutenção.

## 1. Arquitetura do Sistema
A aplicação é uma Single Page Application (SPA) construída com **React 18**, **Vite** e **TypeScript**. O backend é gerenciado pelo **Supabase**, que fornece autenticação, banco de dados PostgreSQL e armazenamento de arquivos (Storage).

## 2. Tecnologias e Dependências Principais
- **React 18:** Biblioteca de UI.
- **TypeScript:** Tipagem estática para maior segurança e manutenção.
- **Tailwind CSS:** Framework de estilização utilitária.
- **@supabase/supabase-js:** SDK para interação com o backend.
- **xlsx:** Manipulação de arquivos Excel e CSV (importação/exportação).
- **jspdf / jspdf-autotable:** Geração de relatórios em PDF (preparado para uso).
- **Lucide React:** Biblioteca de ícones.

## 3. Estrutura de Pastas
- `/components`: Componentes React organizados por domínio (cliente, empresa, plano-contabil, etc.).
- `/contexts`: Contextos globais (Autenticação e Seleção de Cliente).
- `/lib`: Configurações de bibliotecas externas (Supabase Client).
- `/referencias`: Documentos e especificações de referência do projeto.

## 4. Fluxo de Autenticação e Multi-Tenancy
- **Login:** Realizado via Supabase Auth.
- **AuthContext:** Gerencia a sessão do usuário, perfil e a lista de clientes aos quais o usuário tem acesso.
- **Seleção de Cliente:** Após o login, o usuário deve selecionar um cliente. O `cliente_id` é armazenado no `localStorage` e utilizado como filtro global em todas as consultas ao banco de dados e chamadas de API.

## 5. Telas e Regras de Negócio

### 5.1 Dashboard (DRE)
- **Objetivo:** Visualização consolidada do Demonstrativo de Resultados do Exercício.
- **API:** Consome dados de um webhook externo: `https://webhook.moondog-ia.tech/webhook/dre`.
- **Parâmetros:** `carga` (período selecionado) e `id` (ID da visão selecionada).
- **Lógica:**
    - Busca as configurações de templates (cards e estilos de linha) no Supabase.
    - Processa os dados brutos do webhook para aplicar estilos (negrito, itálico, indentação) e visibilidade.
    - Calcula variações mensais para os cards de resumo.
- **Exportação:** Permite exportar a visão atual para XLSX e CSV.

### 5.2 Carga de Plano Contábil
- **Objetivo:** Upload de arquivos de movimentação contábil para processamento.
- **Storage:** Salva arquivos no bucket `conta_upload` do Supabase.
- **Caminho do Arquivo:** `[cliente_id]/[cnpj_raiz]/[timestamp]_[nome_arquivo]`.
- **Webhook de Processamento:** Após o upload, dispara um POST para `https://webhook.moondog-ia.tech/webhook/csv-upsert`.
- **Payload do Webhook:**
    ```json
    {
      "file_path": "caminho/do/arquivo.csv",
      "bucket": "conta_upload",
      "table": "dre_plano_contabil",
      "on_conflict": "id"
    }
    ```

### 5.3 Gestão de Visões e Templates
- Permite configurar como o DRE será exibido, quais linhas são visíveis, quais cards aparecem no topo e quais estilos de formatação cada linha deve ter.

## 6. Banco de Dados (Principais Tabelas)

| Tabela | Descrição |
| :--- | :--- |
| `profiles` | Perfis de usuários (estendido do auth.users). |
| `dre_cliente` | Cadastro de clientes (tenants). |
| `dre_empresa` | Empresas vinculadas aos clientes. |
| `rel_prof_cli_empr` | Tabela de permissões (quem acessa qual cliente/empresa). |
| `dre_visao` | Definições de visões do DRE. |
| `dre_template` | Templates de estrutura de DRE. |
| `dre_template_linhas` | Configuração de linhas por template. |
| `dre_template_card` | Configuração de cards por template. |
| `tab_estilo_linha` | Catálogo de estilos visuais para as linhas do DRE. |
| `viw_periodo_calc` | View que retorna os períodos disponíveis para consulta. |

## 7. Endpoints e Webhooks Externos

### Webhook DRE (GET)
- **URL:** `https://webhook.moondog-ia.tech/webhook/dre`
- **Uso:** Carregamento dos dados financeiros do Dashboard.

### Webhook Carga CSV (POST)
- **URL:** `https://webhook.moondog-ia.tech/webhook/csv-upsert`
- **Uso:** Disparo do processamento de arquivos após upload no Storage.

## 8. Manutenção e Boas Práticas
- **Filtros Globais:** Sempre utilize o `selectedClient.id` do `AuthContext` em novas queries para garantir o isolamento de dados entre clientes.
- **Tipagem:** Mantenha as interfaces de dados atualizadas em `DashboardPage.tsx` ou mova-as para um arquivo de tipos global se o projeto crescer.
- **Tratamento de Erros:** Utilize o componente `handleFirestoreError` (se implementado) ou blocos try/catch com feedback visual para o usuário.
