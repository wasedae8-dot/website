from ortools.sat.python import cp_model
from typing import List, Dict, Any
import datetime
import random
try:
    import jpholiday
    HAS_JPHOLIDAY = True
except ImportError:
    HAS_JPHOLIDAY = False

def solve_schedule(year: int, month: int, staff_list: List[Dict], requests: List[Dict]) -> Dict[str, Any]:
    """
    Generates a shift schedule based on staff skills, monthly calendar constraints, and leave requests.
    """
    model = cp_model.CpModel()
    
    # 1. Establish the Calendar
    if month == 12:
        next_month_date = datetime.date(year + 1, 1, 1)
    else:
        next_month_date = datetime.date(year, month + 1, 1)
    
    num_days = (next_month_date - datetime.date(year, month, 1)).days
    
    operating_days = []
    closed_days = []
    # 公休日数 = Saturdays + Sundays + Japanese national holidays
    # Sundays → facility closed (no one works)
    # Saturdays + national holidays falling on weekdays → full-timers rotate off (公休シフト制)
    public_holiday_count = 0  # total Sat + Sun + national holidays
    
    for d in range(1, num_days + 1):
        current_date = datetime.date(year, month, d)
        is_saturday = current_date.weekday() == 5
        is_sunday = current_date.weekday() == 6
        is_national_holiday = HAS_JPHOLIDAY and jpholiday.is_holiday(current_date)
        
        # Count ALL weekends and national holidays as 公休 for full-timers
        if is_saturday or is_sunday or is_national_holiday:
            public_holiday_count += 1
        
        # Only Sundays (and year-end/new-year) close the facility
        is_closed = (current_date.month == 12 and current_date.day in [29, 30, 31]) or \
                    (current_date.month == 1 and current_date.day in [1, 2, 3]) or \
                    is_sunday
                    
        if is_closed:
            closed_days.append(d)
        else:
            operating_days.append(d)

    # Required daily placements
    req_nurse = 1
    req_consultant = 1
    req_care = 5
    req_driver = 4

    num_staff = len(staff_list)
    
    if num_staff == 0:
        return {"error": "スタッフが登録されていません。"}

    # Build a set of (staff_id, day) that have a leave request
    leave_request_days = set()  # (staff_id, day)
    for req in requests:
        req_date = datetime.datetime.strptime(req['date'], "%Y-%m-%d").date()
        if req_date.year == year and req_date.month == month:
            leave_request_days.add((req['staff_id'], req_date.day))

    # 2. Variables
    shifts = {}
    for s in range(num_staff):
        for d in range(1, num_days + 1):
            shifts[(s, d)] = model.NewBoolVar(f'shift_s{s}_d{d}')
            
            # Closed days: no one works
            if d in closed_days:
                model.Add(shifts[(s, d)] == 0)
                continue
                
            staff_dict = staff_list[s]
            current_date = datetime.date(year, month, d)
            weekday = current_date.weekday()  # 0=Mon ... 6=Sun
            
            DAY_FLAGS = {0: 'is_available_mon', 1: 'is_available_tue', 2: 'is_available_wed',
                         3: 'is_available_thu', 4: 'is_available_fri', 5: 'is_available_sat', 6: 'is_available_sun'}
            
            if staff_dict.get('is_part_time'):
                flag = DAY_FLAGS.get(weekday)
                is_contracted_day = flag and staff_dict.get(flag, False)
                has_leave = (staff_dict['id'], d) in leave_request_days
                
                if not is_contracted_day:
                    # Cannot work on non-contracted days
                    model.Add(shifts[(s, d)] == 0)
                elif not has_leave:
                    # MUST work on contracted days unless they have a leave request
                    model.Add(shifts[(s, d)] == 1)
                # else: has leave → allowed to be off
            else:
                # Full-time driver-only staff: must work every operating day unless leave requested
                is_driver_only = staff_dict.get('is_driver') and \
                    not staff_dict.get('is_care_worker') and \
                    not staff_dict.get('is_nurse') and \
                    not staff_dict.get('is_consultant') and \
                    not staff_dict.get('is_functional_trainer')
                if is_driver_only and d in operating_days:
                    has_leave = (staff_dict['id'], d) in leave_request_days
                    if not has_leave:
                        model.Add(shifts[(s, d)] == 1)

    # role_assignments[(s, d, role)]: 1 if staff s acts as 'role' on day d
    roles = ['nurse', 'consultant', 'instructor', 'care', 'driver']
    role_assignments = {}
    for s in range(num_staff):
        staff_dict = staff_list[s]
        is_driver_only = staff_dict.get('is_driver') and not staff_dict.get('is_care_worker')
        
        for d in operating_days:
            for r in roles:
                role_assignments[(s, d, r)] = model.NewBoolVar(f'role_s{s}_d{d}_{r}')
                
                # Check staff qualifications
                has_qual = False
                if r == 'nurse' and staff_dict.get('is_nurse'): has_qual = True
                if r == 'consultant' and staff_dict.get('is_consultant'): has_qual = True
                if r == 'instructor' and staff_dict.get('is_functional_trainer'): has_qual = True
                if r == 'care' and staff_dict.get('is_care_worker'): has_qual = True
                if r == 'driver' and staff_dict.get('is_driver'): has_qual = True
                
                if not has_qual:
                    model.Add(role_assignments[(s, d, r)] == 0)
            
            # Exclusivity Constraints
            # 1. Nurse → cannot hold any other role
            model.Add(sum(role_assignments[(s, d, r)] for r in roles if r != 'nurse') == 0).OnlyEnforceIf(role_assignments[(s, d, 'nurse')])
            
            # 2. Consultant → cannot hold any other role
            model.Add(sum(role_assignments[(s, d, r)] for r in roles if r != 'consultant') == 0).OnlyEnforceIf(role_assignments[(s, d, 'consultant')])
            
            # 3. Driver who is also a care_worker MUST hold care role when working driver
            if staff_dict.get('is_driver') and staff_dict.get('is_care_worker'):
                # If assigned as driver → MUST ALSO be assigned as care
                model.Add(role_assignments[(s, d, 'care')] == 1).OnlyEnforceIf(role_assignments[(s, d, 'driver')])
            
            # 4. Driver-only staff should not be assigned care
            if is_driver_only:
                model.Add(role_assignments[(s, d, 'care')] == 0)
            
            # Max 2 roles per person per day (e.g. care + driver)
            model.Add(sum(role_assignments[(s, d, r)] for r in roles) <= 2)
            
            # Must have at least one role if working
            model.Add(sum(role_assignments[(s, d, r)] for r in roles) >= shifts[(s, d)])
            # No role if not working
            model.Add(sum(role_assignments[(s, d, r)] for r in roles) == 0).OnlyEnforceIf(shifts[(s, d)].Not())

    # 3. Facility Requirements (Hard Constraints per Day)
    for d in operating_days:
        model.Add(sum(role_assignments[(s, d, 'nurse')] for s in range(num_staff)) >= req_nurse)
        model.Add(sum(role_assignments[(s, d, 'consultant')] for s in range(num_staff)) >= req_consultant)
        model.Add(sum(role_assignments[(s, d, 'care')] for s in range(num_staff)) >= req_care)
        model.Add(sum(role_assignments[(s, d, 'driver')] for s in range(num_staff)) >= req_driver)
        # 看護師 + 機能訓練指導員 の合計は 2 以上
        model.Add(
            sum(role_assignments[(s, d, 'nurse')] for s in range(num_staff)) +
            sum(role_assignments[(s, d, 'instructor')] for s in range(num_staff)) >= 2
        )

    # 4. Monthly Workday Targets
    # For full-timers: target = num_days - (Sat+Sun+holiday) - paid_leave_days
    staff_targets = {}  # index -> target_work_days
    for s in range(num_staff):
        staff_data = staff_list[s]
        
        paid_leave_days = 0
        for req in requests:
            if req['staff_id'] == staff_data['id']:
                req_date = datetime.datetime.strptime(req['date'], "%Y-%m-%d").date()
                if req_date.year == year and req_date.month == month:
                    reason = req.get('reason', '')
                    if req.get('is_summer_vacation') or '有給' in reason or '有休' in reason or '夏休' in reason:
                        paid_leave_days += 1

        if not staff_data.get('is_part_time'):
            # 公休日数 = 土曜 + 日曜 + 祝日 の合計（シフト制）
            target_work_days = num_days - public_holiday_count - paid_leave_days
            staff_targets[s] = target_work_days
            # Must work between target-1 and target days
            model.Add(sum(shifts[(s, d)] for d in operating_days) >= target_work_days - 1)
            model.Add(sum(shifts[(s, d)] for d in operating_days) <= target_work_days)

    # 5. Leave Requests (Soft Constraints → Objective terms)
    objective_terms = []
    
    for req in requests:
        req_date = datetime.datetime.strptime(req['date'], "%Y-%m-%d").date()
        if req_date.year == year and req_date.month == month:
            d = req_date.day
            staff_id = req['staff_id']
            s_idx = next((i for i, v in enumerate(staff_list) if v['id'] == staff_id), -1)
            
            if s_idx != -1 and d in operating_days:
                if req.get('is_summer_vacation'):
                    objective_terms.append(shifts[(s_idx, d)].Not() * 100)
                else:
                    objective_terms.append(shifts[(s_idx, d)].Not() * 10)

    # 6. No 5 consecutive workdays (Soft Constraint - penalty-based)
    # Add penalty when 5 consecutive days are all worked
    for s in range(num_staff):
        staff_data = staff_list[s]
        # Only apply for full-time staff (part-timers only work contracted days anyway)
        if not staff_data.get('is_part_time'):
            for start_d in range(1, num_days - 3):
                # Check if 5 consecutive days (start_d to start_d+4) are all operating days
                window = [start_d + i for i in range(5) if (start_d + i) in operating_days]
                if len(window) == 5:
                    # Create a boolean for "all 5 days worked"
                    consecutive_5 = model.NewBoolVar(f'consec5_s{s}_d{start_d}')
                    model.AddMinEquality(consecutive_5, [shifts[(s, d)] for d in window])
                    # Penalize 5-consecutive heavily
                    objective_terms.append(consecutive_5.Not() * 8)

    # 7. Equal distribution: reward every shift worked by full-time staff
    #    This pushes each full-timer to reach their exact target (not target-1)
    for s in range(num_staff):
        if not staff_list[s].get('is_part_time'):
            for d in operating_days:
                # Weight 3: each additional shift worked is encouraged, up to target
                # Plus a random tie-breaker (0-4) so new generations vary when scores tie
                tie_breaker = random.randint(0, 4)
                objective_terms.append(shifts[(s, d)] * 30 + (shifts[(s, d)] * tie_breaker))

    model.Maximize(sum(objective_terms))

    # 8. Solve
    solver = cp_model.CpSolver()
    # Randomize the search for more variety
    solver.parameters.random_seed = random.randint(1, 10000)
    solver.parameters.max_time_in_seconds = 20.0
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        schedule_result = []
        for d in range(1, num_days + 1):
            daily_schedule = {
                "day": d,
                "is_closed": d in closed_days,
                "staff": [],
                "absences": []
            }
            if d in operating_days:
                # Build a lookup: who is working today?
                working_staff_ids = set()
                for s in range(num_staff):
                    if solver.Value(shifts[(s, d)]) == 1:
                        assigned_roles = []
                        for r in roles:
                            if solver.Value(role_assignments[(s, d, r)]) == 1:
                                assigned_roles.append(r)
                        daily_schedule["staff"].append({
                            "staff_id": staff_list[s]["id"],
                            "name": staff_list[s]["name"],
                            "roles": assigned_roles,
                            "is_driver": bool(staff_list[s].get('is_driver', False))
                        })
                        working_staff_ids.add(staff_list[s]["id"])

                # Build absences: staff NOT working on this operating day
                date_str = datetime.date(year, month, d).strftime("%Y-%m-%d")
                for s in range(num_staff):
                    sid = staff_list[s]["id"]
                    if sid not in working_staff_ids:
                        # Find if they have a leave request
                        reason_code = None
                        for req in requests:
                            if req['staff_id'] == sid and req['date'] == date_str:
                                r = req.get('reason', '')
                                if req.get('is_summer_vacation') or '夏' in r:
                                    reason_code = '夏'
                                elif '有給' in r or '有休' in r:
                                    reason_code = '有'
                                else:
                                    reason_code = '休'  # 希望休
                                break
                        if reason_code is None:
                            reason_code = '公'  # 公休（シフト制）
                        daily_schedule["absences"].append({
                            "staff_id": sid,
                            "reason": reason_code
                        })
            schedule_result.append(daily_schedule)
            
        # Compile summary per staff
        staff_summary = {}
        for s in range(num_staff):
            staff_id = staff_list[s]['id']
            worked_days = sum(1 for d in operating_days if solver.Value(shifts[(s, d)]))
                    
            paid_leaves = 0
            for req in requests:
                if req['staff_id'] == staff_id:
                    req_date = datetime.datetime.strptime(req['date'], "%Y-%m-%d").date()
                    if req_date.year == year and req_date.month == month:
                        reason = req.get('reason', '')
                        if req.get('is_summer_vacation') or '有給' in reason or '有休' in reason or '夏休' in reason:
                            d = req_date.day
                            if d in operating_days:
                                if not solver.Value(shifts[(s, d)]):
                                    paid_leaves += 1
                            else:
                                paid_leaves += 1
                                
            public_holidays = num_days - worked_days - paid_leaves
            
            staff_summary[staff_id] = {
                "work_days": worked_days,
                "paid_leaves": paid_leaves,
                "public_holidays": public_holidays
            }

        return {
            "status": "success",
            "schedule": schedule_result,
            "summary": staff_summary,
            "all_staff": {s["id"]: s["name"] for s in staff_list}
        }
    else:
        return {
            "status": "failed",
            "error": "シフトが作成できませんでした。スタッフ数が不足しているか、制約が厳しすぎる可能性があります。"
        }
