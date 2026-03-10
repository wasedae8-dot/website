"use client";

import { useState, useEffect } from 'react';
import API_BASE, { fetchWithAuth } from '../api';


import { format, getDaysInMonth, addMonths, subMonths, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';

type Staff = {
  id: number;
  name: string;
};

type LeaveRequest = {
  id: number;
  staff_id: number;
  date: string;
  reason: string;
  is_summer_vacation: boolean;
};

// Mode for which type of leave is being selected
type SelectMode = '希望休' | '有給' | '夏期休暇';

export default function RequestsManagement() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Staff selection
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  
  // Mode: which type is being added
  const [selectMode, setSelectMode] = useState<SelectMode>('希望休');
  
  // Separate date selections for each type
  const [kyukaDates, setKyukaDates] = useState<Date[]>([]);    // 希望休
  const [yukyuDates, setYukyuDates] = useState<Date[]>([]);   // 有給
  const [natsuDates, setNatsuDates] = useState<Date[]>([]);   // 夏期休暇
  
  // Calendar View state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [staffRes, reqRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/staff`),
        fetchWithAuth(`${API_BASE}/requests`)
      ]);

      if (staffRes.ok && reqRes.ok) {
        setStaffList(await staffRes.json());
        setRequests(await reqRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const clearAllSelections = () => {
    setKyukaDates([]);
    setYukyuDates([]);
    setNatsuDates([]);
  };

  const getSelectedDatesForMode = (mode: SelectMode) => {
    if (mode === '希望休') return kyukaDates;
    if (mode === '有給') return yukyuDates;
    return natsuDates;
  };

  const setSelectedDatesForMode = (mode: SelectMode, updater: (prev: Date[]) => Date[]) => {
    if (mode === '希望休') setKyukaDates(updater);
    else if (mode === '有給') setYukyuDates(updater);
    else setNatsuDates(updater);
  };

  const getDateType = (date: Date): SelectMode | null => {
    if (kyukaDates.some(d => isSameDay(d, date))) return '希望休';
    if (yukyuDates.some(d => isSameDay(d, date))) return '有給';
    if (natsuDates.some(d => isSameDay(d, date))) return '夏期休暇';
    return null;
  };

  const handleDateClick = (date: Date) => {
    if (!selectedStaffId) { alert("先にスタッフを選択してください。"); return; }

    // If date is already selected in ANY mode, remove it from that mode
    const existingType = getDateType(date);
    if (existingType) {
      setSelectedDatesForMode(existingType, prev => prev.filter(d => !isSameDay(d, date)));
      return;
    }

    // Otherwise add to current mode
    setSelectedDatesForMode(selectMode, prev => [...prev, date]);
  };

  const totalSelected = kyukaDates.length + yukyuDates.length + natsuDates.length;

  const handleSubmit = async () => {
    if (!selectedStaffId) { alert("スタッフを選択してください。"); return; }
    if (totalSelected === 0) { alert("日付を一つ以上選択してください。"); return; }

    try {
      const allRequests: { staff_id: number; date: string; reason: string; is_summer_vacation: boolean }[] = [];

      kyukaDates.forEach(date => {
        allRequests.push({ staff_id: Number(selectedStaffId), date: format(date, 'yyyy-MM-dd'), reason: '希望休', is_summer_vacation: false });
      });
      yukyuDates.forEach(date => {
        allRequests.push({ staff_id: Number(selectedStaffId), date: format(date, 'yyyy-MM-dd'), reason: '有給', is_summer_vacation: false });
      });
      natsuDates.forEach(date => {
        allRequests.push({ staff_id: Number(selectedStaffId), date: format(date, 'yyyy-MM-dd'), reason: '夏期休暇', is_summer_vacation: true });
      });

      const promises = allRequests.map(req =>
        fetchWithAuth(`${API_BASE}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        })
      );

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok).length;

      if (failed > 0) {
        alert(`${failed}件の登録に失敗しました。`);
      } else {
        clearAllSelections();
        fetchData();
        alert(`${allRequests.length}件の休み申請を一括登録しました！`);
      }
    } catch (error) {
      console.error("Error creating request:", error);
      alert("エラーが発生しました。");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      const response = await fetchWithAuth(`${API_BASE}/requests/${id}`, { method: 'DELETE' });


      if (response.ok) fetchData();
    } catch (error) {
      console.error("Error deleting request:", error);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`全${requests.length}件の希望休・休暇データを一括削除します。\nよろしいですか？`)) return;
    setIsDeleting(true);
    try {
      const promises = requests.map(req =>
        fetchWithAuth(`${API_BASE}/requests/${req.id}`, { method: 'DELETE' })


      );
      await Promise.all(promises);
      fetchData();
    } catch (error) {
      console.error("Error deleting all requests:", error);
      alert("一部の削除に失敗した可能性があります。");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStaffName = (id: number) => staffList.find(s => s.id === id)?.name || '不明';

  // Calendar helpers
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const calendarDays: (Date | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1))
  ];

  const getExistingRequest = (date: Date) => {
    if (!selectedStaffId) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    return requests.find(r => r.staff_id === Number(selectedStaffId) && r.date === dateStr);
  };

  const MODE_CONFIG: Record<SelectMode, { color: string; bgActive: string; badge: string; label: string }> = {
    '希望休': { color: 'text-emerald-700', bgActive: 'bg-emerald-500 border-emerald-600 text-white', badge: 'bg-emerald-100 text-emerald-800', label: '希望休' },
    '有給':   { color: 'text-blue-700',    bgActive: 'bg-blue-500 border-blue-600 text-white',     badge: 'bg-blue-100 text-blue-800',   label: '有給休暇' },
    '夏期休暇': { color: 'text-orange-700',  bgActive: 'bg-orange-500 border-orange-600 text-white', badge: 'bg-orange-100 text-orange-800', label: '夏期休暇' },
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600">
          希望休・休暇 まとめて登録
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Step 1: Staff Selection */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 w-8 h-8 rounded-full flex items-center justify-center font-black">1</span>
              スタッフを選択
            </h2>
            <select
              value={selectedStaffId}
              onChange={(e) => {
                setSelectedStaffId(e.target.value ? parseInt(e.target.value) : '');
                clearAllSelections();
              }}
              className="w-full px-4 py-3 bg-neutral-50 text-neutral-900 border-2 border-neutral-200 rounded-xl focus:ring-0 focus:border-emerald-500 font-bold text-lg cursor-pointer"
            >
              <option value="" disabled>▼ スタッフを選択してください</option>
              {staffList.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Mode + Calendar */}
          <div className={`bg-white p-6 rounded-2xl shadow-lg border border-neutral-200 transition-opacity duration-300 ${!selectedStaffId ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 w-8 h-8 rounded-full flex items-center justify-center font-black">2</span>
                種類を選んで日付をタップ
              </h2>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex gap-2 mb-4 p-1 bg-neutral-100 rounded-xl">
              {(Object.keys(MODE_CONFIG) as SelectMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSelectMode(mode)}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${selectMode === mode ? 'bg-white shadow-md text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${mode === '希望休' ? 'bg-emerald-400' : mode === '有給' ? 'bg-blue-400' : 'bg-orange-400'}`}></span>
                  {MODE_CONFIG[mode].label}
                  {getSelectedDatesForMode(mode).length > 0 && (
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${MODE_CONFIG[mode].badge} font-black`}>
                      {getSelectedDatesForMode(mode).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Calendar Navigation */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3 bg-neutral-100 rounded-lg p-1">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white rounded-md">
                  <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="font-bold text-lg min-w-[110px] text-center">{format(currentMonth, 'yyyy年 M月')}</div>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white rounded-md">
                  <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <p className="text-sm text-neutral-500 font-medium">
                現在のモード：<strong className={MODE_CONFIG[selectMode].color}>{MODE_CONFIG[selectMode].label}</strong>
              </p>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                <div key={d} className={`text-center font-bold text-sm py-1.5 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-neutral-500'}`}>{d}</div>
              ))}
              
              {calendarDays.map((date, i) => {
                if (!date) return <div key={`e-${i}`} className="h-14 rounded-xl bg-neutral-50/50" />;

                const dateType = getDateType(date);
                const isSelected = dateType !== null;
                const existingRequest = getExistingRequest(date);
                const isSun = date.getDay() === 0;

                let cellStyle = 'bg-white border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50';
                if (existingRequest) {
                  cellStyle = 'bg-neutral-100 border-neutral-200 cursor-not-allowed opacity-70';
                } else if (isSelected && dateType) {
                  const cfg = MODE_CONFIG[dateType];
                  cellStyle = `${cfg.bgActive} shadow-md transform scale-[1.02]`;
                }

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    disabled={!!existingRequest}
                    className={`h-14 rounded-xl relative flex flex-col items-center justify-center border-2 transition-all font-bold ${cellStyle}`}
                  >
                    <span className={`text-base ${isSelected ? 'text-white' : isSun ? 'text-red-500' : date.getDay() === 6 ? 'text-blue-500' : 'text-neutral-700'}`}>
                      {format(date, 'd')}
                    </span>
                    {isSelected && dateType && (
                      <span className="text-[9px] leading-none font-black text-white/90 mt-0.5">{dateType}</span>
                    )}
                    {existingRequest && (
                      <span className="text-[9px] text-neutral-500 font-bold leading-none mt-0.5">登録済</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Submission Summary */}
            {totalSelected > 0 && (
              <div className="mt-6 p-4 bg-neutral-50 border-2 border-neutral-200 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-wrap gap-2 text-sm font-bold text-neutral-700">
                  {kyukaDates.length > 0 && <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">希望休 {kyukaDates.length}日</span>}
                  {yukyuDates.length > 0 && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">有給 {yukyuDates.length}日</span>}
                  {natsuDates.length > 0 && <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full">夏期休暇 {natsuDates.length}日</span>}
                  <span className="text-neutral-500">計 {totalSelected}件</span>
                </div>
                <button
                  onClick={handleSubmit}
                  className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  まとめて一括登録する
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Registered List */}
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-neutral-200 flex flex-col h-[700px] lg:h-auto">
          <div className="p-5 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl flex justify-between items-center sticky top-0">
            <div>
              <h2 className="text-lg font-bold text-neutral-800">登録済みの休み</h2>
              <span className="text-sm text-neutral-500 font-medium">計 {requests.length} 件</span>
            </div>
            {requests.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-all text-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                {isDeleting ? '削除中...' : '全件削除'}
              </button>
            )}
          </div>

          <div className="overflow-y-auto w-full flex-1 p-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-neutral-400 h-full">
                <p className="font-bold">データがありません</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {requests.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((req) => {
                  const isYukyu = req.reason === '有給' || req.reason.includes('有給') || req.reason.includes('有休');
                  const isNatsu = req.is_summer_vacation || req.reason.includes('夏');
                  const badgeColor = isNatsu ? 'bg-orange-100 text-orange-800' : isYukyu ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800';
                  const barColor = isNatsu ? 'bg-orange-400' : isYukyu ? 'bg-blue-400' : 'bg-emerald-400';

                  return (
                    <div key={req.id} className="group relative flex items-center justify-between p-3 rounded-xl border border-neutral-200 hover:border-neutral-400 overflow-hidden bg-white shadow-sm transition-colors">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${barColor}`}></div>
                      
                      <div className="pl-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-neutral-800 tracking-tight">
                            {format(new Date(req.date), 'M月d日 (E)', { locale: ja })}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${badgeColor}`}>{req.reason}</span>
                        </div>
                        <div className="text-sm font-bold text-neutral-600 mt-0.5">{getStaffName(req.staff_id)}</div>
                      </div>

                      <button
                        onClick={() => handleDelete(req.id)}
                        className="text-red-400 hover:text-white bg-white hover:bg-red-500 shadow-sm border border-red-100 w-9 h-9 flex items-center justify-center rounded-lg transition-all opacity-0 group-hover:opacity-100 mr-0.5 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
