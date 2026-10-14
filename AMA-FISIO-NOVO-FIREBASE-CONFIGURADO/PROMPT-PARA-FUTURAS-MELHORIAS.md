# PROMPT DE DESENVOLVIMENTO — AMA FISIO

Aprimore o sistema AMA FISIO existente, preservando a identidade visual original (logo do ursinho e pulmões, verde oliva, fundo claro, detalhes rosados), com acessibilidade e layout responsivo para desktop, tablet e celular. Priorize gestão de clientes e uma agenda secundária com avisos no sino do próprio site, configuráveis para no dia, um ou dois dias antes. Não implementar WhatsApp, e-mail ou push fora do site. A administradora Amanda Marinho deve gerenciar usuários dentro da interface e ter permissões exclusivas de administração. Manter campos de cadastro, pesquisa, edição, horário, lembretes, backup e restauração.

**Regra de segurança obrigatória:** a interface pode pedir somente nome de usuário e senha, sem exibir campo de e-mail. Entretanto, não armazenar uma senha mestre literal no JavaScript público e NÃO abrir a leitura/escrita do Firestore para visitantes anônimos. Qualquer integração real com dados pessoais ou dados de saúde precisa de autorização comprovável no backend/Firebase, regras testadas, proteção contra acesso indevido, política de retenção, rotinas de backup e conformidade com a LGPD. Se o requisito "nenhum mecanismo de autenticação no servidor" for mantido, operar somente no modo local protegido e explicar que não haverá sincronização segura em nuvem.

**Não inventar informações recebidas em áudio:** confirmar todos os campos específicos da avaliação clínica quando houver transcrição disponível. Para ambiente demonstrativo, usar apenas registros fictícios.

Criar código modular, testes funcionais, arquivo README, instruções do Firebase e GitHub Pages, sem exigir terminal no computador do usuário. Não recriar múltiplas pastas ou URLs em cada versão; sempre alterar os mesmos arquivos na raiz do repositório.
