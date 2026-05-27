'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import WeeklyGrid, { type AppointmentRow } from '@/components/schedule/WeeklyGrid';
import PatientSearch from '@/components/schedule/PatientSearch';
import AppointmentModal, { type ModalInitData } from '@/components/schedule/AppointmentModal';
import type { Room, Therapist, TreatmentCode } from '@/types/database';

// ── 날짜 유틸 ────────────────────────────────────────────────
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtRange(mon: Date, sat: Date) {
  const m = mon.getMonth() + 1;
  const satStr = sat.getMonth() + 1 !== m
    ? `${sat.getMonth() + 1}월 ${sat.getDate()}일`
    : `${sat.getDate()}일`;
  return `${mon.getFullYear()}년 ${m}월 ${mon.getDate()}일 — ${satStr}`;
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function SchedulePage() {
  const router = useRouter();

  const [userEmail,      setUserEmail]      = useState('');
  const [rooms,          setRooms]          = useState<Room[]>([]);
  const [therapists,     setTherapists]     = useState<(Therapist & { room: Room })[]>([]);
  const [treatmentCodes, setTreatmentCodes] = useState<TreatmentCode[]>([]);
  const [appointments,   setAppointments]   = useState<AppointmentRow[]>([]);
  const [weekStart,      setWeekStart]      = useState<Date>(() => getMondayOfWeek(new Date()));
  const [initLoading,    setInitLoading]    = useState(true);
  const [apptLoading,    setApptLoading]    = useState(false);
  const [loggingOut,     setLoggingOut]     = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);
  const [modalData,      setModalData]      = useState<ModalInitData | null>(null);

  const weekDates = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // 월~토

  // ── 초기 로드 ──────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUserEmail(user.email ?? '');

      const [roomsRes, therapistsRes, codesRes] = await Promise.all([
        supabase.from('rooms').select('*').order('name'),
        supabase.from('therapists').select('*, room:rooms(*)').order('name'),
        supabase.from('treatment_codes').select('*'),
      ]);

      setRooms((roomsRes.data ?? []) as Room[]);
      setTherapists((therapistsRes.data ?? []) as (Therapist & { room: Room })[]);
      setTreatmentCodes((codesRes.data ?? []) as TreatmentCode[]);
      setInitLoading(false);
    })();
  }, [router]);

  // ── 예약 로드 ──────────────────────────────────────────────
  const loadAppointments = useCallback(async () => {
    setApptLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patients(id, name), therapist:therapists(id, name)')
      .order('start_time');
    if (!error) setAppointments((data ?? []) as AppointmentRow[]);
    setApptLoading(false);
  }, []);

  useEffect(() => {
    if (!initLoading) loadAppointments();
  }, [initLoading, loadAppointments]);

  // ── 이벤트 핸들러 ──────────────────────────────────────────
  const handleLogout = async () => {
    setLoggingOut(true);
    await createClient().auth.signOut();
    router.replace('/login');
  };

  const prevWeek  = () => setWeekStart(d => addDays(d, -7));
  const nextWeek  = () => setWeekStart(d => addDays(d, +7));
  const goToToday = () => setWeekStart(getMondayOfWeek(new Date()));

  const isCurrentWeek =
    getMondayOfWeek(new Date()).toDateString() === weekStart.toDateString();

  // 빈 셀 클릭 → 새 예약 모달
  const handleCellClick = useCallback((dayIdx: number, therapistId: string, slotMin: number) => {
    setModalData({ mode: 'create', dayIdx, therapistId, slotMin });
  }, []);

  // 예약 블록 클릭 → 수정 모달
  const handleAppointmentClick = useCallback((appt: AppointmentRow) => {
    setModalData({ mode: 'edit', appointment: appt });
  }, []);

  // 저장/삭제 후 처리
  const handleModalSaved = useCallback(() => {
    setModalData(null);
    loadAppointments();
  }, [loadAppointments]);

  // 예약 이동 (드래그 앤 드롭)
  const handleAppointmentMoved = useCallback(async (
    apptId: string,
    newDayIdx: number,
    newTherapistId: string,
    newSlotMin: number,
  ) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const newTherapist = therapists.find(t => t.id === newTherapistId);
    if (!newTherapist) return;

    // 같은 위치면 무시
    const curDayIdx = appt.day_of_week != null ? appt.day_of_week - 1 : 5;
    const curStartMin = toMin(appt.start_time);
    if (appt.therapist_id === newTherapistId && curDayIdx === newDayIdx && curStartMin === newSlotMin) return;

    const isSat         = newDayIdx === 5;
    const newDayOfWeek  = isSat ? null : newDayIdx + 1;
    const newDate       = isSat ? (weekDates[5]?.toISOString().slice(0, 10) ?? null) : null;
    const newStartTime  = `${Math.floor(newSlotMin / 60)}:${String(newSlotMin % 60).padStart(2, '0')}`;

    // 충돌 체크
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from('appointments') as any)
      .select('start_time, duration_min')
      .eq('therapist_id', newTherapistId)
      .neq('id', apptId);
    q = isSat ? q.eq('date', newDate) : q.eq('day_of_week', newDayOfWeek);
    const { data: existing } = await q;

    type CR = { start_time: string; duration_min: number };
    const s = newSlotMin, e = s + appt.duration_min;
    const hit = (existing ?? [] as CR[]).find((a: CR) => {
      const as2 = toMin(a.start_time); return s < as2 + a.duration_min && e > as2;
    });
    if (hit) {
      const ok = window.confirm(`⚠️ ${hit.start_time.slice(0, 5)}에 이미 예약이 있습니다.\n그래도 이동하시겠습니까?`);
      if (!ok) return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('appointments') as any).update({
      therapist_id: newTherapistId,
      room_id:      newTherapist.room_id,
      day_of_week:  newDayOfWeek,
      date:         newDate,
      start_time:   newStartTime,
    }).eq('id', apptId);

    loadAppointments();
  }, [appointments, therapists, weekDates, loadAppointments]);

  // ── 초기 로딩 화면 ─────────────────────────────────────────
  if (initLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">불러오는 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">

      {/* ── 헤더 ── */}
      <header className="no-print bg-blue-700 text-white shadow-md shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold leading-tight">🏥 재활치료실 통합 스케줄러</h1>
            <p className="text-blue-300 text-xs">작업치료실 · 운동치료실</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-200 hidden sm:block">{userEmail}</span>
            <button
              onClick={() => setShowSearch(true)}
              className="text-xs border border-blue-400 text-blue-100 px-3 py-1.5 rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              🔍 환자 검색
            </button>
            <button
              onClick={() => router.push('/patients')}
              className="text-xs border border-blue-400 text-blue-100 px-3 py-1.5 rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              👤 환자 관리
            </button>
            <button
              onClick={() => router.push('/stats')}
              className="text-xs border border-blue-400 text-blue-100 px-3 py-1.5 rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              📊 통계
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="text-xs border border-blue-400 text-blue-100 px-3 py-1.5 rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              ⚙️ 기준정보
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs border border-blue-400 text-blue-100 px-3 py-1.5 rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              🖨️ 인쇄
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs border border-blue-400 text-blue-100 px-3 py-1.5 rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loggingOut ? '…' : '로그아웃'}
            </button>
          </div>
        </div>
      </header>

      {/* ── 주 네비게이션 ── */}
      <div className="no-print bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0 shadow-sm">
        <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-lg font-bold transition-colors">‹</button>
        <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-lg font-bold transition-colors">›</button>
        <button
          onClick={goToToday}
          disabled={isCurrentWeek}
          className={`text-xs px-2.5 py-1 border rounded transition-colors ${
            isCurrentWeek ? 'border-gray-200 text-gray-300 cursor-default' : 'border-blue-300 text-blue-600 hover:bg-blue-50'
          }`}
        >
          오늘
        </button>
        <span className="text-sm font-semibold text-gray-700 ml-1">
          {fmtRange(weekDates[0], weekDates[5])}
        </span>
      </div>

      {/* ── 그리드 ── */}
      <div className="grid-scroll flex-1 overflow-auto">
        <WeeklyGrid
          appointments={appointments}
          therapists={therapists}
          treatmentCodes={treatmentCodes}
          rooms={rooms}
          weekDates={weekDates}
          loading={apptLoading}
          onCellClick={handleCellClick}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentMoved={handleAppointmentMoved}
        />
      </div>

      {/* ── 환자 검색 모달 ── */}
      {showSearch && (
        <PatientSearch
          treatmentCodes={treatmentCodes}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* ── 예약 등록/수정 모달 ── */}
      {modalData && (
        <AppointmentModal
          initData={modalData}
          therapists={therapists}
          treatmentCodes={treatmentCodes}
          weekDates={weekDates}
          onSaved={handleModalSaved}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
}
