# Development Memory - DRE View

Este documento registra o histórico de decisões técnicas, mudanças significativas e marcos do desenvolvimento do projeto DRE View.

## Sessão: Refinamento de Gestão de Usuários e Controle de Acesso (Abril 2024)

### Objetivo
Aprimorar a interface de gestão de usuários, implementar regras de acesso dinâmicas para diferentes funções e corrigir falhas de comunicação com o servidor de DRE.

### Mudanças Implementadas

#### 1. Gestão de Usuários (UsuarioPage.tsx)
- **Unificação de Login/E-mail:** O campo "Usuário (Login)" foi ocultado. O sistema agora sincroniza automaticamente o `username` com o `email`.
- **E-mail Read-only:** Em modo de edição, o e-mail não pode ser alterado para garantir a integridade da conta no Supabase Auth.
- **Reordenamento de Campos:** Formulário reorganizado para seguir a ordem: E-mail, Função, Nome Completo, Senhas.
- **Gestão de Senhas:**
    - Implementado toggle de visibilidade (Eye/EyeOff) para todos os campos de senha.
    - Adicionada validação de coincidência entre "Senha" e "Confirmação".
    - Para edições, agora é obrigatório fornecer a "Senha Atual" para validar qualquer alteração de senha, realizando uma re-autenticação em tempo real.
- **Remoção do campo Bio:** O campo `bio` foi removido do perfil do usuário por não ser necessário.
- **Restrição de Atribuição de Funções:** Usuários `GESTOR CLIENTE` agora só podem atribuir funções até o seu próprio nível hierárquico.

#### 2. Controle de Acesso e Menu Dinâmico
- **Menu Filtrado:** O Sidebar agora filtra os itens de navegação com base na função do usuário. Usuários `LEITOR` têm acesso apenas ao Dashboard.
- **Redirecionamento de Segurança:** Implementada lógica no `DashboardPage.tsx` para redirecionar usuários `LEITOR` que tentarem acessar rotas administrativas manualmente.
- **Acesso Automático ADMIN:** Usuários com função `ADMIN` agora recebem acesso automático a todas as empresas dos clientes que eles mesmos criarem.

#### 3. Melhorias em Clientes e Empresas
- **Campos de Restrição:** Adicionados `cli_restrito_sn` (Clientes) e `emp_restrito_sn` (Empresas). Estes campos são visíveis e editáveis apenas por usuários `MASTER` e `GESTOR CLIENTE`.
- **Auto-associação:** Ao criar um novo cliente, o usuário criador é automaticamente associado a ele na tabela `rel_prof_cli_empr`.

#### 4. Integrações e Infraestrutura
- **Atualização de Webhook:** O endpoint do DRE foi alterado para `https://webhook.synapiens.com.br/webhook/dre_busca` para resolver erros de comunicação.
- **Versão da App:** A versão da aplicação (vinda do `app_metadata.json`) agora é exibida na tela de login.

### Dependências Adicionadas
- `lucide-react`: Para ícones de visibilidade de senha.
- `motion/react` (Framer Motion): Para animações de feedback e transições de interface.

### Decisões Técnicas
- **Uso de Cliente Temporário no Supabase:** Para criar usuários sem deslogar o administrador atual, foi utilizado um cliente Supabase secundário com `persistSession: false`.
- **Validação de Senha Atual:** Optou-se por realizar um `signInWithPassword` temporário para validar a senha atual antes de permitir o `updateUser`, garantindo que apenas o dono da conta (ou alguém com a senha) possa alterá-la.

## Sessão: Módulo de Movimentações e Carga Mensal (Abril 2024)

### Objetivo
Implementar a funcionalidade de carga de movimentos mensais por empresa, permitindo o processamento de dados transacionais para o DRE.

### Mudanças Implementadas
- **Novo Menu "Movimentações":** Adicionado à Sidebar com a sub-página "Carga do Movimento".
- **Página de Carga (CargaMovimentoPage.tsx):**
    - Seleção de Empresa: Combo populado com empresas permitidas para o usuário no cliente selecionado.
    - Seleção de Período: Combos de Mês (1-12) e Ano (Corrente/Anterior), com valores padrão baseados na data atual.
    - Área de Upload: Componente com suporte a Drag & Drop e seleção de arquivo, visualmente consistente com a carga de plano.
