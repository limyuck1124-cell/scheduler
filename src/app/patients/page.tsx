'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Patient } from '@/types/database';

type PatientRow = Patient & { apptCount: number };

export default function PatientsPage() {
  const router = useRouter();
  const [patients,  setPatients]  = useState<PatientRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');

  // 편집 모달
  const [editTarget, setEditTarget] = useState<PatientRow | null>(null);
  const [editName,   setEditName]   = useState('');
  const [editMemo,   setEditMemo]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── 로드 ──────────────────────────────────────────────────
  const loadPatients = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }

    const [pRes, aRes] = await Promise.all([
      supabase.from('patients').select('*').order('name'),
      supabase.from('appointments').select('patient_id').not('patient_id', 'is', null),
    ]);

    const pts  = (pRes.data ?? []) as Patient[];
    const appts = (aRes.data ?? []) as { patient_id: string }[];

    const countMap: Record<string, number> = {};
    for (const a of appts) {
      if (a.patient_id) countMap[a.patient_id] = (countMap[a.patient_id] ?? 0) + 1;
    }

    setPatients(pts.map(p => ({ ...p, apptCount: countMap[p.id] ?? 0 })));
    setLoading(false);
  }, [router]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // ESC 닫기
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditTarget(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // ── 편집 열기 ─────────────────────────────────────────────
  const openEdit = (p: PatientRow) => {
    setEditTarget(p);
    setEditName(p.name);
    setEditMemo(p.memo ?? '');
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  // ── 저장 ──────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await (supabase.from('patients') as any).update({
      name: editName.trim(),
      memo: editMemo.trim() || null,
    }).eq('id', editTarget.id);

    setPatients(prev => prev.map(p =>
      p.id === editTarget.id
        ? { ...p, name: editName.trim(), memo: editMemo.trim() || null }
        : p
    ));
    setEditTarget(null);
    setSaving(false);
  };

  // ── 삭제 ──────────────────────────────────────────────────
  const deletePatient = async (p: PatientRow) => {
    const msg = p.apptCount > 0
      ? `"${p.name}" 환자를 삭제하면\n관련 예약 ${p.apptCount}건도 함께 삭제됩니다.\n계속할까요?`
      : `"${p.name}" 환자를 삭제할까요?`;
    if (!confirm(msg)) return;

    const supabase = createClient();
    if (p.apptCount > 0) {
      await supabase.from('appointments').delete().eq('patient_id', p.id);
    }
    await supabase.from('patients').delete().eq('id', p.id);
    setPatients(prev => prev.filter(pt => pt.id !== p.id));
  };

  // ── 필터 ──────────────────────────────────────────────────
  const filtered = patients.filter(p =>
    !query.trim() || p.name.includes(query.trim())
  );

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
          <h1 className="text-base font-bold">👤 환자 관리</h1>
          <span className="text-blue-300 text-xs ml-auto">{patients.length}명</span>
        </div>
      </header>

      {/* ── 검색 ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="이름으로 검색..."
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >✕</button>
          )}
        </div>
      </div>

      {/* ── 환자 목록 ── */}
      <div className="max-w-2xl mx-auto px-4 py-4">

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <span className="text-4xl">👤</span>
            <span className="text-sm">
              {query ? `"${query}"에 해당하는 환자가 없습니다` : '등록된 환자가 없습니다'}
            </span>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* 검색 결과 수 */}
            {query && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 font-semibold">
                "{query}" 검색 결과 {filtered.length}명
              </div>
            )}

            {filtered.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}
              >
                {/* 아바타 */}
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0 mr-3">
                  {p.name.slice(0, 1)}
                </div>

                {/* 이름 + 메모 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                  {p.memo
                    ? <div className="text-xs text-gray-400 truncate">{p.memo}</div>
                    : <div className="text-xs text-gray-300">메모 없음</div>
                  }
                </div>

                {/* 예약 건수 뱃지 */}
                <div
                  className="shrink-0 mx-3 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={
                    p.apptCount > 0
                      ? { background: '#dbeafe', color: '#1d4ed8' }
                      : { background: '#f3f4f6', color: '#9ca3af' }
                  }
                >
                  {p.apptCount > 0 ? `예약 ${p.apptCount}건` : '예약 없음'}
                </div>

                {/* 버튼 */}
                <button
                  onClick={() => openEdit(p)}
                  className="text-xs text-blue-500 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={() => deletePatient(p)}
                  className="text-xs text-red-400 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors ml-1"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 편집 모달 ── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditTarget(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-700 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">✏️ 환자 정보 수정</h3>
              <button onClick={() => setEditTarget(null)} className="text-blue-300 hover:text-white text-lg">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">이름</label>
                <input
                  ref={nameRef}
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="환자 이름"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">메모 <span className="font-normal text-gray-400">(선택)</span></label>
                <textarea
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 resize-none"
                  placeholder="동명이인 구분, 특이사항 등..."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditTarget(null)}
                  className="flex-1 border border-gray-300 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={saveEdit}
                  disabled={!editName.trim() || saving}
                  className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors font-semibold"
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
