# Integração do frontend EduAlerta

## Situação atual

O frontend não chama endpoints nem simula gravações. As páginas aceitam dados por adaptadores JavaScript e notificam integrações futuras por eventos DOM; sem um adaptador conectado, os formulários apenas validam e indicam que o envio depende do backend. Dados de estudantes e responsáveis não são gravados em `localStorage` ou `sessionStorage`.

Os registros temporários de acompanhamento, alterações de perfil e notificações de retorno existem somente na memória da página e desaparecem ao recarregá-la. As preferências gerais da tela Configurações continuam usando o armazenamento local já existente; não incluem dados pessoais.

## Cadastro e diretório de alunos

`window.EduAlertaAlunos.setAlunos(alunos, resumo, catalogo)` atualiza a tabela, indicadores e filtros. O catálogo pode fornecer `escolas: [{ nome, turmas: ['5º A'] }]`; a lista de turmas do formulário é filtrada pela escola selecionada. Também estão disponíveis `setCarregando()` e `setErro(mensagem)`.

Após validar o cadastro, a página emite `edualerta:student-registration`, com os campos do formulário em `event.detail`. A ação separada de inclusão na fila emite `edualerta:queue-add`, com identificador, registro selecionado, motivo, prioridade e observação. Esses eventos não gravam dados por si só.

Os registros de aluno devem incluir um identificador estável (`id`, `studentId` ou `alunoId`); a matrícula é aceita como alternativa para compatibilidade. O link de perfil usa esse identificador na query `id`.

## Perfil e acompanhamentos

`window.EduAlertaPerfil.setPerfil(perfil)` recebe `id`, `nome`, `matricula`, `dataNascimento`, `escola`, `serie`, `turma`, `turno`, `anoLetivo`, `situacaoMatricula`, `responsavel`, `telefoneResponsavel`, `emailResponsavel` e, opcionalmente, indicadores, histórico e eventos. `setCarregando()` e `setErro(mensagem)` representam estados de consulta.

O formulário de edição emite `edualerta:student-update`; o de acompanhamento emite `edualerta:followup-submit`, contendo datas, intervenção, profissional, descrição, resultado, próxima ação, status e indicação de alerta de retorno. O registro e o alerta correspondentes são exibidos apenas na sessão atual até que o serviço de acompanhamento os confirme e persista.

## Fila e notificações

`window.EduAlertaFila.setAlertas(lista)` recebe alertas com identificador do estudante, nome, escola, turma, sinal, data, nível, status e, quando disponíveis, `novo` e `quedaRecente`. A fila atualiza os avisos de frequência no painel. O adaptador também oferece `setCarregando()` e `setErro(mensagem)`.

`window.EduAlertaNotificacoes.setNotificacoes(lista)` aceita itens com `id`, `tipo` (`frequencia`, `acompanhamento` ou `retorno`), `titulo`, `descricao`, `data`, identificador do estudante e `lida`. Há também `setCarregando()`, `setErro(mensagem)` e `adicionarPrevia(item)`.

Marcar como lida atualiza o estado apenas na página atual e emite `edualerta:notification-read` com o identificador do item. A integração deve persistir essa mudança no serviço e reenviar a lista atualizada; o frontend não persiste notificações localmente.

## Dashboard

`window.EduAlertaDashboard.setDados({ resumo, alunos })` atualiza indicadores e a lista de estudantes; `setCarregando()` e `setErro(mensagem)` tratam os estados da consulta. Aplicar o período emite `edualerta:dashboard-filter` com `inicio` e `fim` em formato ISO (`YYYY-MM-DD`), ou `null` quando o filtro é removido. A camada de integração deve consultar o backend com esse intervalo e enviar os novos indicadores.

## Relatórios

`window.EduAlertaRelatorios.setDados({ resumo, escolas, turmas, estudantes, distribuicao, evolucao, periodos })` fornece os dados para a página. Os filtros de estudante e situação dependem de registros individuais em `estudantes`; sem essa coleção, o filtro de estudante permanece indisponível. Os filtros de escola, turma e período também são aplicados aos dados recebidos.

As categorias de frequência seguem os limites já apresentados pelo produto: regular a partir de 75%, atenção de 60% a menos de 75% e alerta abaixo de 60%; se o serviço fornecer uma situação explícita, ela tem precedência. CSV e impressão/PDF usam a seleção aplicada. A impressão do navegador permite escolher “Salvar como PDF”.

## Pendências para integração

- Confirmar com o backend os contratos, identificadores, regras de autorização e tratamento de erros; nenhum endpoint foi presumido.
- Definir o catálogo oficial de escolas, séries, turmas, turnos, anos letivos e situações de matrícula.
- Definir validação, normalização e regras de privacidade para dados de estudantes e responsáveis.
- Implementar confirmação de gravação e atualização do diretório, perfil, histórico, fila e notificações somente após resposta bem-sucedida do serviço.
- Definir a persistência de leitura de notificações e os critérios e prazos para alertas e retornos.
- Definir a origem, os limites e a granularidade temporal dos indicadores e relatórios.
