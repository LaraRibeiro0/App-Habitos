# App Hábitos — versão 1

App web (PWA) para registar alimentação, exercício, líquidos, sono, meditação, leitura, peso e consultas.
Feita só com HTML, CSS e JavaScript (sem frameworks), ligada ao Supabase.

## Como testar no teu computador

1. Abre esta pasta (`site`) no **VS Code**: *File → Open Folder…*
2. Instala a extensão **Live Server** (separador Extensions, à esquerda).
3. Abre o `index.html` e carrega em **Go Live** (canto inferior direito).
4. O browser abre em `http://127.0.0.1:5500`. Entra com Google e faz a configuração inicial.

> Abrir o `index.html` com duplo clique **não funciona**: os módulos JavaScript precisam de um servidor (o Live Server).

## Estrutura

```
site/
├── index.html              Esqueleto da página (cabeçalho, ecrã, navegação)
├── privacidade.html        Política de privacidade (troca o email antes de publicar!)
├── manifest.webmanifest    Nome, cores e ícones da app instalada (PWA)
├── sw.js                   Service worker: permite instalar e abrir sem rede
├── css/style.css           Todo o aspeto: cores (tema claro e escuro), letras, componentes
├── icons/                  Ícones da app
└── js/
    ├── config.js           ← nome da app, endereço e chave pública do Supabase
    ├── supa.js             Ligação ao Supabase
    ├── app.js              Arranque, sessão, "router" (#/inicio, #/registar…)
    ├── data.js             Todas as leituras e escritas na base de dados
    ├── stats.js            Cálculos dos resumos (médias, sequências, dívida de sono)
    ├── util.js             Datas, formatação, avisos e janelas
    └── views/              Um ficheiro por ecrã
        ├── entrada.js      Entrar com Google ou email
        ├── configuracao.js Configuração inicial (5 passos)
        ├── inicio.js       Dashboard da semana
        ├── registar.js     Registo diário
        ├── calendario.js   Calendário com filtros
        ├── consultas.js    Consultas e resumo do período
        ├── definicoes.js   Definições
        ├── tarefas.js      Tarefas (to-do list)
        └── partes.js       Pedaços partilhados entre ecrãs
```

## Como funciona, em resumo

- **Router:** o endereço depois do `#` diz que ecrã mostrar. `#/registar/2026-11-21` abre o registo desse dia.
- **Desenhar um ecrã:** cada `views/*.js` tem uma função `mostrar()` que escreve o HTML do ecrã e liga os botões.
- **Dados:** os ecrãs nunca falam diretamente com o Supabase; chamam funções de `data.js`.
- **Segurança:** as regras RLS da base de dados garantem que cada pessoa só lê e altera as suas linhas.

## Mudar o nome da app

Muda `APP_NOME` em `js/config.js`, o `<title>` em `index.html` e `name`/`short_name` em `manifest.webmanifest`.

## Base de dados

- `01_base_de_dados.sql`: cria as tabelas (corre-se uma vez, num projeto novo).
- `02_habitos.sql`: acrescenta os "Outros hábitos" (suplementos, etc.).
- `03_tarefas.sql`: acrescenta as Tarefas (to-do list).

Cada script corre-se uma vez, **antes** de publicar a versão da app que o usa.
