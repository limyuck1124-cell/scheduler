-- ============================================================
-- 재활치료실 통합 스케줄러 — 데이터베이스 초기 설정
-- ============================================================
-- Supabase SQL Editor에서 이 파일의 내용을 실행하세요.
-- ============================================================


-- 1. rooms (치료실)
CREATE TABLE IF NOT EXISTS rooms (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

-- 2. therapists (치료사)
CREATE TABLE IF NOT EXISTS therapists (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name    text NOT NULL,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
);

-- 3. patients (환자)
CREATE TABLE IF NOT EXISTS patients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  memo       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. treatment_codes (처방코드 — 작업치료실 전용)
CREATE TABLE IF NOT EXISTS treatment_codes (
  code             text PRIMARY KEY,
  label            text NOT NULL,
  default_minutes  int  NOT NULL,
  color_hex        text NOT NULL
);

-- 5. appointments (예약 / 블록)
CREATE TABLE IF NOT EXISTS appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  patient_id      uuid REFERENCES patients(id) ON DELETE SET NULL,
  therapist_id    uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  day_of_week     int CHECK (day_of_week BETWEEN 1 AND 7),   -- 1=월 … 5=금, 6=토, 7=일
  date            date,                                        -- 토요일 등 특정 날짜 일정
  start_time      time NOT NULL,
  duration_min    int  NOT NULL CHECK (duration_min > 0),
  treatment_code  text REFERENCES treatment_codes(code) ON DELETE SET NULL,
  patient_type    text CHECK (patient_type IN ('병동', '외래')),
  block_type      text NOT NULL DEFAULT '환자치료'
                  CHECK (block_type IN ('환자치료', '병동블록', '경과기록', '평가')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- 평일 반복: day_of_week 채움, date 비움
  -- 특정 날짜: date 채움, day_of_week 비움
  CONSTRAINT chk_day_or_date CHECK (
    (day_of_week IS NOT NULL AND date IS NULL) OR
    (day_of_week IS NULL AND date IS NOT NULL)
  )
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스 (검색 성능)
CREATE INDEX IF NOT EXISTS idx_appointments_therapist ON appointments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient   ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_room      ON appointments(room_id);
CREATE INDEX IF NOT EXISTS idx_appointments_day       ON appointments(day_of_week);
CREATE INDEX IF NOT EXISTS idx_appointments_date      ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_therapists_room        ON therapists(room_id);
CREATE INDEX IF NOT EXISTS idx_patients_name          ON patients(name);
