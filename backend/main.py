from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import os

import models, schemas
from database import engine, get_db
from solver import solve_schedule
from datetime import datetime

# Tables will be created in startup_event to avoid crashing on import if DB is down


app = FastAPI(title="Shift Scheduling API", redirect_slashes=False)

@app.on_event("startup")
async def startup_event():
    app_password = os.getenv("APP_PASSWORD")
    if app_password:
        print(f"INFO: Application Password is set (length: {len(app_password)})")
    else:
        print("WARNING: APP_PASSWORD is NOT set. Authentication is DISABLED.")
        
    # Attempt to create tables, but don't crash if DB is not ready
    try:
        models.Base.metadata.create_all(bind=engine)
        print("INFO: Database tables verified/created.")
        
        # Run manual migration for sort_order column
        from sqlalchemy import text
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE staff ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0"))
        print("INFO: Migration (sort_order) verified.")
        
        # Create a default facility if none exists to allow immediate registration
        from database import SessionLocal
        db = SessionLocal()
        try:
            if db.query(models.Facility).count() == 0:
                default_facility = models.Facility(name="デフォルト施設")
                db.add(default_facility)
                db.commit()
                print("INFO: Created default facility.")
        finally:
            db.close()
            
    except Exception as e:
        import traceback
        print(f"ERROR: Failed to initialize/migrate database: {e}")
        traceback.print_exc()


# Allow CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def password_protect(request: Request, call_next):
    # Allow OPTIONS requests for CORS preflight
    if request.method == "OPTIONS":
        return await call_next(request)
        
    app_password = os.getenv("APP_PASSWORD")
    path = request.url.path
    
    if app_password:
        app_password = app_password.strip()
        # Protect everything except basic info and docs
        if path not in ["/", "/docs", "/openapi.json", "/redoc"]:
            # Check custom header
            request_password = request.headers.get("X-App-Password")
            if request_password:
                request_password = request_password.strip()
            
            if request_password != app_password:
                return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    
    response = await call_next(request)
    return response

@app.get("/")
def read_root():
    return {"message": "Shift Scheduling Optimization API is running."}

@app.get("/api/auth/verify")
def verify_auth(request: Request):
    """
    Endpoint for the frontend to verify if the password is correct.
    """
    app_password = os.getenv("APP_PASSWORD")
    if not app_password:
        return {"status": "ok", "warning": "APP_PASSWORD not set"}
        
    app_password = app_password.strip()
    request_password = request.headers.get("X-App-Password", "").strip()
    
    if request_password != app_password:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    return {"status": "ok"}







# --- Facilities ---
@app.get("/facilities", response_model=List[schemas.Facility])
def read_facilities(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Facility).offset(skip).limit(limit).all()

@app.post("/facilities", response_model=schemas.Facility)
def create_facility(facility: schemas.FacilityCreate, db: Session = Depends(get_db)):
    db_facility = models.Facility(name=facility.name)
    db.add(db_facility)
    db.commit()
    db.refresh(db_facility)
    return db_facility

# --- Staff ---
@app.get("/staff", response_model=List[schemas.Staff])
def read_staff(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Staff).order_by(models.Staff.sort_order, models.Staff.id).offset(skip).limit(limit).all()

@app.post("/staff", response_model=schemas.Staff)
def create_staff(staff: schemas.StaffCreate, db: Session = Depends(get_db)):
    # Assign next sort_order
    max_order = db.query(models.Staff).count()
    db_staff = models.Staff(**staff.dict(), sort_order=max_order)
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff

@app.post("/staff/reorder")
def reorder_staff(ordered_ids: List[int], db: Session = Depends(get_db)):
    for index, staff_id in enumerate(ordered_ids):
        db.query(models.Staff).filter(models.Staff.id == staff_id).update({"sort_order": index})
    db.commit()
    return {"ok": True}

@app.delete("/staff/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    db_staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    db.delete(db_staff)
    db.commit()
    return {"ok": True}

@app.put("/staff/{staff_id}", response_model=schemas.Staff)
def update_staff(staff_id: int, staff: schemas.StaffCreate, db: Session = Depends(get_db)):
    db_staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    for key, value in staff.dict().items():
        setattr(db_staff, key, value)
    db.commit()
    db.refresh(db_staff)
    return db_staff

# --- Leave Requests ---
@app.get("/requests", response_model=List[schemas.LeaveRequest])
def read_requests(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.LeaveRequest).offset(skip).limit(limit).all()

@app.post("/requests", response_model=schemas.LeaveRequest)
def create_request(request: schemas.LeaveRequestCreate, db: Session = Depends(get_db)):
    db_request = models.LeaveRequest(**request.dict())
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request

@app.delete("/requests/{request_id}")
def delete_request(request_id: int, db: Session = Depends(get_db)):
    db_request = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Request not found")
    db.delete(db_request)
    db.commit()
    return {"ok": True}

# --- Solver Engine ---
@app.get("/generate-schedule")
def generate_schedule(year: int, month: int, db: Session = Depends(get_db)):
    """
    Triggers the OR-Tools optimization engine to generate the schedule 
    for the specified year and month.
    """
    # 1. Fetch current staff properties as dicts for the solver
    staff_records = db.query(models.Staff).filter(models.Staff.is_active == True).all()
    staff_list = []
    for s in staff_records:
        staff_list.append({
            "id": s.id,
            "name": s.name,
            "is_part_time": s.is_part_time,
            "is_nurse": s.is_nurse,
            "is_consultant": s.is_consultant,
            "is_care_worker": s.is_care_worker,
            "is_driver": s.is_driver,
            "is_functional_trainer": s.is_functional_trainer,
            "is_available_mon": s.is_available_mon,
            "is_available_tue": s.is_available_tue,
            "is_available_wed": s.is_available_wed,
            "is_available_thu": s.is_available_thu,
            "is_available_fri": s.is_available_fri,
            "is_available_sat": s.is_available_sat,
            "is_available_sun": s.is_available_sun
        })
        
    # 2. Fetch leave requests
    request_records = db.query(models.LeaveRequest).all()
    requests_list = []
    for r in request_records:
        requests_list.append({
            "id": r.id,
            "staff_id": r.staff_id,
            "date": r.date,
            "reason": r.reason,
            "is_summer_vacation": r.is_summer_vacation
        })
        
    # 3. Call the Python OR-Tools Logic
    result = solve_schedule(year, month, staff_list, requests_list)
    
    if result.get("status") == "failed":
        raise HTTPException(status_code=400, detail=result.get("error"))
        
    return result
