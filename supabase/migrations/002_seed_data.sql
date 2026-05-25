-- ============================================================
-- 초기 데이터 삽입 (치료실 · 치료사 · 처방코드)
-- ============================================================
-- 001_create_tables.sql 실행 후 이 파일을 실행하세요.
-- ============================================================


-- ── 치료실 ──────────────────────────────────────────────────
INSERT INTO rooms (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', '작업치료실'),
  ('00000000-0000-0000-0000-000000000002', '운동치료실')
ON CONFLICT DO NOTHING;


-- ── 치료사 ──────────────────────────────────────────────────
-- 작업치료실
INSERT INTO therapists (name, room_id) VALUES
  ('김보미', '00000000-0000-0000-0000-000000000001'),
  ('임혁',   '00000000-0000-0000-0000-000000000001'),
  ('백성종', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- 운동치료실
INSERT INTO therapists (name, room_id) VALUES
  ('고명석', '00000000-0000-0000-0000-000000000002'),
  ('정희돈', '00000000-0000-0000-0000-000000000002'),
  ('권오민', '00000000-0000-0000-0000-000000000002'),
  ('김유리', '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;


-- ── 처방코드 (작업치료실 전용) ────────────────────────────────
INSERT INTO treatment_codes (code, label, default_minutes, color_hex) VALUES
  ('C',   'Complex (처방 10분 / 운영 15분)', 15, 'D6E8F5'),
  ('A',   'ADL',                             20, 'D9EAD3'),
  ('C/A', 'Complex / ADL',                  30, 'FFF2CC'),
  ('S',   'Special',                         30, 'FCE5CD'),
  ('COM', '전산화인지치료',                  30, 'D9D2E9'),
  ('D',   'Dysphagia',                       30, 'F4CCCC')
ON CONFLICT DO NOTHING;


-- ── 예시 환자 ────────────────────────────────────────────────
INSERT INTO patients (id, name, memo) VALUES
  ('10000000-0000-0000-0000-000000000001', '홍길동',  '예시 환자'),
  ('10000000-0000-0000-0000-000000000002', '김영희',  '예시 환자'),
  ('10000000-0000-0000-0000-000000000003', '이철수',  '예시 환자'),
  ('10000000-0000-0000-0000-000000000004', '박민수',  '예시 환자'),
  ('10000000-0000-0000-0000-000000000005', '서용복a', '예시 환자 — 동명이인 a'),
  ('10000000-0000-0000-0000-000000000006', '서용복b', '예시 환자 — 동명이인 b')
ON CONFLICT DO NOTHING;


-- ── 더미 예약 ────────────────────────────────────────────────
-- (치료사 ID는 INSERT 후 실제 UUID로 바뀌므로 서브쿼리 사용)

-- 작업치료실 예시 예약 (월~금 반복)
INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, treatment_code, patient_type, block_type)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  t.id,
  1,           -- 월요일
  '09:00',
  30,
  'C/A',
  '외래',
  '환자치료'
FROM therapists t WHERE t.name = '김보미' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, treatment_code, patient_type, block_type)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  t.id,
  1,           -- 월요일
  '09:30',
  20,
  'A',
  '외래',
  '환자치료'
FROM therapists t WHERE t.name = '임혁' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, treatment_code, patient_type, block_type)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  t.id,
  2,           -- 화요일
  '10:00',
  15,
  'C',
  '병동',
  '환자치료'
FROM therapists t WHERE t.name = '백성종' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, treatment_code, patient_type, block_type)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  t.id,
  2,           -- 화요일
  '10:15',
  15,
  'C',
  '외래',
  '환자치료'
FROM therapists t WHERE t.name = '백성종' LIMIT 1
ON CONFLICT DO NOTHING;

-- 작업치료실 병동블록 예시
INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, block_type, note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  NULL,
  t.id,
  3,           -- 수요일
  '14:00',
  60,
  '병동블록',
  '3병동 순회'
FROM therapists t WHERE t.name = '김보미' LIMIT 1
ON CONFLICT DO NOTHING;

-- 경과기록 예시
INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, block_type, note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  NULL,
  t.id,
  5,           -- 금요일
  '16:00',
  60,
  '경과기록',
  '주간 경과기록'
FROM therapists t WHERE t.name = '임혁' LIMIT 1
ON CONFLICT DO NOTHING;

-- 운동치료실 예시 예약
INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, patient_type, block_type)
SELECT
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  t.id,
  1,           -- 월요일 (홍길동 — 작업치료 09:00~09:30 이후)
  '09:30',
  60,
  '외래',
  '환자치료'
FROM therapists t WHERE t.name = '고명석' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO appointments
  (room_id, patient_id, therapist_id, day_of_week, start_time, duration_min, patient_type, block_type)
SELECT
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000005',
  t.id,
  3,           -- 수요일
  '11:00',
  90,
  '병동',
  '환자치료'
FROM therapists t WHERE t.name = '정희돈' LIMIT 1
ON CONFLICT DO NOTHING;
