# Supabase 설정 가이드

> 이 파일을 순서대로 따라하면 데이터베이스가 완성됩니다.
> 코딩 없이 Supabase 웹사이트에서 클릭만 하면 됩니다.

---

## 1단계 — Supabase 프로젝트 만들기

1. 브라우저에서 [https://supabase.com](https://supabase.com) 열기
2. **Start your project** 클릭 → GitHub 계정으로 로그인
3. **New project** 클릭
4. 설정:
   - **Name**: `scheduler` (또는 원하는 이름)
   - **Database Password**: 비밀번호 설정 (꼭 기억하거나 메모해두세요!)
   - **Region**: `Northeast Asia (Seoul)` 선택
5. **Create new project** 클릭 → 1~2분 기다리기

---

## 2단계 — 데이터베이스 테이블 만들기

1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. **New query** 클릭
3. `supabase/migrations/001_create_tables.sql` 파일 내용을 전부 복사해서 붙여넣기
4. **Run** 버튼 클릭 → "Success" 확인

---

## 3단계 — 초기 데이터 넣기

1. SQL Editor에서 **New query** 클릭
2. `supabase/migrations/002_seed_data.sql` 파일 내용을 전부 복사해서 붙여넣기
3. **Run** 버튼 클릭 → "Success" 확인

---

## 4단계 — 보안 설정 (Row Level Security)

1. SQL Editor에서 **New query** 클릭
2. `supabase/migrations/003_rls_policies.sql` 파일 내용을 전부 복사해서 붙여넣기
3. **Run** 버튼 클릭 → "Success" 확인

---

## 4-1단계 — 접근 권한 부여 (permission denied 오류 해결)

> SQL Editor로 테이블을 만들면 권한을 수동으로 부여해야 합니다.

1. SQL Editor에서 **New query** 클릭
2. `supabase/migrations/004_grant_permissions.sql` 파일 내용을 전부 복사해서 붙여넣기
3. **Run** 버튼 클릭 → "Success" 확인

---

## 5단계 — API 키 가져오기

1. 왼쪽 메뉴에서 **Settings** → **API** 클릭
2. 다음 두 가지를 복사해 두기:
   - **Project URL**: `https://xxxxxxxx.supabase.co` 형태
   - **anon public** 키: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` 형태

---

## 6단계 — 환경 변수 설정

프로젝트 루트(scheduler 폴더)에 `.env.local` 파일을 만들고 아래 내용을 채우세요:

```
NEXT_PUBLIC_SUPABASE_URL=여기에 Project URL 붙여넣기
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에 anon public 키 붙여넣기
```

---

## 7단계 — 치료사 계정 만들기

1. 왼쪽 메뉴에서 **Authentication** → **Users** 클릭
2. **Invite user** 클릭
3. 치료사 이메일을 입력해 계정 생성
4. 치료사 7명 모두 반복

> 또는 **Add user** → **Create new user**로 이메일+비밀번호를 직접 설정해도 됩니다.

---

## 설정 완료 확인

모든 단계가 끝나면:
1. 터미널에서 `pnpm dev` 실행
2. 브라우저에서 `http://localhost:3000` 열기
3. 로그인 화면이 뜨면 성공!
4. 로그인 후 치료실 2개, 치료사 7명, 처방코드 6종이 보이면 완료

---

*문의사항이 있으면 Claude Code에 질문해주세요.*
