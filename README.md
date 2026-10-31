# project-clipboard

Uma extensão para o Visual Studio Code projetada para facilitar e agilizar a extração de contexto de repositórios para modelos de Inteligência Artificial (ChatGPT, Claude, Gemini, etc.). Ela fornece uma interface de árvore de arquivos interativa diretamente na barra lateral do editor.

# Principais Funcionalidades

## Árvore de Arquivos Interativa: 

- Navegue pela estrutura do projeto em formato de árvore na barra lateral do VS Code.

## Seleção Avançada:

- Seleção individual de arquivos via caixas de seleção (checkboxes).

- Suporte a seleção por intervalo com Shift + clique (com suporte à reversão de seleção para marcar ou desmarcar blocos inteiros com facilidade).

## Filtros Inteligentes:

- Ignora automaticamente arquivos binários e extensões incompatíveis (como imagens, áudios, vídeos, arquivos compactados, etc.).

- Lê e respeita nativamente as regras do arquivo .gitignore do projeto.

## Múltiplos Formatos de Exportação (Grid 2x2):

- Copy Selected: Copia apenas os arquivos selecionados para a área de transferência formatados para IA.

- Pack Selected XML: Empacota os arquivos selecionados em um arquivo XML robusto (packedselected.xml) usando blocos CDATA para preservar a integridade do código.

- Copy Project to Clipboard: Copia o projeto inteiro (respeitando o .gitignore) diretamente para a área de transferência.

- Pack Project XML: Gera e abre automaticamente um arquivo XML completo do projeto (packedproject.xml) pronto para ser utilizado em contextos massivos de IA.

# Guia de Instalação Local
Como esta extensão foi desenvolvida para uso pessoal e customizado, ela pode ser instalada diretamente no seu VS Code através de um arquivo empacotado .vsix. Siga os passos abaixo:

## Pré-requisitos
Certifique-se de ter o Node.js instalado em sua máquina e a ferramenta vsce (Visual Studio Code Extensions) instalada globalmente para realizar o empacotamento:

```npm install -g @vscode/vsce```

## Passos para Instalação

Empacotar a extensão:
Abra o terminal na pasta raiz do projeto da extensão e execute o comando de empacotamento:

```vsce package```

Isso gerará um arquivo com a extensão .vsix (por exemplo, codebase-clipboard-1.0.0.vsix).

## Instalar no VS Code:

Abra o Visual Studio Code.

Vá até a aba de Extensões (Ctrl+Shift+X no Linux/Windows ou Cmd+Shift+X no macOS).

Clique no ícone de três pontos (...) no canto superior direito do painel de extensões.

Selecione a opção Install from VSIX... (Instalar a partir de VSIX).

Selecione o arquivo .vsix gerado no passo 1.

Pronto!
A aba AI Context aparecerá automaticamente na sua barra lateral, pronta para ser utilizada no seu fluxo de trabalho.

# Como Usar

Abra a aba AI Context na barra lateral do VS Code.

Selecione os arquivos desejados usando cliques simples ou utilize o Shift + clique para selecionar intervalos.

Escolha a ação desejada nos botões localizados na parte inferior da extensão (Copiar para a Área de Transferência ou Empacotar em XML).