- **Integração de Backend:**
    - Bucket Storage: Utilizado o bucket `movimento_upload`.
    - Webhook: Disparo para `https://webhook.synapiens.com.br/webhook/movimento-upsert` com metadados do período e empresa.
- **Navegação:** Atualizado o `DashboardPage.tsx` para incluir a nova rota e item de menu.

## Sessão: Refinamento de RBAC por Função (Abril 2024)

### Objetivo
Ajustar as permissões de acesso aos menus para as funções `GESTOR CONTA` e `COLABORADOR`, restringindo o acesso a cadastros estruturais e configurações.

### Mudanças Implementadas
- **Refinamento de Menus (DashboardPage.tsx):**
    - **GESTOR CONTA:** Removido acesso ao CRUD de Cliente e ao menu de Configurações.
    - **COLABORADOR:** Removido acesso ao CRUD de Cliente, CRUD de Empresa, menu de Análise & Modelos (Visões/Templates) e menu de Configurações.
- **Lógica de Filtragem Recursiva:** O componente `Sidebar` agora utiliza uma função recursiva para filtrar itens de menu e seus submenus, garantindo que categorias vazias (sem filhos permitidos) não sejam exibidas.

## Sessão: Ajuste de UI da Sidebar (Abril 2024)

### Objetivo
Melhorar a experiência de usuário na barra lateral, substituindo o botão de recolher do rodapé por um botão flutuante na borda.

### Mudanças Implementadas
- **Novo Botão de Toggle:** Adicionado um botão circular flutuante na borda direita da Sidebar (`-right-3 top-20`).
- **Remoção do Rodapé:** A opção "Recolher" foi removida do rodapé da Sidebar para limpar a interface.
- **Preservação de Estilo:** Cores e ícones originais foram mantidos para consistência visual.
- **Identidade Visual no Rodapé:** Adicionada a logo da Synapiens e a identificação da versão da aplicação no rodapé da Sidebar, substituindo o antigo botão de recolher.

## Sessão: Menu de Usuário e Troca de Senha (Abril 2024)

### Objetivo
Implementar um menu dropdown no header ao clicar no nome do usuário, oferecendo opções de troca de senha e logout.

### Mudanças Implementadas
- **Menu Dropdown no Header:** O nome do usuário agora é um gatilho para um menu "drill down" contendo as opções "Troca de senha" e "Sair".
- **Modal de Troca de Senha:** Implementado um modal que solicita a senha atual, nova senha e confirmação. A senha atual é validada via re-autenticação no Supabase antes da atualização.
- **Logout Integrado:** A opção de logout foi movida para dentro do menu do usuário, mantendo a funcionalidade de encerramento de sessão.
- **Melhoria de UX:** Adicionado fechamento automático do menu ao clicar fora dele e animações de entrada para o dropdown e modal.

## Sessão: Carga do Movimento Serializada e Melhorias de UX (Abril 2024)

### Objetivo
Refatorar a tela de Carga do Movimento para suportar processamento serializado linha a linha, melhorando a visualização dos dados da empresa e a integração com o novo endpoint de webhook.

### Mudanças Implementadas
- **Tela de Carga do Movimento (CargaMovimentoPage.tsx):**
    - **Visualização de Empresas:** Agora exibe `emp_cod_integra` (Integra), `emp_nome_reduz` (Reduzido), `emp_nome_cmpl` (Complemento, se diferente do reduzido) e `emp_cnpj` (CNPJ).
    - **Filtro de Busca:** Adicionado um campo de busca para filtrar empresas por código de integração, nome reduzido, complemento ou CNPJ.
    - **Limpeza de Arquivo:** Adicionado um botão (ícone X) ao lado do seletor de arquivo de cada linha para remover o arquivo selecionado.
    - **Processamento Serializado:** Ao clicar em "Processar Carga", o sistema itera sobre cada empresa com arquivo selecionado, fazendo o upload e chamando o webhook de forma sequencial.
    - **Feedback de Status:** Atualização em tempo real do status de cada linha (`uploading` -> `upload_success` -> `processing` -> `success` / `error`).
