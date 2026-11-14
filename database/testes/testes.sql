use edualerta

-- TESTE INTEGRADO - FILA DE ACOMPANHAMENTO
-- Apresenta os casos abertos e seus responsáveis.

SELECT *
FROM vw_fila
ORDER BY priority DESC, opened_at DESC;

-- TESTE INTEGRADO - INDICADORES
-- Consulta o percentual e a classificação
-- de frequência de todos os estudantes.

SELECT
    student_id,
    student_name,
    total_classes_scheduled,
    total_classes_attended,
    attendance_percentage,
    attendance_status
FROM vw_frequencia_aluno
ORDER BY attendance_percentage ASC;

-- Lista os relacionamentos configurados
-- entre as tabelas do EduAlerta.

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'edualerta'
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;


-- REVISÃO 2 - ÍNDICES E RESTRIÇÕES
-- Lista os índices configurados nas tabelas.

SELECT
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'edualerta'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- REVISÃO  - ÍNDICES IMPORTANTES
-- Confere índices únicos e seus campos.

SELECT
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns_indexed
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'edualerta'
AND NON_UNIQUE = 0
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME;

-- REVISÃO  - RESTRIÇÕES CHECK
-- Lista as regras de validação configuradas.

SELECT
    tc.TABLE_NAME,
    tc.CONSTRAINT_NAME,
    cc.CHECK_CLAUSE
FROM information_schema.TABLE_CONSTRAINTS tc
INNER JOIN information_schema.CHECK_CONSTRAINTS cc
    ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
    AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_SCHEMA = 'edualerta'
AND tc.CONSTRAINT_TYPE = 'CHECK'
ORDER BY tc.TABLE_NAME;

-- REVISÃO  - VÍNCULO DO ESTUDANTE
-- Verifica se class_id aceita valores NULL.

SHOW COLUMNS FROM students LIKE 'class_id';

-- REVISÃO  - HISTÓRICO DE TURMAS
-- Confere os índices e restrições da tabela.

SHOW INDEX FROM student_class_history;


-- REVISÃO - CONCLUSÃO DOS CASOS
-- Verifica o status e a data de conclusão.

SELECT
    id,
    title,
    status,
    completed_at
FROM follow_up_cases
ORDER BY id;


-- REVISÃO  - CONSISTÊNCIA DO HISTÓRICO
-- Compara a turma atual do estudante
-- com seu vínculo vigente no histórico.

SELECT
    s.id,
    s.name,
    s.class_id AS current_class_id,
    h.class_id AS history_class_id
FROM students s
LEFT JOIN student_class_history h
    ON h.student_id = s.id
    AND h.end_date IS NULL
WHERE s.class_id IS NOT NULL
AND (
    h.id IS NULL
    OR s.class_id <> h.class_id
);


-- TESTE - RESTRIÇÃO DE FREQUÊNCIA
-- Tenta registrar mais aulas frequentadas
-- do que aulas previstas.
-- A operação deve ser rejeitada.

START TRANSACTION;
INSERT INTO attendance_records
(student_id, record_date, classes_scheduled, classes_attended)
VALUES
(1, '2026-03-01', 10, 15);
ROLLBACK;

-- TESTE: FREQUÊNCIA DUPLICADA
-- Esperado: erro Duplicate entry.

START TRANSACTION;
INSERT INTO attendance_records
(student_id, record_date, classes_scheduled, classes_attended)
VALUES
(1, '2026-02-10', 10, 8);
ROLLBACK;

-- TESTE: DATA INVÁLIDA NO HISTÓRICO
-- Esperado: erro de CHECK constraint.

START TRANSACTION;
INSERT INTO student_class_history
(student_id, class_id, start_date, end_date)
VALUES
(1, 1, '2026-03-10', '2026-03-01');
ROLLBACK;

-- TESTE: CASO CONCLUÍDO SEM DATA
-- Esperado: erro de CHECK constraint.

START TRANSACTION;
INSERT INTO follow_up_cases
(student_id, responsible_user_id, title, description, status, priority)
VALUES
(1, 1, 'Teste de conclusão', 'Teste de integridade.',
 'completed', 'media');
ROLLBACK;

-- TESTE: EXCLUSÃO DE ESTUDANTE RELACIONADO
-- Esperado: erro de restrição de chave estrangeira.

START TRANSACTION;
DELETE FROM students
WHERE id = 1;
ROLLBACK;

