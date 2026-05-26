import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Room, Therapist, TreatmentCode } from '@/types/database';

type TherapistWithRoom = Therapist & { room: Pick<Room, 'name'> | null };

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 데이터베이스 연결 확인
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*')
    .returns<Room[]>();

  const { data: therapists, error: therapistsError } = await supabase
    .from('therapists')
    .select('*, room:rooms(name)')
    .returns<TherapistWithRoom[]>();

  const { data: treatmentCodes } = await supabase
    .from('treatment_codes')
    .select('*')
    .returns<TreatmentCode[]>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-blue-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🏥 재활치료실 통합 스케줄러</h1>
            <p className="text-blue-200 text-sm">작업치료실 · 운동치료실</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-200">로그인: {user.email}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Phase 1 완료 안내 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-green-800 mb-2">✅ Phase 1 완료 — 기반 준비 완료</h2>
          <p className="text-green-700">
            데이터베이스 연결이 성공적으로 설정되었습니다. 아래에서 초기 데이터를 확인하세요.
          </p>
        </div>

        {/* 오류 표시 */}
        {(roomsError || therapistsError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-red-800 mb-2">⚠️ 데이터베이스 연결 오류</h2>
            <p className="text-red-700 text-sm">
              Supabase 연결을 확인해주세요. SQL 마이그레이션이 실행되었는지 확인하세요.
            </p>
            {roomsError && <p className="text-red-600 text-xs mt-1">{roomsError.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 치료실 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">🏠 치료실 ({rooms?.length ?? 0}개)</h3>
            {rooms && rooms.length > 0 ? (
              <ul className="space-y-2">
                {rooms.map((room: Room) => (
                  <li key={room.id} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    {room.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">데이터 없음 — SQL 실행 필요</p>
            )}
          </div>

          {/* 치료사 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">👨‍⚕️ 치료사 ({therapists?.length ?? 0}명)</h3>
            {therapists && therapists.length > 0 ? (
              <ul className="space-y-1">
                {therapists.map((t: TherapistWithRoom) => (
                  <li key={t.id} className="text-sm flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full inline-block ${
                      t.room?.name === '작업치료실' ? 'bg-green-500' : 'bg-orange-500'
                    }`} />
                    <span>{t.name}</span>
                    <span className="text-gray-400 text-xs">({t.room?.name})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">데이터 없음 — SQL 실행 필요</p>
            )}
          </div>

          {/* 처방코드 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">💊 처방코드 ({treatmentCodes?.length ?? 0}종)</h3>
            {treatmentCodes && treatmentCodes.length > 0 ? (
              <ul className="space-y-1">
                {treatmentCodes.map((tc: TreatmentCode) => (
                  <li key={tc.code} className="text-sm flex items-center gap-2">
                    <span
                      className="w-8 h-5 rounded text-xs flex items-center justify-center font-bold text-gray-700 border border-gray-300"
                      style={{ backgroundColor: `#${tc.color_hex}` }}
                    >
                      {tc.code}
                    </span>
                    <span className="flex-1 truncate">{tc.label}</span>
                    <span className="text-gray-400 text-xs">{tc.default_minutes}분</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">데이터 없음 — SQL 실행 필요</p>
            )}
          </div>
        </div>

        {/* 다음 단계 안내 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-800 mb-3">📋 개발 진행 현황</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-blue-700">
            <div className="flex items-start gap-2">
              <span>✅</span>
              <span><strong>Phase 1</strong> — 기반 준비 (완료)</span>
            </div>
            <div className="flex items-start gap-2">
              <span>⏳</span>
              <span>Phase 2 — 로그인 화면</span>
            </div>
            <div className="flex items-start gap-2">
              <span>⏳</span>
              <span>Phase 3 — 주간 그리드 (시간표)</span>
            </div>
            <div className="flex items-start gap-2">
              <span>⏳</span>
              <span>Phase 4 — 환자 통합 검색</span>
            </div>
            <div className="flex items-start gap-2">
              <span>⏳</span>
              <span>Phase 5 — 예약 등록/수정/삭제</span>
            </div>
            <div className="flex items-start gap-2">
              <span>⏳</span>
              <span>Phase 6 — 빈 슬롯 추천 · 관리</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
