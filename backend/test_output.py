import sys
sys.path.insert(0, '/app')

from database import SessionLocal
import models
from solver import solve_schedule
import json

db = SessionLocal()
staff_records = db.query(models.Staff).all()
request_records = db.query(models.LeaveRequest).all()
db.close()

staff_list = []
for s in staff_records:
    staff_list.append({
        "id": s.id, "name": s.name, "is_part_time": s.is_part_time,
        "is_nurse": s.is_nurse, "is_consultant": s.is_consultant,
        "is_care_worker": s.is_care_worker, "is_driver": s.is_driver,
        "is_functional_trainer": s.is_functional_trainer,
        "is_available_mon": s.is_available_mon, "is_available_tue": s.is_available_tue,
        "is_available_wed": s.is_available_wed, "is_available_thu": s.is_available_thu,
        "is_available_fri": s.is_available_fri, "is_available_sat": s.is_available_sat,
        "is_available_sun": s.is_available_sun,
    })

print("Staff with is_driver=True:")
for s in staff_list:
    if s["is_driver"]:
        print(f"  id={s['id']} name={s['name']} care={s['is_care_worker']}")

requests_list = []
for r in request_records:
    requests_list.append({
        "id": r.id, "staff_id": r.staff_id, "date": r.date,
        "reason": r.reason, "is_summer_vacation": r.is_summer_vacation
    })

result = solve_schedule(2026, 3, staff_list, requests_list)
sched = result.get("schedule", [])
print("\nStatus:", result.get("status"))

for day in sched:
    if day.get("staff"):
        print(f"\nDay {day['day']}:")
        for s in day["staff"][:4]:
            print(f"  {s['name']} roles={s['roles']} is_driver={s.get('is_driver')}")
        abs_list = day.get("absences", [])
        print(f"  absences count: {len(abs_list)}")
        if abs_list:
            print(f"  absence[0]: {abs_list[0]}")
        break
