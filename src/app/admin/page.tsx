'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Room, Therapist, TreatmentCode } from '@/types/database';

type Tab = 'therapists' | 'codes';

type TherapistModal =
  | { mode: 'add' }
  | { mode: 'edit'; therapist: Therapist };

type CodeModal =
  | { mode: 'add' }
  | { mode: 'edit'; code: TreatmentCode };

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('therapists');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [codes, setCodes] = useState<TreatmentCode[]>([]);
  const [loading, setLoading] = useState(true);

  // 치료사 모달
  const [therapistModal, setTherapistModal] = useState<TherapistModal | null>(null);
  const [tName, setTName] = useState('');
  const [tRoomId, setTRoomId] = useState('');
  const [tSaving, setTSaving] = useState(false);

  // 처방코드 모달
  const [codeModal, setCodeModal] = useState<CodeModal | null>(null);
  const [cCode, setCCode] = useState('');
  const [cLabel, setCLabel] = useState('');
  const [cMin, setCMin] = useState(30);
  const [cColor, setCColor] = useState('3b82f6');
  const [cSaving, setCSaving] = useState(false);

  // ── 초기 로드 ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const [roomsRes, therapistsRes, codesRes] = await Promise.all([
        supabase.from('rooms').select('*').order('name'),
        supabase.from('therapists').select('*').order('name'),
        supabase.from('treatment_codes').select('*').order('code'),
      ]);

      setRooms((roomsRes.data ?? []) as Room[]);
      setTherapists((therapistsRes.data ?? []) as Therapist[]);
      setCodes((codesRes.data ?? []) as TreatmentCode[]);
      setLoading(false);
    })();
  }, [router]);

  // ── 치료사 저장 ──────────────────────────────────────────────
  const saveTherapist = async () => {
    if (!tName.trim() || !tRoomId) return;
    setTSaving(true);
    const supabase = createClient();
    if (therapistModal?.mode === 'edit') {
      await (supabase.from('therapists') as any).update({ name: tName.trim(), room_id: tRoomId })
        .eq('id', therapistModal.therapist.id);
    } else {
      await (supabase.from('therapists') as any).insert({ name: tName.trim(), room_id: tRoomId });
    }
    const { data } = await supabase.from('therapists').select('*').order('name');
    setTherapists((data ?? []) as Therapist[]);
    setTherapistModal(null);
    setTSaving(false);
  };

  // ── 치료사 삭제 ──────────────────────────────────────────────
  const deleteTherapist = async (id: string, name: string) => {
    if (!confirm(`"${name}" 치료사를 삭제하면 관련 예약도 모두 삭제됩니다.\n계속할까요?`)) return;
    const supabase = createClient();
    await supabase.from('appointments').delete().eq('therapist_id', id);
    await supabase.from('therapists').delete().eq('id', id);
    setTherapists(prev => prev.filter(t => t.id !== id));
  };

  // ── 처방코드 저장 ────────────────────────────────────────────
  const saveCode = async () => {
    if (!cCode.trim() || !cLabel.trim()) return;
    setCSaving(true);
    const supabase = createClient();
    const payload = {
      code: cCode.trim().toUpperCase(),
      label: cLabel.trim(),
      default_minutes: cMin,
      color_hex: cColor.replace('#', ''),
    };
    if (codeModal?.mode === 'edit') {
      await (supabase.from('treatment_codes') as any).update(payload).eq('code', codeModal.code.code);
    } else {
      await (supabase.from('treatment_codes') as any).insert(payload);
    }
    const { data } = await supabase.from('treatment_codes').select('*').order('code');
    setCodes((data ?? []) as TreatmentCode[]);
    setCodeModal(null);
    setCSaving(false);
  };

  // ── 처방코드 삭제 ────────────────────────────────────────────
  const deleteCode = async (code: string) => {
    if (!confirm(`처방코드 "${code}"를 삭제할까요?`)) return;
    const supabase = createClient();
    await supabase.from('treatment_codes').delete().eq('code', code);
    setCodes(prev => prev.filter(c => c.code !== code));
  };

  // ── 치료사 모달 열기 ─────────────────────────────────────────
  const openAddTherapist = () => {
    setTName('');
    setTRoomId(rooms[0]?.id ?? '');
    setTherapistModal({ mode: 'add' });
  };
  const openEditTherapist = (t: Therapist) => {
    setTName(t.name);
    setTRoomId(t.room_id);
    setTherapistModal({ mode: 'edit', therapist: t });
  };

  // ── 처방코드 모달 열기 ───────────────────────────────────────
  const openAddCode = () => {
    setCCode('');
    setCLabel('');
    setCMin(30);
    setCColor('3b82f6');
    setCodeModal({ mode: 'add' });
  };
  const openEditCode = (c: TreatmentCode) => {
    setCCode(c.code);
    setCLabel(c.label);
    setCMin(c.default_minutes);
    setCColor(c.color_hex);
    setCodeModal({ mode: 'edit', code: c });
  };

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
          <h1 className="text-base font-bold">⚙️ 기준정보 관리</h1>
        </div>
      </header>

      {/* ── 탭 ── */}
      <div className="bg-white border-b border-gray-200 px-4 flex">
        {(['therapists', 'codes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'therapists' ? '👩‍⚕️ 치료사' : '🏷️ 처방코드'}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ── 치료사 관리 ── */}
        {tab === 'therapists' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-700">치료사 목록</h2>
              <button
                onClick={openAddTherapist}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                + 치료사 추가
              </button>
            </div>

            {[...rooms]
              .sort((a, b) => ['운동치료실', '작업치료실'].indexOf(a.name) - ['운동치료실', '작업치료실'].indexOf(b.name))
              .map(room => {
              const THERAPIST_ORDER: Record<string, string[]> = {
                '운동치료실': ['고명석', '정희돈', '권오민', '김유리'],
                '작업치료실': ['김보미', '임혁', '백성종'],
              };
              const order = THERAPIST_ORDER[room.name] ?? [];
              const roomTherapists = therapists
                .filter(t => t.room_id === room.id)
                .sort((a, b) => {
                  const ai = order.indexOf(a.name), bi = order.indexOf(b.name);
                  if (ai === -1 && bi === -1) return a.name.localeCompare(b.name, 'ko');
                  if (ai === -1) return 1; if (bi === -1) return -1;
                  return ai - bi;
                });
              const isJeob = room.name === '작업치료실';
              const rc = isJeob
                ? { bg: '#f0fdf4', border: '#86efac', text: '#15803d', headerBg: '#dcfce7' }
                : { bg: '#f0f9ff', border: '#7dd3fc', text: '#0369a1', headerBg: '#e0f2fe' };

              return (
                <div key={room.id} className="mb-5 rounded-xl overflow-hidden border" style={{ borderColor: rc.border }}>
                  {/* 치료실 헤더 */}
                  <div
                    className="px-4 py-2 flex items-center justify-between"
                    style={{ background: rc.headerBg }}
                  >
                    <span className="text-xs font-bold" style={{ color: rc.text }}>
                      {room.name}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: rc.text }}>
                      {roomTherapists.length}명
                    </span>
                  </div>

                  {/* 치료사 목록 */}
                  {roomTherapists.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-gray-400 text-center bg-white">
                      등록된 치료사가 없습니다
                    </div>
                  ) : (
                    roomTherapists.map((t, i) => (
                      <div
                        key={t.id}
                        className="flex items-center px-4 py-3 bg-white"
                        style={{ borderTop: i === 0 ? `1px solid ${rc.border}` : '1px solid #f3f4f6' }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mr-3"
                          style={{ background: rc.headerBg, color: rc.text }}
                        >
                          {t.name.slice(0, 1)}
                        </div>
                        <span className="flex-1 text-sm font-semibold text-gray-800">{t.name}</span>
                        <button
                          onClick={() => openEditTherapist(t)}
                          className="text-xs text-blue-500 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors mr-1"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => deleteTherapist(t.id, t.name)}
                          className="text-xs text-red-400 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 처방코드 관리 ── */}
        {tab === 'codes' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-700">처방코드 목록</h2>
              <button
                onClick={openAddCode}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                + 처방코드 추가
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {codes.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-400 text-center">
                  등록된 처방코드가 없습니다
                </div>
              ) : (
                codes.map((c, i) => (
                  <div
                    key={c.code}
                    className="flex items-center px-4 py-3"
                    style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}
                  >
                    {/* 색상 뱃지 */}
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 mr-3 flex items-center justify-center text-xs font-bold shadow-sm"
                      style={{ background: `#${c.color_hex}`, color: '#1e293b' }}
                    >
                      {c.code}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-800">{c.code}</div>
                      <div className="text-xs text-gray-500">{c.label} · 기본 {c.default_minutes}분</div>
                    </div>
                    <button
                      onClick={() => openEditCode(c)}
                      className="text-xs text-blue-500 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors mr-1"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deleteCode(c.code)}
                      className="text-xs text-red-400 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 치료사 추가/수정 모달 ── */}
      {therapistModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setTherapistModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-700 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {therapistModal.mode === 'add' ? '➕ 치료사 추가' : '✏️ 치료사 수정'}
              </h3>
              <button onClick={() => setTherapistModal(null)} className="text-blue-300 hover:text-white text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">이름</label>
                <input
                  type="text"
                  value={tName}
                  onChange={e => setTName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTherapist(); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="치료사 이름"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">치료실</label>
                <select
                  value={tRoomId}
                  onChange={e => setTRoomId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setTherapistModal(null)}
                  className="flex-1 border border-gray-300 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={saveTherapist}
                  disabled={!tName.trim() || !tRoomId || tSaving}
                  className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors font-semibold"
                >
                  {tSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 처방코드 추가/수정 모달 ── */}
      {codeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setCodeModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-700 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {codeModal.mode === 'add' ? '➕ 처방코드 추가' : '✏️ 처방코드 수정'}
              </h3>
              <button onClick={() => setCodeModal(null)} className="text-blue-300 hover:text-white text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">코드</label>
                <input
                  type="text"
                  value={cCode}
                  onChange={e => setCCode(e.target.value)}
                  disabled={codeModal.mode === 'edit'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder="예: C, A, COM"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">라벨 (설명)</label>
                <input
                  type="text"
                  value={cLabel}
                  onChange={e => setCLabel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="예: 일반치료"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">기본 치료 시간 (분)</label>
                <input
                  type="number"
                  value={cMin}
                  onChange={e => setCMin(Number(e.target.value))}
                  min={10}
                  step={10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">색상</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={`#${cColor}`}
                    onChange={e => setCColor(e.target.value.replace('#', ''))}
                    className="w-11 h-11 rounded-lg cursor-pointer border border-gray-300 p-0.5"
                  />
                  <div
                    className="flex-1 px-3 py-2.5 rounded-lg text-sm font-bold text-center"
                    style={{ background: `#${cColor}`, color: '#1e293b' }}
                  >
                    {cCode || '코드'} 미리보기
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCodeModal(null)}
                  className="flex-1 border border-gray-300 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={saveCode}
                  disabled={!cCode.trim() || !cLabel.trim() || cSaving}
                  className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors font-semibold"
                >
                  {cSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
