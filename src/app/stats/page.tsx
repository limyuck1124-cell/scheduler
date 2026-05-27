'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Therapist, Room, Appointment } from '@/types/database';

// ── 상수 ────────────────────────────────────────────────────
const DAY_KO = ['월', '화', '수', '목', '금', '토'];

// 치료사 1인당 주간 가용 치료 시간 (분)
// 평일: 8:30~12:30(4h) + 13:30~17:30(4h) = 480분 × 5일
// 토요일: 8:30~12:30(4h) = 240분
const WEEKDAY_MIN  = 480;
const SAT_MIN      = 240;
const WEEKLY_AVAIL = 5 * WEEKDAY_MIN + SAT_MIN; // 2640분

// 고정 순서
const ROOM_ORDER = ['운동치료실', '작업치료실'];
const THERAPIST_ORDER: Record<string, string[]> = {
  '운동치료실': ['고명석', '정희돈', '권오민', '김유리'],
  '작업치료실': ['김보미', '임혁', '백성종'],
};

const ROOM_STYLE: Record<string, { header: string; bar: string; badge: string; text: string }> = {
  '운동치료실': { header: '#0284c7', bar: '#0ea5e9', badge: '#e0f2fe', text: '#0369a1' },
  '작업치료실': { header: '#059669', bar: '#10b981', badge: '#d1fae5', text: '#047857' },
};

// ── 타입 ────────────────────────────────────────────────────
type TherapistFull = Therapist & { room: Room };
type ApptSnap = Pick<Appointment, 'therapist_id' | 'day_of_week' | 'duration_min' | 'block_type'>;

type TherapistStat = {
  therapist: TherapistFull;
  apptCount: number;
  totalMin: number;
  byDay: number[];    // 예약 건수 [월…토]
  byDayMin: number[]; // 치료 시간 [월…토]
  utilization: number; // 0~100
};

