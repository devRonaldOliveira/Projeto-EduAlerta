use edualerta

-- Cadastra as turmas disponíveis na escola.

INSERT INTO classes (name) VALUES
('1º Ano A'),
('1º Ano B'),
('2º Ano A'),
('3º Ano A');

SELECT * FROM classes;

-- Cadastra os usuários que acessam o sistema.

INSERT INTO users (name, email, password_hash, role)
VALUES (
    'Coordenador EduAlerta',
    'coordenador@edualerta.com',
    'HASH_FICTICIO_PARA_TESTE',
    'coordenador'
);

SELECT id, name, email, role, is_active FROM users;

SELECT id, name FROM classes ORDER BY id;

-- Cadastra os estudantes e seus dados básicos.
-- Cada estudante pode estar vinculado a uma turma.

INSERT INTO students (name, enrollment_code, class_id, birth_date, guardian_name, guardian_contact)
VALUES
('Ana Beatriz Santos', 'EA2026001', 1, '2012-03-15', 'Maria Santos', '81999990001'),
('Lucas Oliveira', 'EA2026002', 1, '2012-07-22', 'João Oliveira', '81999990002'),
('Mariana Costa', 'EA2026003', 2, '2012-05-10', 'Paula Costa', '81999990003'),
('Pedro Henrique Lima', 'EA2026004', 2, '2012-11-08', 'Carlos Lima', '81999990004'),
('Gabriela Souza', 'EA2026005', 3, '2011-02-18', 'Fernanda Souza', '81999990005'),
('Rafael Mendes', 'EA2026006', 3, '2011-09-12', 'Roberto Mendes', '81999990006'),
('Juliana Ferreira', 'EA2026007', 4, '2010-04-25', 'Sandra Ferreira', '81999990007'),
('Matheus Almeida', 'EA2026008', 4, '2010-12-03', 'André Almeida', '81999990008');

SELECT id, name, enrollment_code, class_id, is_active
FROM students
ORDER BY id;

-- Consulta os estudantes e suas turmas atuais.
SELECT id, name, class_id
FROM students
ORDER BY id;

-- Registra o vínculo atual de cada estudante
INSERT INTO student_class_history (student_id, class_id, start_date, end_date)
VALUES
(1, 1, '2026-02-02', NULL),
(2, 1, '2026-02-02', NULL),
(3, 2, '2026-02-02', NULL),
(4, 2, '2026-02-02', NULL),
(5, 3, '2026-02-02', NULL),
(6, 3, '2026-02-02', NULL),
(7, 4, '2026-02-02', NULL),
(8, 4, '2026-02-02', NULL);

SELECT
    h.id,
    s.name AS student_name,
    c.name AS class_name,
    h.start_date,
    h.end_date
FROM student_class_history h
INNER JOIN students s ON s.id = h.student_id
INNER JOIN classes c ON c.id = h.class_id
ORDER BY s.id;

-- Insere registros fictícios de frequência.
-- Cada estudante possui dois registros de 10 aulas.
-- Os dados serão utilizados nos indicadores do dashboard.
INSERT INTO attendance_records
(student_id, record_date, classes_scheduled, classes_attended, notes, recorded_by)
VALUES
(1, '2026-02-10', 10, 10, 'Frequência regular', NULL),
(1, '2026-02-20', 10, 9, 'Uma ausência', NULL),
(2, '2026-02-10', 10, 9, 'Uma ausência', NULL),
(2, '2026-02-20', 10, 9, 'Uma ausência', NULL),
(3, '2026-02-10', 10, 7, 'Ausências registradas', NULL),
(3, '2026-02-20', 10, 7, 'Ausências registradas', NULL),
(4, '2026-02-10', 10, 6, 'Frequência abaixo do esperado', NULL),
(4, '2026-02-20', 10, 7, 'Frequência abaixo do esperado', NULL),
(5, '2026-02-10', 10, 5, 'Necessita acompanhamento', NULL),
(5, '2026-02-20', 10, 6, 'Necessita acompanhamento', NULL),
(6, '2026-02-10', 10, 4, 'Frequência crítica', NULL),
(6, '2026-02-20', 10, 5, 'Frequência crítica', NULL),
(7, '2026-02-10', 10, 10, 'Frequência integral', NULL),
(7, '2026-02-20', 10, 10, 'Frequência integral', NULL),
(8, '2026-02-10', 10, 8, 'Frequência regular', NULL),
(8, '2026-02-20', 10, 8, 'Frequência regular', NULL);

