"use client";

import { useState, useEffect, useRef, useMemo } from 'react';

import API_BASE, { fetchWithAuth } from './api';


import { format, getDaysInMonth } from 'date-fns';
import { ja } from 'date-fns/locale';

type Role = 'nurse' | 'consultant' | 'instructor' | 'care' | 'driver';

type StaffAssignment = {
  staff_id: number;
  name: string;
  roles: Role[];
  is_driver?: boolean;
};

type Absence = {
  staff_id: number;
  reason: string; // '休'|'有'|'公'|'夏'
};

type DailySchedule = {
  day: number;
  is_closed: boolean;
  staff: StaffAssignment[];
  absences?: Absence[];
};

type StaffSummary = {
  work_days: number;
  paid_leaves: number;
  public_holidays: number;
};

type OptimizationResult = {
  status: string;
  schedule?: DailySchedule[];
  summary?: Record<number, StaffSummary>;
  all_staff?: Record<number, string>;
  error?: string;
};

export default function Home() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleData, setScheduleData] = useState<OptimizationResult | null>(null);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setScheduleData(null);
    try {
      const response = await fetchWithAuth(`${API_BASE}/generate-schedule/?year=${year}&month=${month}`);

      if (!response.ok) {
        const errorData = await response.json();
        setScheduleData({ status: "failed", error: errorData.detail || "シフト作成に失敗しました" });
        return;
      }
      const data = await response.json();
      setScheduleData(data);
    } catch (error) {
      console.error("Error generating schedule:", error);
      setScheduleData({ status: "failed", error: "API接続エラーが発生しました。" });
    } finally {
      setIsGenerating(false);
    }
  };

  const getDayLabel = (day: number) => {
    const d = new Date(year, month - 1, day);
    return format(d, 'E', { locale: ja });
  };

  const isDayClosed = (day: number) => {
    const d = new Date(year, month - 1, day);
    // Sundays are closed
    if (d.getDay() === 0) return true;
    // Holidays
    if (month === 12 && [29, 30, 31].includes(day)) return true;
    if (month === 1 && [1, 2, 3].includes(day)) return true;
    
    // Check solver result
    const daySchedule = scheduleData?.schedule?.find((s: DailySchedule) => s.day === day);

    return daySchedule?.is_closed || false;
  };

  const getCellColor = (day: number) => {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === 0 || isDayClosed(day)) return 'bg-neutral-200 text-neutral-500'; // Sunday/Closed
    if (d.getDay() === 6) return 'bg-blue-50 text-blue-800'; // Saturday
    return 'bg-white text-neutral-800'; // Weekday
  };

  // Extract all unique staff from the schedule or all_staff mapping
  const allStaff = useMemo(() => {
    if (scheduleData?.all_staff) {
      return Object.entries(scheduleData.all_staff)
        .map(([id, name]: [string, string]) => ({ id: Number(id), name }))
        .sort((a: {id: number}, b: {id: number}) => a.id - b.id);

    }
    
    // Fallback to extraction from schedule if all_staff isn't present
    if (!scheduleData?.schedule) return [];
    const staffMap = new Map<number, string>();
    scheduleData.schedule.forEach(day => {
      day.staff.forEach((s: StaffAssignment) => {
        if (!staffMap.has(s.staff_id)) {
          staffMap.set(s.staff_id, s.name);
        }
      });
      day.absences?.forEach((a: Absence) => {

         if (!staffMap.has(a.staff_id)) {
           // We don't have the name here, so we'd need another source
           staffMap.set(a.staff_id, `Staff ${a.staff_id}`);
         }
      });
    });
    return Array.from(staffMap.entries())
      .map(([id, name]: [number, string]) => ({ id, name }))
      .sort((a: {id: number}, b: {id: number}) => a.id - b.id);

  }, [scheduleData]);

  const renderRoleBadge = (role: Role) => {
    switch (role) {
      case 'nurse': return <span className="inline-flex w-5 h-5 items-center justify-center bg-pink-100 text-pink-700 font-bold text-xs rounded-full shadow-sm">看</span>;
      case 'consultant': return <span className="inline-flex w-5 h-5 items-center justify-center bg-blue-100 text-blue-700 font-bold text-xs rounded-full shadow-sm">相</span>;
      case 'care': return <span className="inline-flex w-5 h-5 items-center justify-center bg-orange-100 text-orange-700 font-bold text-xs rounded-full shadow-sm">介</span>;
      case 'instructor': return <span className="inline-flex w-5 h-5 items-center justify-center bg-teal-100 text-teal-700 font-bold text-xs rounded-full shadow-sm">機</span>;
      case 'driver': return <span className="inline-flex w-5 h-5 items-center justify-center bg-slate-100 text-slate-600 font-bold text-[10px] rounded-full shadow-sm">車</span>;
      default: return null;
    }
  };

  // Calculate daily totals for the bottom row
  const dailyTotals = useMemo(() => {
    if (!scheduleData?.schedule) return {};
    
    const totals: Record<number, { nurse: number; consultant: number; care: number; instructor: number; driver: number; total: number }> = {};
    scheduleData.schedule.forEach((daySchedule: DailySchedule) => {
      const day = daySchedule.day;
      totals[day] = { nurse: 0, consultant: 0, care: 0, instructor: 0, driver: 0, total: 0 };
      
      daySchedule.staff.forEach((s: StaffAssignment) => {
        totals[day].total += 1;
        if (s.is_driver) totals[day].driver += 1;
        s.roles.forEach((r: Role) => {
          if (r !== 'driver') {
            const currentTotal = totals[day][r] || 0;
            totals[day][r as keyof typeof totals[number]] = currentTotal + 1;
          }
        });
      });
    });
    return totals;
  }, [scheduleData]);


  const exportToCsv = () => {
    if (!scheduleData?.schedule || !allStaff.length) return;
    
    // Add BOM for Excel compatibility
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    let csvContent = `氏名 / 日付,${daysArray.map(d => `${d}日`).join(',')},出勤,公休,有休\n`;
    
    allStaff.forEach((staff: { id: number; name: string }) => {
      let rowContent = `"${staff.name}",`;
      const summary = scheduleData.summary?.[staff.id] || { work_days: 0, public_holidays: 0, paid_leaves: 0 };
      
      const dayCells = daysArray.map(day => {
        const daySchedule = scheduleData.schedule?.find((ds: DailySchedule) => ds.day === day);
        if (!daySchedule) return '';
        if (daySchedule.is_closed) return '-';
        
        const assignment = daySchedule.staff.find((s: StaffAssignment) => s.staff_id === staff.id);
        const absence = daySchedule.absences?.find((a: Absence) => a.staff_id === staff.id);
        
        if (assignment) {
          const rMap: Record<string, string> = { 'nurse': '看', 'consultant': '相', 'care': '介', 'instructor': '機', 'driver': '車' };
          let activeRoles = assignment.roles;
          if (activeRoles.includes('driver') && activeRoles.length > 1) {
            activeRoles = activeRoles.filter((r: string) => r !== 'driver');
          }
          return activeRoles.map((r: string) => rMap[r] || r).join('/');
        } else if (absence) {
          return absence.reason;
        } else {
          return '';
        }
      });
      
      rowContent += dayCells.join(',') + `,${summary.work_days},${summary.public_holidays},${summary.paid_leaves}\n`;
      csvContent += rowContent;
    });
    
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `シフト表_${year}年${month}月.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto min-h-screen pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">
            シフト表 ({year}年{month}月)
          </h1>
          <p className="text-neutral-500 mt-1 font-medium">AI最適化エンジン搭載</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-neutral-200">
          <select 
            className="px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-lg text-base font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {[...Array(5)].map((_, i) => (
              <option key={year - 1 + i} value={year - 1 + i}>{year - 1 + i}年</option>
            ))}
          </select>
          <span className="text-neutral-400 font-bold">/</span>
          <select 
            className="px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-lg text-base font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}月</option>
            ))}
          </select>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-bold transition-all shadow-md active:translate-y-0.5 ${
              isGenerating 
                ? 'bg-neutral-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg'
            }`}
          >
            {isGenerating ? (
               <>
                 <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></div>
                 計算中...
               </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                AIシフト自動作成
              </>
            )}
          </button>
          
          <button 
            onClick={exportToCsv}
            disabled={isGenerating || !scheduleData?.schedule}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-bold transition-all shadow-md active:translate-y-0.5 ${
              isGenerating || !scheduleData?.schedule
                ? 'bg-neutral-300 cursor-not-allowed text-neutral-500' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg'
            }`}
            title="CSV形式でエクスポートしてExcelで開くことができます"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            CSV出力
          </button>
        </div>
      </div>

      {scheduleData && scheduleData.status === "failed" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 shadow-sm flex items-start gap-4">
          <svg className="w-6 h-6 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <h3 className="text-lg font-bold mb-1">シフト作成エラー</h3>
            <p className="font-medium text-red-700/80">{scheduleData.error}</p>
          </div>
        </div>
      )}

      {/* Spreadsheet UI */}
      <div className="bg-white rounded-xl shadow-lg border border-neutral-300 overflow-x-auto relative">
        {isGenerating && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-blue-900 font-bold text-lg tracking-widest animate-pulse">数万通りの組み合わせから最適解を計算中...</p>
          </div>
        )}

        <div className="min-w-max">
          {/* Header Row: Days */}
          <div className="flex border-b-2 border-neutral-800 sticky top-0 z-10 bg-white">
            <div className="w-40 shrink-0 p-2 border-r border-neutral-300 flex items-center justify-center font-bold text-sm bg-neutral-100/80 text-neutral-600">
              氏名 / 日付
            </div>
            {daysArray.map(day => (
              <div key={`header-${day}`} className={`w-9 shrink-0 flex flex-col items-center justify-center border-r border-neutral-200 py-1 ${getCellColor(day)}`}>
                <span className="text-sm font-bold">{day}</span>
                <span className="text-[10px] uppercase font-bold opacity-80">{getDayLabel(day)}</span>
              </div>
            ))}
            {/* Tally Column Headers */}
            <div className="w-10 shrink-0 flex flex-col items-center justify-center border-r border-l-2 border-l-neutral-400 border-neutral-200 py-1 bg-blue-50 text-blue-800">
              <span className="text-[10px] font-black">出勤</span>
            </div>
            <div className="w-10 shrink-0 flex flex-col items-center justify-center border-r border-neutral-200 py-1 bg-neutral-100 text-neutral-600">
              <span className="text-[10px] font-black">公休</span>
            </div>
            <div className="w-10 shrink-0 flex flex-col items-center justify-center border-neutral-200 py-1 bg-orange-50 text-orange-800">
              <span className="text-[10px] font-black">有休等</span>
            </div>
          </div>

          {/* Body Rows: Staff */}
          {!scheduleData && !isGenerating && (
            <div className="p-12 text-center text-neutral-400 font-bold bg-neutral-50 border-b border-neutral-200">
              「AIシフト自動作成」ボタンを押してシフトを生成してください
            </div>
          )}

          {allStaff.map((staff, index) => {
            const summary = scheduleData?.summary?.[staff.id];
            // Build absence lookup for this staff: day -> reason
            const absenceMap: Record<number, string> = {};
            scheduleData?.schedule?.forEach((ds: DailySchedule) => {
              const abs = ds.absences?.find((a: Absence) => a.staff_id === staff.id);
              if (abs) absenceMap[ds.day] = abs.reason;
            });

            return (
              <div key={staff.id} className={`flex border-b border-neutral-200 hover:bg-yellow-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                <div className="w-40 shrink-0 p-2 border-r border-neutral-300 font-bold text-sm flex items-center bg-white sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10 text-neutral-800">
                  {staff.name}
                </div>
                
                {daysArray.map(day => {
                  const closed = isDayClosed(day);
                  const daySchedule = scheduleData?.schedule?.find((s: DailySchedule) => s.day === day);
                  const assignment = daySchedule?.staff.find((s: StaffAssignment) => s.staff_id === staff.id);
                  const absenceReason = !closed && !assignment ? absenceMap[day] : undefined;
                  
                  return (
                    <div key={`${staff.id}-${day}`} className={`w-9 shrink-0 border-r border-neutral-200 flex items-center justify-center relative ${closed ? 'bg-neutral-200' : ''}`}>
                      {closed ? (
                        <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.05)_4px,rgba(0,0,0,0.05)_8px)] absolute inset-0"></div>
                      ) : assignment && assignment.roles.length > 0 ? (
                        <div className="flex flex-col gap-0.5 items-center justify-center w-full h-full py-0.5">
                          {assignment.roles
                            .filter(r => {
                              // If they have other roles (like care), hide the driver badge to keep it clean.
                              // Only show 'driver' badge if they have NO other roles.
                              if (r === 'driver' && assignment.roles.length > 1) return false;
                              return true;
                            })
                            .map((r: Role, i: number) => (
                              <div key={i}>{renderRoleBadge(r)}</div>
                            ))}
                        </div>
                      ) : absenceReason ? (
                        <span className={`inline-flex w-5 h-5 items-center justify-center font-bold text-[10px] rounded-full shadow-sm ${
                          absenceReason === '有' ? 'bg-blue-100 text-blue-700' :
                          absenceReason === '夏' ? 'bg-purple-100 text-purple-700' :
                          absenceReason === '休' ? 'bg-red-100 text-red-700' :
                          'bg-neutral-100 text-neutral-500' // 公休
                        }`}>{absenceReason}</span>
                      ) : null}
                    </div>
                  );
                })}

                {/* Tally Cells */}
                <div className="w-10 shrink-0 border-r border-l-2 border-l-neutral-400 border-neutral-200 flex items-center justify-center text-sm font-black bg-blue-50 text-blue-900">
                  {summary ? summary.work_days : ''}
                </div>
                <div className="w-10 shrink-0 border-r border-neutral-200 flex items-center justify-center text-sm font-bold bg-neutral-50 text-neutral-600">
                  {summary ? summary.public_holidays : ''}
                </div>
                <div className="w-10 shrink-0 border-neutral-200 flex items-center justify-center text-sm font-bold bg-orange-50 text-orange-700">
                  {summary ? (summary.paid_leaves > 0 ? summary.paid_leaves : '') : ''}
                </div>
              </div>
            );
          })}

          {/* Footer Rows: Daily Totals */}
          {scheduleData && scheduleData.status === 'success' && (
            <div className="mt-4 border-t-2 border-neutral-800">
              {(['nurse', 'consultant', 'care', 'instructor', 'driver'] as Role[]).map((role, i) => (
                <div key={`total-${role}`} className={`flex border-b border-neutral-200 ${i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}`}>
                  <div className="w-40 shrink-0 p-2 border-r border-neutral-300 font-bold text-xs flex items-center justify-end gap-2 pr-4 bg-neutral-100 sticky left-0 z-10">
                    {role === 'nurse' ? '看護師 合計' : 
                     role === 'consultant' ? '相談員 合計' : 
                     role === 'care' ? '介護職 合計' : 
                     role === 'instructor' ? '機能訓練 合計' : 'ドライバー 合計'}
                    {role === 'driver' 
                      ? <span className="inline-flex w-5 h-5 items-center justify-center bg-slate-200 text-slate-700 font-bold text-xs rounded-full shadow-sm">車</span>
                      : renderRoleBadge(role)}
                  </div>
                  
                  {daysArray.map(day => {
                    const closed = isDayClosed(day);
                    const count = dailyTotals[day]?.[role] || 0;
                    
                    return (
                      <div key={`total-${role}-${day}`} className={`w-9 shrink-0 border-r border-neutral-200 flex items-center justify-center text-sm font-bold ${closed ? 'bg-neutral-200 text-neutral-400' : count > 0 ? 'text-neutral-800' : 'text-neutral-300'}`}>
                        {closed ? '-' : count > 0 ? count : ''}
                      </div>
                    );
                  })}
                  {/* Empty tally cells for footer rows */}
                  <div className="w-10 shrink-0 border-l-2 border-l-neutral-400" />
                  <div className="w-10 shrink-0" />
                  <div className="w-10 shrink-0" />
                </div>
              ))}
              
              {/* Grand Total Row - count unique working staff per day */}
              <div className="flex border-b-2 border-neutral-800 bg-blue-50/50">
                <div className="w-40 shrink-0 p-2 border-r border-neutral-300 font-black text-sm flex items-center justify-end pr-4 text-blue-900 sticky left-0 z-10">
                  総出勤人数
                </div>
                {daysArray.map(day => {
                  const closed = isDayClosed(day);
                  const total = dailyTotals[day]?.total || 0;
                  
                  return (
                    <div key={`grandtotal-${day}`} className={`w-9 shrink-0 border-r border-neutral-200 flex items-center justify-center text-sm font-black ${closed ? 'bg-neutral-200 text-neutral-400' : 'text-blue-900'}`}>
                      {closed ? '-' : total > 0 ? total : ''}
                    </div>
                  );
                })}
                <div className="w-10 shrink-0 border-l-2 border-l-neutral-400" />
                <div className="w-10 shrink-0" />
                <div className="w-10 shrink-0" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
