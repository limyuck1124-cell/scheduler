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
function fmtRange(mon: Date, fri: Date) {
  const m = mon.getMonth() + 1;
  return `${mon.getFullYear()}년 ${m}월 ${mon.getDate()}일 — ${fri.getDate()}일`;
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

  const weekDates = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

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
      <header className="bg-blue-700 text-white shadow-md shrink-0">
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
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0 shadow-sm">
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
          {fmtRange(weekDates[0], weekDates[4])}
        </span>
      </div>

      {/* ── 그리드 ── */}
      <div className="flex-1 overflow-auto">
        <WeeklyGrid
          appointments={appointments}
          therapists={therapists}
          treatmentCodes={treatmentCodes}
          rooms={rooms}
          weekDates={weekDates}
          loading={apptLoading}
          onCellClick={handleCellClick}
          onAppointmentClick={handleAppointmentClick}
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
          onSaved={handleModalSaved}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
}