// ── 헬퍼 ────────────────────────────────────────────────────
function sortTherapists(therapists: TherapistFull[]): TherapistFull[] {
  return [...therapists].sort((a, b) => {
    const ra = ROOM_ORDER.indexOf(a.room?.name ?? '');
    const rb = ROOM_ORDER.indexOf(b.room?.name ?? '');
    if (ra !== rb) return ra - rb;
    const order = THERAPIST_ORDER[a.room?.name ?? ''] ?? [];
    const ai = order.indexOf(a.name), bi = order.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name, 'ko');
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function StatsPage() {
  const router = useRouter();
  const [stats,   setStats]   = useState<TherapistStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const [therapistsRes, apptsRes] = await Promise.all([
        supabase.from('therapists').select('*, room:rooms(*)'),
        supabase.from('appointments').select('therapist_id, day_of_week, duration_min, block_type'),
      ]);

      const therapists = (therapistsRes.data ?? []) as TherapistFull[];
      const appts      = (apptsRes.data ?? []) as ApptSnap[];
      const sorted     = sortTherapists(therapists);

      const computed: TherapistStat[] = sorted.map(t => {
        const mine   = appts.filter(a => a.therapist_id === t.id);
        const byDay    = [0, 0, 0, 0, 0, 0];
        const byDayMin = [0, 0, 0, 0, 0, 0];

        for (const a of mine) {
          const di = a.day_of_week != null ? a.day_of_week - 1 : 5; // null → 토(5)
          if (di >= 0 && di <= 5) {
            byDay[di]++;
            byDayMin[di] += a.duration_min;
          }
        }

        const totalMin    = byDayMin.reduce((s, v) => s + v, 0);
        const utilization = Math.min(100, Math.round((totalMin / WEEKLY_AVAIL) * 100));
        return { therapist: t, apptCount: mine.length, totalMin, byDay, byDayMin, utilization };
      });

      setStats(computed);
      setLoading(false);
    })();
  }, [router]);

  // ── 집계 ────────────────────────────────────────────────────
  const totalAppts   = stats.reduce((s, t) => s + t.apptCount, 0);
  const totalMin     = stats.reduce((s, t) => s + t.totalMin, 0);
  const avgUtil      = stats.length ? Math.round(stats.reduce((s, t) => s + t.utilization, 0) / stats.length) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <header className="bg-blue-700 text-white shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/schedule')}
            className="text-blue-300 hover:text-white text-xl leading-none transition-colors"
          >
            ‹
          </button>
          <h1 className="text-base font-bold">📊 주간 통계</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── 요약 카드 ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '총 예약 건수', value: `${totalAppts}건`,      icon: '📋' },
            { label: '총 치료 시간', value: fmtMin(totalMin),       icon: '⏱️' },
            { label: '평균 가동률',  value: `${avgUtil}%`,           icon: '📈' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 px-4 py-4 text-center shadow-sm">
              <div className="text-xl mb-1">{card.icon}</div>
              <div className="text-lg font-bold text-gray-800">{card.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* ── 치료실별 섹션 ── */}
        {ROOM_ORDER.map(roomName => {
          const roomStats = stats.filter(s => s.therapist.room?.name === roomName);
          if (roomStats.length === 0) return null;
          const rs = ROOM_STYLE[roomName] ?? { header: '#6b7280', bar: '#9ca3af', badge: '#f3f4f6', text: '#374151' };
          const roomTotalAppts = roomStats.reduce((s, t) => s + t.apptCount, 0);
          const roomTotalMin   = roomStats.reduce((s, t) => s + t.totalMin, 0);

          return (
            <div key={roomName} className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              {/* 치료실 헤더 */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: rs.header }}>
                <span className="text-white font-bold text-sm">{roomName}</span>
                <span className="text-white text-xs opacity-80">
                  {roomTotalAppts}건 · {fmtMin(roomTotalMin)}
                </span>
              </div>

              {/* 치료사 목록 */}
              <div className="divide-y divide-gray-50">
                {roomStats.map(({ therapist: t, apptCount, totalMin, byDay, byDayMin, utilization }) => (
                  <div key={t.id} className="px-5 py-4">
                    {/* 이름 + 수치 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: rs.badge, color: rs.text }}
                        >
                          {t.name.slice(0, 1)}
                        </div>
                        <span className="font-bold text-gray-800 text-sm">{t.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-gray-700">{apptCount}건</span>
                        <span className="text-xs text-gray-400 ml-2">{fmtMin(totalMin)}</span>
                        <span
                          className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: rs.badge, color: rs.text }}
                        >
                          {utilization}%
                        </span>
                      </div>
                    </div>

                    {/* 가동률 바 */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${utilization}%`, background: rs.bar }}
                      />
                    </div>

                    {/* 요일별 미니 현황 */}
                    <div className="grid grid-cols-6 gap-1">
                      {DAY_KO.map((day, di) => {
                        const cnt = byDay[di];
                        const min = byDayMin[di];
                        const isSat = di === 5;
                        return (
                          <div
                            key={day}
                            className="rounded-lg text-center py-1.5 px-1"
                            style={{
                              background: cnt > 0 ? rs.badge : (isSat ? '#fafafa' : '#f9fafb'),
                              border: `1px solid ${cnt > 0 ? rs.bar + '55' : '#f0f0f0'}`,
                            }}
                          >
                            <div className="text-xs font-semibold" style={{ color: isSat ? '#d97706' : '#6b7280' }}>
                              {day}
                            </div>
                            <div
                              className="text-sm font-bold mt-0.5"
                              style={{ color: cnt > 0 ? rs.text : '#d1d5db' }}
                            >
                              {cnt > 0 ? cnt : '–'}
                            </div>
                            {min > 0 && (
                              <div className="text-xs mt-0.5" style={{ color: rs.text, opacity: 0.7 }}>
                                {Math.round(min / 60 * 10) / 10}h
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
