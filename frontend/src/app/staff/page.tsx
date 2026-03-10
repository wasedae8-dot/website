"use client";

import { useState, useEffect, useRef, useMemo } from 'react';

import API_BASE, { fetchWithAuth } from '../api';



type Staff = {
  id: number;
  name: string;
  is_part_time: boolean;
  facility_id: number;
  is_nurse: boolean;
  is_consultant: boolean;
  is_care_worker: boolean;
  is_driver: boolean;
  is_functional_trainer: boolean;
  is_active: boolean;
  sort_order: number;
  is_available_mon: boolean;
  is_available_tue: boolean;
  is_available_wed: boolean;
  is_available_thu: boolean;
  is_available_fri: boolean;
  is_available_sat: boolean;
  is_available_sun: boolean;
};

type FormState = {
  name: string;
  is_part_time: boolean;
  facility_id: number;
  is_nurse: boolean;
  is_consultant: boolean;
  is_care_worker: boolean;
  is_driver: boolean;
  is_functional_trainer: boolean;
  is_active: boolean;
  is_available_mon: boolean;
  is_available_tue: boolean;
  is_available_wed: boolean;
  is_available_thu: boolean;
  is_available_fri: boolean;
  is_available_sat: boolean;
  is_available_sun: boolean;
};

const defaultForm = (): FormState => ({
  name: '',
  is_part_time: false,
  facility_id: 1,
  is_nurse: false,
  is_consultant: false,
  is_care_worker: false,
  is_driver: false,
  is_functional_trainer: false,
  is_active: true,
  is_available_mon: true,
  is_available_tue: true,
  is_available_wed: true,
  is_available_thu: true,
  is_available_fri: true,
  is_available_sat: true,
  is_available_sun: true,
});

const DAY_ITEMS = [
  { key: 'is_available_mon' as const, label: '月曜' },
  { key: 'is_available_tue' as const, label: '火曜' },
  { key: 'is_available_wed' as const, label: '水曜' },
  { key: 'is_available_thu' as const, label: '木曜' },
  { key: 'is_available_fri' as const, label: '金曜' },
  { key: 'is_available_sat' as const, label: '土曜' },
  { key: 'is_available_sun' as const, label: '日曜' },
];

const ROLE_ITEMS = [
  { key: 'is_nurse' as const, label: '看護師' },
  { key: 'is_consultant' as const, label: '生活相談員' },
  { key: 'is_care_worker' as const, label: '介護職' },
  { key: 'is_functional_trainer' as const, label: '機能訓練指導員' },
  { key: 'is_driver' as const, label: '運転手（送迎可）' },
];

