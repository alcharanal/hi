#!/usr/bin/env python3
"""
Test script to validate the Anon-Connect FastAPI application setup
"""

def test_imports():
    """Test if all modules can be imported successfully"""
    try:
        print("Testing imports...")
        
        # Test database module
        import database
        print("✅ Database module imported successfully")
        
        # Test models module
        import models
        print("✅ Models module imported successfully")
        
        # Test utils module
        import utils
        print("✅ Utils module imported successfully")
        
        # Test main module
        import main
        print("✅ Main module imported successfully")
        
        return True
    except Exception as e:
        print(f"❌ Import error: {e}")
        return False

def test_database_models():
    """Test database model creation"""
    try:
        from database import User, Chat, Message, Base
        print("✅ Database models loaded successfully")
        
        # Test anonymous name generation
        from utils import generate_anonymous_name
        anon_name = generate_anonymous_name()
        print(f"✅ Anonymous name generator works: {anon_name}")
        
        return True
    except Exception as e:
        print(f"❌ Database model error: {e}")
        return False

def test_fastapi_app():
    """Test FastAPI application creation"""
    try:
        from main import app
        print("✅ FastAPI app created successfully")
        
        # Check if routes are registered
        routes = [route.path for route in app.routes]
        expected_routes = ["/health", "/", "/auth/register", "/auth/login", "/auth/me", "/db/status"]
        
        for route in expected_routes:
            if route in routes:
                print(f"✅ Route {route} registered successfully")
            else:
                print(f"❌ Route {route} not found")
        
        return True
    except Exception as e:
        print(f"❌ FastAPI app error: {e}")
        return False

def test_password_hashing():
    """Test password hashing utilities"""
    try:
        from utils import get_password_hash, verify_password
        
        password = "testpassword123"
        hashed = get_password_hash(password)
        is_valid = verify_password(password, hashed)
        
        if is_valid:
            print("✅ Password hashing works correctly")
            return True
        else:
            print("❌ Password verification failed")
            return False
    except Exception as e:
        print(f"❌ Password hashing error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Anon-Connect Application Setup Test")
    print("=" * 50)
    
    tests = [
        ("Import Test", test_imports),
        ("Database Models Test", test_database_models),
        ("FastAPI App Test", test_fastapi_app),
        ("Password Hashing Test", test_password_hashing)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running {test_name}...")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} FAILED: {e}")
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The application is ready to run.")
        print("\n🚀 To start the server, run:")
        print("   uvicorn main:app --reload")
        print("\n📋 Available endpoints:")
        print("   GET  /health - Health check")
        print("   GET  / - Welcome message")
        print("   POST /auth/register - User registration")
        print("   POST /auth/login - User login")
        print("   GET  /auth/me - Current user info")
        print("   GET  /db/status - Database status")
    else:
        print("❌ Some tests failed. Please check the errors above.")

if __name__ == "__main__":
    main()