- **Integração de Webhook:**
    - **Novo Endpoint:** Atualizado para `https://webhook.synapiens.com.br/webhook/movto_upsert`.
    - **Novo Payload:** Inclui `file_path`, `bucket` (`movto_upload`), `table`, `on_conflict`, `cliente_id`, `emp_cod_integra`, `cnpj_emp`, `crg_emp_periodo_ano` e `crg_emp_periodo_mes`.
    - **Tratamento de Erros:** Melhorado o tratamento de erros do `fetch` para identificar claramente problemas de CORS ou indisponibilidade do servidor.
- **Carga de Plano Contábil:**
    - Atualizado o endpoint de fallback para `https://webhook.synapiens.com.br/webhook/csv-upsert`.
    - Adicionados `cliente_id`, `emp_nome_reduzido` e `cnpj_raiz` ao payload.

## Sessão: Otimização de Sessão e Fluxo de Carga DRE (Abril 2024)

### Objetivo
Resolver o problema de refresh inesperado ao alternar abas do navegador e implementar o fluxo sequencial de carga e cálculo para movimentações contábeis.

### Mudanças Implementadas

#### 1. Estabilização do AuthContext
- **Prevenção de Refresh:** Implementada lógica para evitar que a aplicação recarregue dados redundantes ao recuperar o foco da aba.
- **Uso de Refs para Estado:** Introduzidos `lastLoadedUserId` e `profileRef` para garantir que o listener de autenticação do Supabase tenha acesso a dados síncronos, evitando disparos falsos de carregamento devido a "closures" obsoletas.
- **Logs de Diagnóstico:** Adicionados logs prefixados com `[AuthContext]` para monitorar o ciclo de vida da sessão e carregamento de dados.

#### 2. Fluxo de Carga do Movimento (CargaMovimentoPage.tsx)
- **Processamento Sequencial:** Refatorada a lógica de processamento para executar dois webhooks em sequência:
    1. `movto_upsert` (Carga de dados brutos).
    2. `calc_dre` (Processamento de cálculos contábeis).
- **Status Granular:** A interface agora separa visualmente as etapas de "Carga" e "Cálculo", com ícones, textos e barras de progresso independentes.
- **Tratamento de Erros:** Implementada captura de erros específica para cada etapa, permitindo identificar se a falha ocorreu na carga ou no cálculo.
- **Endpoints de Produção:** Atualizado o webhook de cálculo para `https://webhook.synapiens.com.br/webhook/calc_dre`.

### Decisões Técnicas
- **Serialização de Processos:** Optou-se por não disparar o cálculo se a carga falhar, garantindo a integridade dos dados processados.
- **Controle de UI:** Uso de estados de status independentes (`cargaStatus`, `calcStatus`) para fornecer feedback preciso sobre o estágio atual de cada empresa no lote de processamento.

## Sessão: Refinamento de Estabilidade e Documentação de Cálculos (Abril 2024)

### Objetivo
Garantir a estabilidade total da interface ao alternar abas e documentar as fórmulas de cálculo utilizadas no Dashboard.

### Mudanças Implementadas

#### 1. Estabilização de Dependências (useEffect/useCallback)
- **Hooks de Busca:** Refatorados os arrays de dependência em `CargaMovimentoPage`, `CargaPlanoPage`, `VisaoPage`, `EmpresaPage` e `PlanoContabilPage`.
- **Uso de IDs Primitivos:** Substituídos objetos complexos (`user`, `selectedClient`) por suas propriedades estáveis (`user?.id`, `selectedClient?.id`) nos arrays de dependência, evitando re-execuções desnecessárias causadas por novas instâncias de objetos com os mesmos dados.
- **lastLoadedClientId (Ref):** Implementada proteção adicional em telas de carga para evitar o reset do estado (lista de empresas e arquivos selecionados) quando o usuário retorna à aba do navegador.

#### 2. Documentação Técnica
- **Cálculo do Delta:** Adicionada seção detalhando a fórmula de variação percentual mensal utilizada nos cards do Dashboard, incluindo o tratamento de valores nulos e o uso de valor absoluto para contas negativas.
- **Nomenclatura:** Unificada a nomenclatura de "Carga do Movimento" em toda a documentação e interface.

### Decisões Técnicas
- **Imutabilidade Referencial:** Priorizou-se a estabilidade da UI em detrimento de buscas agressivas, garantindo que o usuário não perca dados de formulários (como arquivos selecionados) durante o uso multitarefa.
