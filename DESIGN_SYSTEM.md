# Design System - DRE View

Este documento descreve os padrões visuais, componentes e diretrizes de design utilizados na aplicação DRE View.

## 1. Visão Geral
A aplicação utiliza um tema escuro (Dark Mode) focado em legibilidade de dados financeiros, utilizando o framework **Tailwind CSS** para estilização.

## 2. Cores

### Cores de Fundo (Background)
- **Principal:** `bg-gray-900` (#111827) - Utilizado no fundo principal da aplicação.
- **Cards e Sidebar:** `bg-gray-800` (#1f2937) - Utilizado em containers, cards e na barra lateral.
- **Hover/Destaque:** `bg-gray-700` (#374151) - Utilizado em estados de hover e cabeçalhos de tabelas.

### Cores de Marca (Primary)
- **Indigo 600:** `bg-indigo-600` (#4f46e5) - Utilizado em botões principais, ícones de destaque e elementos de marca.
- **Indigo 500:** `border-indigo-500` - Utilizado em bordas de foco e estados ativos.

### Cores de Status
- **Sucesso:** `text-green-500` / `bg-green-900/40` - Utilizado para variações positivas e mensagens de sucesso.
- **Erro:** `text-red-500` / `bg-red-900/40` - Utilizado para variações negativas, valores negativos em tabelas e mensagens de erro.
- **Aviso:** `text-yellow-400` / `bg-yellow-900/50` - Utilizado para alertas e avisos de sistema.

## 3. Tipografia
- **Fonte Principal:** Inter (Sans-serif).
- **Tamanhos:**
    - `text-xs`: 12px (Legendas, labels de tabelas).
    - `text-sm`: 14px (Texto padrão, itens de menu).
    - `text-base`: 16px (Texto de leitura).
    - `text-lg`: 18px (Subtítulos).
    - `text-xl`: 20px (Títulos de página).
    - `text-2xl`: 24px (Valores de destaque em cards).

## 4. Componentes Principais

### Sidebar (Navegação)
- Localizada à esquerda.
- Suporta estados recolhido (ícones) e expandido (texto + ícones).
- Navegação hierárquica com submenus.
- Exibe o cliente selecionado e permite a troca rápida.
- **Visibilidade Dinâmica:** Itens de menu são filtrados com base na função (`function`) do usuário. Ex: Usuários `LEITOR` visualizam apenas o Dashboard.

### StatCards (Cards de Resumo)
- Exibem métricas chave no topo do Dashboard.
- Estrutura: Título, Valor Principal, Subtítulo (comparativo) e Variação Percentual (colorida por status).

### DreTable (Tabela Financeira)
- Tabela complexa com rolagem horizontal e vertical.
- **Coluna de Descrição Fixa:** Permanece visível ao rolar horizontalmente.
- **Hierarquia:** Suporta níveis de indentação e estilos (Negrito/Itálico) baseados no plano de contas.
- **Valores Negativos:** Destacados em vermelho automaticamente.

### Modais e Formulários
- **Layout de Usuário:** Campos organizados em grid responsivo. Ordem: E-mail, Função, Nome Completo, Senhas.
- **Campos de Senha:** Incluem ícone de alternância de visibilidade (Eye/EyeOff).
- **Feedback Visual:** Utiliza `framer-motion` para animações de entrada de mensagens de erro/sucesso e transições de visibilidade de campos.

### Skeletons (Carregamento)
- Componentes de placeholder que imitam a estrutura da tabela e dos cards durante o carregamento de dados.

## 5. Ícones e Animações
- **Ícones:** Utiliza a biblioteca **Lucide React**.
- **Animações:** Utiliza **Framer Motion** (`motion/react`) para micro-interações, feedbacks de formulário e transições de estado.
- Ícones específicos de marca ou formatos (XLSX, CSV) são implementados como componentes SVG customizados.

## 6. Layout
- **Header:** Fixo no topo, exibe o título da página atual, informações do usuário logado e botão de logout.
- **Main Content:** Área de rolagem independente que contém o conteúdo principal da tela selecionada.
- **Responsividade:** Sidebar se transforma em um menu overlay em dispositivos móveis.
