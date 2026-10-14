# Conta mestre pré-configurada

- **Usuário:** Amanda Marinho
- **Senha:** a senha mestre informada anteriormente ao elaborar este projeto. Não é solicitada sua criação na primeira visita.
- **Não inserir a senha no GitHub:** o arquivo `app.js` contém somente um cofre inicial cifrado e protegido por derivação de chave; a senha não aparece em texto puro.
- Após o primeiro login neste navegador, o cofre recebe um segredo novo exclusivo do aparelho.
- É possível trocar a senha mestre no painel **Usuários → Trocar senha**.
- **Uso apenas demonstrativo/administrativo com dados fictícios.** Nem esse login local nem a senha curta permitem sincronizar dados com segurança no Firestore. As regras continuam `allow read, write: if false;`.
- Se já existir um cofre local de uma versão anterior **no mesmo endereço do navegador**, os dados são preservados, e será necessário usar a senha que protege esse cofre antigo ou restaurar uma cópia. Não apague cadastros sem backup.
