import sys
import os
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import uuid

# Add the current directory to sys.path to allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import User
from app.core.db import SessionLocal

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def seed_users():
    db: Session = SessionLocal()
    try:
        # Admin user for tayenda.renai-labs.com
        admin_username = "rflmwcom"
        admin_email = "admin@tayenda.renai-labs.com"
        admin_password = "8-18Zfyd9;YYAe"
        
        # Check if user already exists
        user = db.query(User).filter(User.username == admin_username).first()
        if not user:
            print(f"Creating admin user: {admin_username}")
            admin_user = User(
                username=admin_username,
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                full_name="Tayenda Malawi Administrator",
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("✓ Admin user created successfully")
        else:
            print("⚠ Admin user already exists")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