function StaffFormFields({ form, onChange }: {
  form: FormState;
  onChange: (updates: Partial<FormState>) => void;
}) {
  const handleRoleChange = (role: keyof FormState) => {
    const newVal = !form[role];
    const updates: Partial<FormState> = { [role]: newVal };
    if (role === 'is_nurse' && newVal) {
      updates.is_functional_trainer = true;
    }
    onChange(updates);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-1">氏名</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full px-4 py-2 bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          placeholder="例: 山田 太郎"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-1">種別</label>
          <select
            className="w-full px-4 py-2 bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.is_part_time ? 'part' : 'full'}
            onChange={(e) => onChange({ is_part_time: e.target.value === 'part' })}
          >
            <option value="full">常勤（フルタイム）</option>
            <option value="part">パート（時短・曜日固定）</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-1">所属施設</label>
          <select
            className="w-full px-4 py-2 bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.facility_id}
            onChange={(e) => onChange({ facility_id: parseInt(e.target.value) })}
          >
            <option value={1}>サンケア上池台</option>
            <option value={2}>サンケア鵜の木</option>
          </select>
        </div>
      </div>

      {form.is_part_time && (
        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-3">出勤可能曜日</label>
          <div className="grid grid-cols-4 gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
            {DAY_ITEMS.map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={form[key] as boolean}
                    onChange={() => onChange({ [key]: !form[key] })}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 rounded border-2 border-neutral-300 bg-white peer-checked:bg-purple-500 peer-checked:border-purple-500 transition-colors"></div>
                  <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-neutral-700 select-none">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-3">保有資格・担当業務</label>
        <div className="space-y-3 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
          {ROLE_ITEMS.map(({ key, label }) => (
            <label key={key} className={`flex items-center space-x-3 cursor-pointer group ${key === 'is_driver' ? 'border-t border-neutral-200 pt-3 mt-1' : ''}`}>
              <div className="relative flex items-center">
                <input type="checkbox" checked={form[key] as boolean} onChange={() => handleRoleChange(key)} className="peer sr-only" />
                <div className="w-5 h-5 border-2 border-neutral-300 rounded peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                <svg className="absolute w-5 h-5 text-white hidden peer-checked:block pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-neutral-700 group-hover:text-indigo-600 transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editForm, setEditForm] = useState<FormState>(defaultForm());
  const [isSaving, setIsSaving] = useState(false);

  // Drag-and-drop state
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/staff/`);
      if (response.ok) {
        const data = await response.json();
        setStaffList(data);
      } else if (response.status === 401) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.name.trim()) return;
    
    setIsSaving(true);
    const payload = {
      ...form,
      ...(form.is_part_time ? {} : {
        is_available_mon: true, is_available_tue: true, is_available_wed: true,
        is_available_thu: true, is_available_fri: true, is_available_sat: true, is_available_sun: true,
      }),
    };
    try {
      const response = await fetchWithAuth(`${API_BASE}/staff/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setForm(defaultForm());
        fetchStaff();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(`登録に失敗しました: ${data.detail || response.statusText}`);
      }
    } catch (error) {
      console.error("Error creating staff:", error);
      alert("サーバーとの通信に失敗しました。URL設定を確認してください。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      const response = await fetchWithAuth(`${API_BASE}/staff/${id}`, { method: 'DELETE' });


      if (response.ok) fetchStaff();
    } catch (error) {
      console.error("Error deleting staff:", error);
    }
  };

  const openEditModal = (staff: Staff) => {
    setEditingStaff(staff);
    setEditForm({
      name: staff.name,
      is_part_time: staff.is_part_time,
      facility_id: staff.facility_id,
      is_nurse: staff.is_nurse,
      is_consultant: staff.is_consultant,
      is_care_worker: staff.is_care_worker,
      is_driver: staff.is_driver,
      is_functional_trainer: staff.is_functional_trainer,
      is_active: staff.is_active,
      is_available_mon: staff.is_available_mon,
      is_available_tue: staff.is_available_tue,
      is_available_wed: staff.is_available_wed,
      is_available_thu: staff.is_available_thu,
      is_available_fri: staff.is_available_fri,
      is_available_sat: staff.is_available_sat,
      is_available_sun: staff.is_available_sun,
    });
  };

  const handleEditSave = async () => {
    if (!editingStaff) return;
    setIsSaving(true);
    const payload = {
      ...editForm,
      ...(editForm.is_part_time ? {} : {
        is_available_mon: true, is_available_tue: true, is_available_wed: true,
        is_available_thu: true, is_available_fri: true, is_available_sat: true, is_available_sun: true,
      }),
    };
    try {
      const response = await fetchWithAuth(`${API_BASE}/staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setEditingStaff(null);
        fetchStaff();
      }
    } catch (error) {
      console.error("Error updating staff:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Drag-and-drop handlers ──────────────────────────────────────────────────
  const handleDragStart = (index: number, e: React.DragEvent) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = async (dropIndex: number) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    // Reorder locally first for snappy UX
    const newList = [...staffList];
    const [removed] = newList.splice(dragIndex, 1);
    newList.splice(dropIndex, 0, removed);
    setStaffList(newList);
    setDragOverIndex(null);
    dragIndexRef.current = null;

    // Persist to backend
    const orderedIds = newList.map(s => s.id);
    try {
      await fetchWithAuth(`${API_BASE}/staff/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderedIds),
      });

    } catch (err) {
      console.error("Failed to save order:", err);
    }
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
          スタッフ管理
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 h-fit">
          <h2 className="text-xl font-semibold mb-6 text-neutral-800">新規スタッフ登録</h2>
          <form onSubmit={handleSubmit}>
            <StaffFormFields form={form} onChange={(updates) => setForm(prev => ({ ...prev, ...updates }))} />
            <button
              type="submit"
              className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              登録する
            </button>
          </form>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
          <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
            <div>
              <h2 className="text-xl font-semibold text-neutral-800">登録済みスタッフ</h2>
              <p className="text-xs text-neutral-400 mt-0.5">☰ ハンドルをドラッグして並び替えができます</p>
            </div>
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">計 {staffList.length} 名</span>
          </div>

          <div className="overflow-y-auto w-full flex-1">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : staffList.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-500 h-full">
                <svg className="w-16 h-16 text-neutral-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                <p>スタッフがまだ登録されていません</p>
                <p className="text-sm mt-1">左のフォームから追加してください</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 sticky top-0 z-10 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-2 py-4 w-8"></th>
                    <th className="px-4 py-4 font-medium">氏名</th>
                    <th className="px-4 py-4 font-medium">種別</th>
                    <th className="px-4 py-4 font-medium">資格・業務</th>
                    <th className="px-4 py-4 font-medium">出勤可能曜日</th>
                    <th className="px-4 py-4 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {staffList.map((staff, index) => (
                    <tr
                      key={staff.id}
                      draggable
                      onDragStart={(e) => handleDragStart(index, e)}
                      onDragOver={(e) => handleDragOver(index, e)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className={`transition-colors group ${
                        dragOverIndex === index
                          ? 'bg-indigo-100 border-t-2 border-t-indigo-400'
                          : 'hover:bg-indigo-50/30'
                      }`}
                    >
                      {/* Drag handle */}
                      <td className="px-2 py-4 cursor-grab active:cursor-grabbing">
                        <svg className="w-4 h-5 text-neutral-300 group-hover:text-neutral-400 transition-colors mx-auto" fill="none" viewBox="0 0 16 24" stroke="currentColor" strokeWidth={2}>
                          <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none"/>
                          <circle cx="11" cy="6" r="1.2" fill="currentColor" stroke="none"/>
                          <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/>
                          <circle cx="11" cy="12" r="1.2" fill="currentColor" stroke="none"/>
                          <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none"/>
                          <circle cx="11" cy="18" r="1.2" fill="currentColor" stroke="none"/>
                        </svg>
                      </td>
                      <td className="px-4 py-4 font-medium text-neutral-900">{staff.name}</td>
                      <td className="px-4 py-4">
                        {staff.is_part_time ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">パート</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">常勤</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {staff.is_nurse && <span className="px-2 py-1 bg-pink-50 text-pink-700 rounded-md text-xs font-medium border border-pink-100/50">看</span>}
                          {staff.is_consultant && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-100/50">相</span>}
                          {staff.is_care_worker && <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium border border-orange-100/50">介</span>}
                          {staff.is_functional_trainer && <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-md text-xs font-medium border border-teal-100/50">機</span>}
                          {staff.is_driver && <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200/50">🚗</span>}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        {staff.is_part_time ? (
                          <div className="flex flex-wrap gap-1">
                            {staff.is_available_mon && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">月</span>}
                            {staff.is_available_tue && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">火</span>}
                            {staff.is_available_wed && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">水</span>}
                            {staff.is_available_thu && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">木</span>}
                            {staff.is_available_fri && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">金</span>}
                            {staff.is_available_sat && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">土</span>}
                            {staff.is_available_sun && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">日</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                          <button
                            onClick={() => openEditModal(staff)}
                            className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                            title="編集"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={() => handleDelete(staff.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="削除"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingStaff(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <h2 className="text-xl font-bold text-neutral-800">スタッフ情報を編集</h2>
              <button onClick={() => setEditingStaff(null)} className="text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 p-2 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <StaffFormFields form={editForm} onChange={(updates) => setEditForm(prev => ({ ...prev, ...updates }))} />
            </div>
            <div className="flex items-center gap-3 p-6 border-t border-neutral-100 bg-neutral-50 rounded-b-2xl">
              <button
                onClick={() => setEditingStaff(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-200 text-neutral-600 font-medium hover:bg-neutral-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-md transition-all disabled:opacity-60"
              >
                {isSaving ? '保存中...' : '変更を保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
