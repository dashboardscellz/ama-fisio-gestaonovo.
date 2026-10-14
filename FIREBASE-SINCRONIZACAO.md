# AMA FISIO — Salvamento automático no Firebase (v4)

O login continua **dentro do site** (usuário e senha). Tudo que for salvo vai **automaticamente** para o Firebase, sem aprovação de ninguém, e aparece em qualquer aparelho. Funcionários só precisam de usuário e senha criados pela Amanda em **Usuários → Novo usuário**.

## Configuração (uma vez só, no console do Firebase — projeto `ama-fisio-novo-sistema`)
1. Firestore Database → **Create database** (se ainda não existir).
2. Firestore → **Rules** → cole o conteúdo do arquivo `firestore.rules` → **Publish**.
3. Baixe um backup no site atual (Configurações → Baixar backup criptografado).
4. Envie os arquivos para a raiz do repositório no GitHub e aguarde publicar.
5. **No primeiro acesso, entre no MESMO navegador onde estão os pacientes hoje.** Os dados são enviados para a nuvem sozinhos. Depois, entre de qualquer aparelho.

## Como funciona
- Os dados são criptografados no navegador antes de ir ao Firebase: sem usuário e senha do site, o conteúdo é ilegível.
- Outros aparelhos recebem as alterações em cerca de 45 s (ou Configurações → Sincronizar agora).
- Se dois aparelhos salvarem ao mesmo tempo, o segundo recebe um aviso e salva de novo.
- O Firebase guarda as últimas 20 versões (coleção `clinica_hist`, visível no console) para recuperação.
- Precisa de internet para salvar.

## Atenção honesta sobre segurança
Como não há login do Firebase, as regras permitem que o site leia/grave o documento criptografado. Quem conhecer a configuração pública do site poderia baixar o arquivo criptografado (não consegue ler sem a senha, mas senhas fracas podem ser adivinhadas) ou tentar sobrescrever (as regras impedem apagar e as 20 versões anteriores permitem recuperar). **Use senhas longas e fortes.** Para dados reais de pacientes, o ideal é um dia migrar para login do Firebase.
