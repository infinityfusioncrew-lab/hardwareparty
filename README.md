# HARDWARE Site

Projeto reorganizado para separar layout, logica e conteudo editavel.

## Estrutura

- `index.html`: pagina publica do evento.
- `admin.html`: painel admin sem codigo para editar conteudo com preview integrado.
- `assets/css/main.css`: estilos do site.
- `assets/css/admin.css`: estilos do painel admin.
- `assets/js/main.js`: logica principal do site.
- `assets/js/site-config.js`: schema de campos editaveis e credenciais padrao.
- `assets/js/cms-runtime.js`: runtime de overrides, login e persistencia local.
- `assets/js/admin.js`: interface e acoes do painel admin.

## Acesso admin

1. Abra `admin.html`.
2. Login padrao:
- Usuario: `admin`
- Senha: `hardware2026`
3. Depois do primeiro acesso, altere usuario e senha no bloco "Credenciais do admin".

## Como editar sem codigo

1. No painel admin, altere textos, links, imagens/logos e data do evento.
2. Clique em `Salvar alteracoes`.
3. Use `Atualizar preview` para validar no iframe ou recarregue `index.html`.

Se estiver rodando com `local-cms-server.mjs` (`http://localhost:5500`), o admin sincroniza os overrides no arquivo `assets/data/overrides.json` e os dispositivos na mesma rede (celular) recebem as mudancas.

## Card de DJ inicial

- O primeiro card de DJ pode ser usado como ponto de partida para preenchimento do lineup.
- Campos editaveis no admin:
- Textos do card (badge, nome, origem, descricao e label de preview).
- Foto e logo (URL, alt e upload direto para pasta `assets/` via servidor local).
- Audio de preview (`src` do player).

## Exportar/importar configuracoes

- `Exportar JSON`: baixa os overrides atuais.
- `Importar JSON`: aplica overrides salvos.

Isso permite mover configuracoes entre navegadores/maquinas.

## Observacao importante

Este painel usa armazenamento local do navegador (`localStorage`).

- As alteracoes nao sobem automaticamente para o servidor.
- Para publicar em producao, use o JSON exportado no ambiente que hospeda o site.
- Para um admin online real (multiusuario), o proximo passo e conectar a um backend/CMS.
