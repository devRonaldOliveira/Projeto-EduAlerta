-- EduAlerta - DDL consolidado

CREATE DATABASE IF NOT EXISTS edualerta
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE edualerta;

-- 1. Turmas
CREATE TABLE IF NOT EXISTS classes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_classes_name (name)
) ENGINE=InnoDB;

-- 2. Usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'coordenador',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 3. Estudantes
CREATE TABLE IF NOT EXISTS students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  enrollment_code VARCHAR(50) NOT NULL,
  class_id INT UNSIGNED NULL,
  birth_date DATE NULL,
  guardian_name VARCHAR(150) NULL,
  guardian_contact VARCHAR(50) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_enrollment_code (enrollment_code),
  CONSTRAINT fk_students_class
    FOREIGN KEY (class_id) REFERENCES classes(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4. Histórico de turmas
CREATE TABLE IF NOT EXISTS student_class_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  CONSTRAINT fk_history_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_history_class
    FOREIGN KEY (class_id) REFERENCES classes(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_history_dates
    CHECK (end_date IS NULL OR end_date >= start_date),
  INDEX idx_history_student (student_id),
  INDEX idx_history_class (class_id)
) ENGINE=InnoDB;


-- 5. Frequencia diaria: no maximo um registro por estudante/data.
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id INT UNSIGNED NOT NULL,
    record_date DATE NOT NULL,
    classes_scheduled INT NOT NULL,
    classes_attended INT NOT NULL,
    notes TEXT NULL,
    recorded_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_user
        FOREIGN KEY (recorded_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_classes_scheduled
        CHECK (classes_scheduled >= 0),
    CONSTRAINT chk_classes_attended
        CHECK (classes_attended >= 0 AND classes_attended <= classes_scheduled),
    UNIQUE KEY uq_student_record_date (student_id,record_date),
INDEX idx_attendance_date (record_date)
) ENGINE=InnoDB;

-- 6. Casos de acompanhamento.
-- Status: pending, in_progress, completed.
-- Prioridades mantidas conforme material recebido: baixa, media, alta, critica.
CREATE TABLE IF NOT EXISTS follow_up_cases (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id INT UNSIGNED NOT NULL,
    responsible_user_id INT UNSIGNED NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status ENUM(
        'pending',
        'in_progress',
        'completed'
    ) NOT NULL DEFAULT 'pending',
    priority ENUM(
        'baixa',
        'media',
        'alta',
        'critica'
    ) NOT NULL DEFAULT 'media',
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    CONSTRAINT fk_followup_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_followup_responsible
        FOREIGN KEY (responsible_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_followup_completed
        CHECK (
            (status = 'completed' AND completed_at IS NOT NULL)
            OR
            (status <> 'completed' AND completed_at IS NULL)
        ),
    INDEX idx_followup_student (student_id),
    INDEX idx_followup_status (status),
    INDEX idx_followup_responsible (responsible_user_id)
) ENGINE=InnoDB;


-- 7. Intervencoes. O responsavel e obrigatorio.
CREATE TABLE IF NOT EXISTS interventions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    follow_up_case_id INT UNSIGNED NOT NULL,
    responsible_user_id INT UNSIGNED NOT NULL,
    type VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_intervention_case FOREIGN KEY (follow_up_case_id)
    REFERENCES follow_up_cases(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_intervention_responsible FOREIGN KEY (responsible_user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_intervention_case (follow_up_case_id),
    INDEX idx_intervention_responsible (responsible_user_id),
    INDEX idx_intervention_date (performed_at)
) ENGINE=InnoDB;

-- 8. Proximas acoes.
CREATE TABLE IF NOT EXISTS next_actions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    follow_up_case_id INT UNSIGNED NOT NULL,
    responsible_user_id INT UNSIGNED NULL,
    description TEXT NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_next_action_case FOREIGN KEY (follow_up_case_id)
    REFERENCES follow_up_cases(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_next_action_responsible FOREIGN KEY (responsible_user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_next_action_case (follow_up_case_id),
    INDEX idx_next_action_responsible (responsible_user_id),
    INDEX idx_next_action_due_date (due_date),
    INDEX idx_next_action_status (status)
) ENGINE=InnoDB;

USE edualerta;
SHOW TABLES;

-- View: resumo de frequencia de todos os registros existentes.
-- Sem registros ou sem aulas previstas = 'Sem dados', nunca 'Alerta'.
-- O percentual considera todo o historico registrado; o backend pode filtrar periodos
-- em consultas especificas quando a regra do dashboard exigir.
CREATE OR REPLACE VIEW vw_frequencia_aluno AS
SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(SUM(ar.classes_scheduled), 0) AS total_classes_scheduled,
    COALESCE(SUM(ar.classes_attended), 0) AS total_classes_attended,
    CASE
        WHEN COALESCE(SUM(ar.classes_scheduled), 0) = 0 THEN NULL
        ELSE ROUND(
            SUM(ar.classes_attended) * 100.0 /
            SUM(ar.classes_scheduled), 2
        )
    END AS attendance_percentage,
    CASE
        WHEN COALESCE(SUM(ar.classes_scheduled), 0) = 0 THEN 'Sem dados'
        WHEN SUM(ar.classes_attended) * 100.0 /
             SUM(ar.classes_scheduled) >= 75 THEN 'Regular'
        WHEN SUM(ar.classes_attended) * 100.0 /
             SUM(ar.classes_scheduled) >= 60 THEN 'Atenção'
        ELSE 'Alerta'
    END AS attendance_status
FROM students s
LEFT JOIN attendance_records ar ON ar.student_id = s.id
WHERE s.is_active = TRUE
GROUP BY s.id, s.name;

-- View: fila de casos .
-- A ordenacao deve ser aplicada tambem na consulta do backend; Views nao garantem
-- ordenacao quando consultadas sem ORDER BY externo.
CREATE OR REPLACE VIEW vw_fila AS
SELECT
  f.id AS case_id,
  s.id AS student_id,
  s.name AS student_name,
  c.name AS turma,
  f.title,
  f.status,
  f.priority,
  f.responsible_user_id,
  f.opened_at
FROM follow_up_cases f
JOIN students s ON s.id = f.student_id
LEFT JOIN classes c ON c.id = s.class_id
WHERE f.status IN ('pending', 'in_progress')
  AND s.is_active = TRUE;
  
SELECT * FROM vw_fila;

SHOW FULL TABLES FROM edualerta;

SELECT * FROM vw_frequencia_aluno;
