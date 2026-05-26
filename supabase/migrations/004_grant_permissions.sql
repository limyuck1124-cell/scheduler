-- ============================================================
-- 테이블 접근 권한 부여 (permission denied 오류 해결)
-- ============================================================
-- 003_rls_policies.sql 실행 후 이 파일을 실행하세요.
-- ============================================================

-- authenticated 사용자에게 읽기 권한 부여
GRANT SELECT ON rooms           TO authenticated;
GRANT SELECT ON therapists      TO authenticated;
GRANT SELECT ON patients        TO authenticated;
GRANT SELECT ON treatment_codes TO authenticated;
GRANT SELECT ON appointments    TO authenticated;

-- authenticated 사용자에게 쓰기 권한 부여 (patients, appointments)
GRANT INSERT, UPDATE, DELETE ON patients     TO authenticated;
GRANT INSERT, UPDATE, DELETE ON appointments TO authenticated;

-- sequences 접근 권한 (uuid는 필요 없지만 혹시 모를 경우 대비)
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
