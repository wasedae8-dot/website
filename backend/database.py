from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Get the database URL from the environment
env_url = os.getenv("DATABASE_URL", "").strip()
if not env_url:
    # Default for local development
    SQLALCHEMY_DATABASE_URL = "postgresql://postgres:password@db:5432/dev_db"
else:
    SQLALCHEMY_DATABASE_URL = env_url

# Railway provides "postgres://" but SQLAlchemy requires "postgresql://"
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Add sslmode=require for Railway/External DBs if not present
if "sslmode=" not in SQLALCHEMY_DATABASE_URL and "localhost" not in SQLALCHEMY_DATABASE_URL and "db:5432" not in SQLALCHEMY_DATABASE_URL:
    if "?" in SQLALCHEMY_DATABASE_URL:
        SQLALCHEMY_DATABASE_URL += "&sslmode=require"
    else:
        SQLALCHEMY_DATABASE_URL += "?sslmode=require"

# Debug print (masked password)
try:
    from urllib.parse import urlparse
    parsed = urlparse(SQLALCHEMY_DATABASE_URL)
    masked_url = f"{parsed.scheme}://{parsed.hostname}:{parsed.port}{parsed.path}?{parsed.query}"
    print(f"INFO: Connecting to database: {masked_url}")
except Exception:
    print("INFO: Connecting to database: [URL format complex, masking failed]")

try:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
except Exception as e:
    print(f"Error creating engine: {e}")
    raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
