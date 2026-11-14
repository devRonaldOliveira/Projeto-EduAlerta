# Backend EduAlerta

## Ambiente local

O backend utiliza Python 3.12 e um ambiente virtual próprio em `.venv`.

No PowerShell, a partir da pasta `backend`, ative-o com:

```powershell
.\.venv\Scripts\Activate.ps1
```

Para confirmar o interpretador ativo:

```powershell
python --version
```

As dependências da aplicação estão registradas em `requirements.txt`.

## Criar manualmente o primeiro usuário

Antes de implementar a autenticação, crie o usuário inicial manualmente após
configurar o arquivo `.env` com acesso ao banco correto. A senha é solicitada
de forma oculta e armazenada com hash Argon2id; ela não deve ser incluída em
comandos, arquivos de configuração ou commits.

Na pasta `backend`, com o ambiente virtual ativado e as dependências instaladas:

```powershell
python -m scripts.create_initial_user
```

Informe nome, e-mail e função quando solicitado, confirme a senha e digite
`CRIAR` para autorizar a gravação (maiúsculas ou minúsculas). O comando verifica e-mails duplicados antes
de inserir o usuário.

## Executar manualmente a API

A partir da pasta `backend`, com o ambiente virtual ativado:

```powershell
python -m uvicorn app.main:app --reload
```

Depois, abra:

- `http://127.0.0.1:8000/health` para verificar a API e o banco;
- `http://127.0.0.1:8000/docs` para abrir o Swagger.

## Executar manualmente os testes

```powershell
python -m pytest
```

Os testes de `health` substituem a sessão real por uma sessão falsa. Assim, eles não alteram o MySQL existente.

## Frequência (Sprint 3)

Os endpoints de frequência documentados no Swagger incluem:

- `POST /attendance` para registrar a frequência diária;
- `GET /attendance` para consultar registros com filtros e paginação;
- `GET /attendance/summary` e `GET /attendance/timeline` para dados agregados;
- `GET /attendance/alerts` para alertas calculados sob demanda;
- `GET /students/{student_id}/attendance/summary` e `/monthly` para o histórico individual;
- `GET /classes/{class_id}/attendance/summary` para o resumo da turma.

Os filtros de período usam limites inclusivos. A classificação é `Regular` (75% ou mais), `Atenção` (60% a menos de 75%), `Alerta` (abaixo de 60%) ou `Sem dados`. Os alertas não são persistidos em uma tabela: a API calcula a faixa percentual e registros consecutivos de ausência a cada consulta.
