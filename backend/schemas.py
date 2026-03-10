from pydantic import BaseModel
from typing import List, Optional

# --- Facility Schemas ---
class FacilityBase(BaseModel):
    name: str

class FacilityCreate(FacilityBase):
    pass

class Facility(FacilityBase):
    id: int

    class Config:
        orm_mode = True

# --- Staff Schemas ---
class StaffBase(BaseModel):
    name: str
    is_part_time: bool = False
    facility_id: int
    is_nurse: bool = False
    is_consultant: bool = False
    is_care_worker: bool = False
    is_driver: bool = False
    is_functional_trainer: bool = False
    is_active: bool = True
    sort_order: int = 0
    
    # Availability for part-time staff
    is_available_mon: bool = True
    is_available_tue: bool = True
    is_available_wed: bool = True
    is_available_thu: bool = True
    is_available_fri: bool = True
    is_available_sat: bool = True
    is_available_sun: bool = True

class StaffCreate(StaffBase):
    pass

class Staff(StaffBase):
    id: int

    class Config:
        orm_mode = True

# --- LeaveRequest Schemas ---
class LeaveRequestBase(BaseModel):
    staff_id: int
    date: str
    reason: Optional[str] = "希望休"
    is_summer_vacation: bool = False

class LeaveRequestCreate(LeaveRequestBase):
    pass

class LeaveRequest(LeaveRequestBase):
    id: int

    class Config:
        orm_mode = True
