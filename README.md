# 재활치료실 통합 스케줄러

대학병원 재활치료실(작업치료실·운동치료실) 통합 일정 관리 웹 애플리케이션.

## 기술 스택

- **Next.js 16** (App Router, TypeScript)
- **Supabase** (PostgreSQL + Auth)
- **Tailwind CSS**
- **pnpm**

## 시작하기

### 1. 패키지 설치

```bash
pnpm install
```

### 2. Supabase 설정

`SUPABASE_SETUP.md` 파일을 참고해 Supabase 프로젝트를 설정하세요.

### 3. 환경 변수 설정

`.env.local.example` 파일을 복사해 `.env.local`로 만들고 Supabase 정보를 입력하세요.

```bash
cp .env.local.example .env.local
# .env.local 파일을 열어 Supabase URL과 Key를 입력
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

## 개발 단계

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | 기반 준비 (프로젝트·DB·초기데이터) | ✅ 완료 |
| 2 | 로그인 화면 | ⏳ |
| 3 | 주간 그리드 (시간표) | ⏳ |
| 4 | 환자 통합 검색 | ⏳ |
| 5 | 예약 등록/수정/삭제 + 충돌 감지 | ⏳ |
| 6 | 빈 슬롯 추천 · 병동블록 · 기준정보 관리 | ⏳ |
