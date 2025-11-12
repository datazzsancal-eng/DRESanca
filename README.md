<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DRE View

## Descrição

O **DRE View** é uma aplicação web desenvolvida para a visualização e gestão de Demonstrativos de Resultados do Exercício (DRE). O sistema permite a consolidação de dados financeiros, oferecendo dashboards interativos, filtros dinâmicos e funcionalidades completas de cadastro (CRUD) para as entidades que compõem a estrutura financeira.

## Funcionalidades Principais

A aplicação está organizada em módulos acessíveis através de uma barra de navegação lateral. As funcionalidades atuais incluem:

### 1. Autenticação
- **Tela de Login:** Uma página de entrada para o sistema. Atualmente, a autenticação é simulada para fins de desenvolvimento, permitindo o acesso direto ao dashboard.

### 2. Dashboard Principal
- **Visão Geral:** Apresenta cartões com indicadores chave (KPIs) como Receita Líquida, Lucro Bruto, EBITDA e Lucro Líquido.
- **Tabela de DRE Consolidada:** Exibe os dados do DRE em formato tabular, com valores mensais, acumulado e percentual sobre a receita.
- **Filtros:** Permite filtrar os dados por período, tipo de visão (mensal, anual) e empresa.
- **Exportação:** Contém botões para exportação dos dados em formatos PDF e CSV (funcionalidade a ser implementada).

### 3. Módulos de Estrutura (CRUD Completo)
Todas as telas de cadastro permitem Adicionar, Editar, Visualizar e Excluir registros, com modais interativos e filtros de busca.

- **Clientes:** Gerenciamento dos clientes da Sancal.
- **Grupos Empresariais:** Gerenciamento dos grupos empresariais vinculados a um cliente.
- **Empresas:** Cadastro detalhado das empresas, incluindo informações de CNPJ, código de integração e vínculo com cliente.
- **Plano Contábil:**
    - Gerenciamento do plano de contas de cada empresa (vinculado pelo CNPJ raiz).
    - **Ferramenta de Comparação:** Uma tela dedicada que permite selecionar duas empresas de um mesmo cliente e visualizar seus planos de contas lado a lado. A ferramenta destaca:
        - Contas faltantes em uma das empresas (fundo da linha em lilás).
        - Divergências nas descrições de contas existentes em ambos os planos (ícone de X vermelho ou check verde).
- **Templates de DRE:**
    - Criação e edição de templates de DRE que definem a estrutura do relatório.
    - Permite adicionar, remover e reordenar linhas via *drag-and-drop*.
    - Suporte a diferentes tipos de linha: Título, Conta Contábil, Fórmula e Valor Constante.
    - Funcionalidade para copiar templates existentes.

### 4. Módulos de Configuração (Tabelas Auxiliares)
Gerenciamento de tabelas de apoio que são utilizadas em outras partes do sistema.

- **Situação:** Cadastro de status (ex: ATIVO, INATIVO) para clientes.
- **Tipo Linha DRE:** Cadastro dos tipos de linha disponíveis nos templates (CONTA, FORMULA, etc.).
- **Estilo Linha DRE:** Cadastro de estilos CSS para formatação das linhas do DRE.
- **Tipo Visão DRE:** Cadastro dos tipos de visão disponíveis no dashboard (MENSAL, ANUAL).

## Tecnologias Utilizadas

- **Frontend:**
  - **React:** Biblioteca principal para a construção da interface de usuário.
  - **TypeScript:** Para tipagem estática e segurança do código.
  - **Tailwind CSS:** Framework CSS para estilização rápida e responsiva.
  - **Font Awesome:** Para os ícones utilizados na interface.

- **Backend & Banco de Dados:**
  - **Supabase:** Utilizado como backend-as-a-service, provendo o banco de dados PostgreSQL e APIs para manipulação dos dados.

## Estrutura do Projeto

O projeto segue uma estrutura organizada por componentes e funcionalidades:

```
/
├── components/
│   ├── cliente/              # Componentes da página de Clientes (CRUD)
│   ├── empresa/              # Componentes da página de Empresas (CRUD)
│   ├── estilo-linha/         # ... e assim por diante para cada módulo
│   ├── grupo-empresarial/
│   ├── plano-contabil/
│   ├── shared/               # Componentes reutilizáveis (ex: Modal)
│   ├── situacao/
│   ├── template/
│   ├── tipo-linha/
│   ├── tipo-visao/
│   ├── DashboardPage.tsx     # Componente principal do dashboard
│   └── LoginPage.tsx         # Componente da página de login
├── lib/
│   └── supabaseClient.ts     # Configuração e inicialização do cliente Supabase
├── App.tsx                   # Componente raiz que gerencia o estado de login
├── index.html                # Ponto de entrada da aplicação
├── index.tsx                 # Script de inicialização do React
├── metadata.json             # Metadados da aplicação
└── README.md                 # Esta documentação
```

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1n-ICTzru9sLpW3T6cjBNwTn6oLtngWgR

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