SELECT
    s.name AS student_name,
    ar.record_date,
    ar.classes_scheduled,
    ar.classes_attended
FROM attendance_records ar
INNER JOIN students s ON s.id = ar.student_id
ORDER BY s.id, ar.record_date;

-- Confere a quantidade de registros de frequência cadastrados.
SELECT COUNT(*) AS total_registros
FROM attendance_records;

-- TESTE DA VIEW DE FREQUÊNCIA
-- Consulta os percentuais e as classificações
-- calculadas para cada estudante.

SELECT *
FROM vw_frequencia_aluno
ORDER BY student_id;

-- Registra estudantes que precisam de acompanhamento.
-- Define responsável, prioridade e status do caso.
INSERT INTO follow_up_cases
(student_id, responsible_user_id, title, description, status, priority)
VALUES
(3, 1, 'Acompanhamento de frequência - Mariana',
 'Estudante apresenta frequência de 70%. Necessita monitoramento.',
 'pending', 'media'),
(4, 1, 'Acompanhamento de frequência - Pedro',
 'Estudante apresenta frequência de 65%. Necessita de intervenção.',
 'in_progress', 'alta'),
(5, 1, 'Risco de evasão - Gabriela',
 'Estudante apresenta frequência de 55%. Necessita acompanhamento prioritário.',
 'in_progress', 'alta'),
(6, 1, 'Risco crítico de evasão - Rafael',
 'Estudante apresenta frequência de 45%. Necessita atenção imediata.',
 'pending', 'critica');

-- Confere os casos cadastrados e seus responsáveis.
SELECT
    fc.id,
    s.name AS student_name,
    fc.title,
    fc.status,
    fc.priority,
    u.name AS responsible_name
FROM follow_up_cases fc
INNER JOIN students s ON s.id = fc.student_id
LEFT JOIN users u ON u.id = fc.responsible_user_id
ORDER BY fc.id;

-- Registra as ações realizadas nos casos.
-- Cada intervenção está vinculada a um caso
-- e ao usuário responsável pela execução.

INSERT INTO interventions
(follow_up_case_id, responsible_user_id, type, description)
VALUES
(1, 1, 'Conversa com estudante',
 'Realizada conversa para compreender os motivos das ausências.'),
(2, 1, 'Contato com responsável',
 'Responsável contatado para discutir a frequência escolar.'),
(3, 1, 'Reunião com família',
 'Realizada reunião para identificar dificuldades que afetam a frequência.'),
(4, 1, 'Acompanhamento prioritário',
 'Iniciado acompanhamento para investigar as causas das ausências frequentes.');

-- Confere as intervenções e seus respectivos casos.
SELECT
    i.id,
    s.name AS student_name,
    fc.title AS follow_up_case,
    i.type,
    i.description,
    u.name AS responsible_name,
    i.performed_at
FROM interventions i
INNER JOIN follow_up_cases fc ON fc.id = i.follow_up_case_id
INNER JOIN students s ON s.id = fc.student_id
INNER JOIN users u ON u.id = i.responsible_user_id
ORDER BY i.id;

-- Registra atividades futuras dos casos.
-- Define responsável, prazo e status da ação.

INSERT INTO next_actions
(follow_up_case_id, responsible_user_id, description, due_date, status)
VALUES
(1, 1, 'Realizar novo contato com o estudante para verificar sua frequência.',
 '2026-11-13', 'pending'),
(2, 1, 'Agendar reunião com os responsáveis para acompanhar a evolução.',
 '2026-11-12', 'pending'),
(3, 1, 'Verificar se as medidas adotadas melhoraram a frequência escolar.',
 '2026-11-11', 'pending'),
(4, 1, 'Realizar reunião prioritária com a família e elaborar plano de acompanhamento.',
 '2026-11-10', 'pending');
 
 -- Consulta as próximas ações e seus respectivos responsáveis.
SELECT
    na.id,
    s.name AS student_name,
    fc.title AS follow_up_case,
    na.description,
    na.due_date,
    na.status,
    u.name AS responsible_name
FROM next_actions na
INNER JOIN follow_up_cases fc ON fc.id = na.follow_up_case_id
INNER JOIN students s ON s.id = fc.student_id
LEFT JOIN users u ON u.id = na.responsible_user_id
ORDER BY na.due_date;


