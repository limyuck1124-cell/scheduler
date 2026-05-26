-- ============================================================
-- Row Level Security (RLS) 정책
-- 로그인한 사용자만 데이터에 접근 가능
-- ============================================================

-- RLS 활성화
ALTER TABLE rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments    ENABLE ROW LEVEL SECURITY;

-- 로그인한 사용자는 모든 데이터 읽기 가능
CREATE POLICY "로그인 사용자 읽기" ON rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "로그인 사용자 읽기" ON therapists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "로그인 사용자 읽기" ON patients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "로그인 사용자 읽기" ON treatment_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "로그인 사용자 읽기" ON appointments
  FOR SELECT TO authenticated USING (true);

-- 로그인한 사용자는 모든 데이터 쓰기 가능 (치료사 전원 동등 권한)
CREATE POLICY "로그인 사용자 쓰기" ON patients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "로그인 사용자 쓰기" ON appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 치료실·치료사·처방코드는 읽기만 허용 (관리자가 직접 DB에서 수정)
-- (Phase 6에서 관리 화면 추가 시 정책 변경 예정)
