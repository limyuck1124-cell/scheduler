'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Patient, Appointment, TreatmentCode } from '@/types/database';

// ── 타입 ────────────────────────────────────────────────────
type ApptRow = Appointment & {
  therapist: { name: string } | null;
  room:      { name: string } | null;
};

// ── 상수 ────────────────────────────────────────────────────
const DAY_KO: Record<number, string> = {
  1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토',
};

const ROOM_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  '작업치료실': { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  '운동치료실': { bg: '#f0f9ff', text: '#0369a1', border: '#7dd3fc' },
};

// ── Props ────────────────────────────────────────────────────
interface Props {
  treatmentCodes: TreatmentCode[];
  onClose: () => void;
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function PatientSearch({ treatmentCodes, onClose }: Props) {
  const [query,           setQuery]           = useState('');
  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [selected,        setSelected]        = useState<Patient | null>(null);
  const [appointments,    setAppointments]    = useState<ApptRow[]>([]);
  const [searching,       setSearching]       = useState(false);
  const [loadingAppts,    setLoadingAppts]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const codeMap = Object.fromEntries(treatmentCodes.map(c => [c.code, c]));

  // 열릴 때 포커스 + ESC 닫기
  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 실시간 검색 (300ms 디바운스)
  useEffect(() => {
    const q = query.trim();
    if (!q) { setPatients([]); setSelected(null); return; }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await createClient()
        .from('patients')
        .select('*')
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(30);
      setPatients((data ?? []) as Patient[]);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 환자 선택 → 예약 로드
  const handleSelect = useCallback(async (patient: Patient) => {
    setSelected(patient);
    setLoadingAppts(true);
    const { data } = await createClient()
      .from('appointments')
      .select('*, therapist:therapists(name), room:rooms(name)')
      .eq('patient_id', patient.id)
      .order('day_of_week', { nullsFirst: false })
      .order('start_time');
    setAppointments((data ?? []) as ApptRow[]);
    setLoadingAppts(false);
  }, []);

  const handleBack = () => setSelected(null);

  return (
    /* 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-14"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
           style={{ maxHeight: 'calc(100vh - 80px)' }}>

        {/* ── 헤더 ── */}
        <div className="bg-blue-700 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-sm">🔍 환자 검색</h2>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white text-lg leading-none transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* ── 검색 입력 ── */}
        <div className="px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); }}
              placeholder="환자 이름 입력 (예: 홍길동)"
              className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {query && !searching && (
              <button
                onClick={() => { setQuery(''); setSelected(null); setPatients([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── 본문 ── */}
        <div className="flex-1 overflow-auto">

          {/* 초기 안내 */}
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-2">
              <span className="text-3xl">👤</span>
              <span className="text-sm">환자 이름을 입력하면 바로 검색됩니다</span>
            </div>
          )}

          {/* 검색 결과 없음 */}
          {query.trim() && !searching && patients.length === 0 && !selected && (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-2">
              <span className="text-3xl">🔎</span>
              <span className="text-sm">
                <strong className="text-gray-600">"{query}"</strong>에 해당하는 환자가 없습니다
              </span>
            </div>
          )}

          {/* 환자 목록 */}
          {!selected && patients.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {patients.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => handleSelect(p)}
                    className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors flex items-center gap-3"
                  >
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {p.name.slice(0, 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                      {p.memo && (
                        <div className="text-xs text-gray-400 truncate">{p.memo}</div>
                      )}
                    </div>
                    <span className="text-blue-400 text-base shrink-0">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 환자 상세 */}
          {selected && (
            <div>
              {/* 뒤로가기 */}
              <button
                onClick={handleBack}
                className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100 flex items-center gap-1 transition-colors"
              >
                ‹ 검색 결과로 돌아가기
              </button>

              <div className="px-5 pt-4 pb-5">
                {/* 환자 정보 */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
                    {selected.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{selected.name}</h3>
                    {selected.memo
                      ? <p className="text-sm text-gray-500">{selected.memo}</p>
                      : <p className="text-xs text-gray-400">메모 없음</p>
                    }
                  </div>
                </div>

                {/* 예약 현황 */}
                {loadingAppts ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    등록된 예약이 없습니다
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
                      예약 현황 ({appointments.length}건)
                    </div>
                    <div className="space-y-2">
                      {appointments.map(appt => {
                        const rs    = ROOM_STYLE[appt.room?.name ?? ''] ?? { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' };
                        const code  = appt.treatment_code ? codeMap[appt.treatment_code] : null;
                        const day   = appt.day_of_week
                          ? DAY_KO[appt.day_of_week]
                          : appt.date
                          ? `${appt.date.slice(5).replace('-', '/')}(토)`
                          : '-';

                        return (
                          <div
                            key={appt.id}
                            className="rounded-lg border p-3 flex items-center gap-3"
                            style={{ background: rs.bg, borderColor: rs.border }}
                          >
                            {/* 요일 뱃지 */}
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 text-white"
                              style={{ background: '#d97706' }}
                            >
                              {day}
                            </div>

                            {/* 시간 */}
                            <div className="shrink-0 w-14">
                              <div className="font-bold text-gray-800 text-sm leading-tight">
                                {appt.start_time.slice(0, 5)}
                              </div>
                              <div className="text-xs text-gray-400">{appt.duration_min}분</div>
                            </div>

                            {/* 치료실 · 치료사 */}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold leading-tight" style={{ color: rs.text }}>
                                {appt.room?.name}
                              </div>
                              <div className="text-sm text-gray-700 leading-tight">
                                {appt.therapist?.name ?? '—'}
                              </div>
                            </div>

                            {/* 처방코드 */}
                            {code && (
                              <div
                                className="shrink-0 px-2 py-1 rounded text-xs font-bold"
                                style={{ background: `#${code.color_hex}55`, color: '#1f2937', border: `1px solid #${code.color_hex}` }}
                              >
                                {appt.treatment_code}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
