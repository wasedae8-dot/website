from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from database import Base

class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    
    staff_members = relationship("Staff", back_populates="facility")

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # e.g., 看護師, 生活相談員, 介護職, 運転手, 機能訓練指導員
    
    # Many-to-many relationship with Staff could be implemented or handled simpler
    # via a bridging table. For now, we'll keep it simple with a bridge table.
    
class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    is_part_time = Column(Boolean, default=False)
    
    # Default facility assignment (though they can be borrowed)
    facility_id = Column(Integer, ForeignKey("facilities.id"))
    facility = relationship("Facility", back_populates="staff_members")
    
    # Flags for standard roles to simplify constraints for now
    is_nurse = Column(Boolean, default=False)
    is_consultant = Column(Boolean, default=False)
    is_care_worker = Column(Boolean, default=False)
    is_driver = Column(Boolean, default=False)
    is_functional_trainer = Column(Boolean, default=False)
    
    # Additional flags
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0, nullable=False)

    # Availability for part-time staff (Boolean flags for each day of the week)
    is_available_mon = Column(Boolean, default=True)
    is_available_tue = Column(Boolean, default=True)
    is_available_wed = Column(Boolean, default=True)
    is_available_thu = Column(Boolean, default=True)
    is_available_fri = Column(Boolean, default=True)
    is_available_sat = Column(Boolean, default=True)
    is_available_sun = Column(Boolean, default=True)

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"))
    date = Column(String, index=True) # e.g. "2026-08-13"
    reason = Column(String, default="希望休") # 休み希望, 夏休み, etc.
    is_summer_vacation = Column(Boolean, default=False)

    staff = relationship("Staff")
