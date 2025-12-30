#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Cooking Secret App
Tests all backend endpoints in the specified order
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://foodie-shares.preview.emergentagent.com/api"

class CookingSecretAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.user_token = None
        self.admin_user_id = None
        self.regular_user_id = None
        self.recipe_id = None
        self.comment_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", 400
                
            try:
                response_data = response.json()
            except:
                response_data = response.text
                
            return response.status_code < 400, response_data, response.status_code
        except requests.exceptions.RequestException as e:
            return False, str(e), 0
            
    def get_auth_headers(self, token: str) -> Dict:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"}
        
    def test_1_authentication(self):
        """Test authentication endpoints"""
        print("\n=== 1. AUTHENTICATION TESTS ===")
        
        # Test 1.1: Register first user (should become admin)
        admin_data = {
            "email": "admin@cookingsecret.com",
            "username": "admin_chef",
            "full_name": "Admin Chef",
            "password": "SecurePass123!"
        }
        
        success, response, status = self.make_request("POST", "/auth/register", admin_data)
        if success and "token" in response:
            self.admin_token = response["token"]
            self.admin_user_id = response["user"]["id"]
            admin_role = response["user"]["role"]
            self.log_test("Register Admin User", admin_role == "admin", 
                         f"Admin user registered with role: {admin_role}")
        else:
            self.log_test("Register Admin User", False, f"Failed to register admin: {response}")
            return False
            
        # Test 1.2: Register second user (should be regular user)
        user_data = {
            "email": "user@cookingsecret.com", 
            "username": "regular_user",
            "full_name": "Regular User",
            "password": "UserPass123!"
        }
        
        success, response, status = self.make_request("POST", "/auth/register", user_data)
        if success and "token" in response:
            self.user_token = response["token"]
            self.regular_user_id = response["user"]["id"]
            user_role = response["user"]["role"]
            self.log_test("Register Regular User", user_role == "user",
                         f"Regular user registered with role: {user_role}")
        else:
            self.log_test("Register Regular User", False, f"Failed to register user: {response}")
            
        # Test 1.3: Login with admin
        login_data = {
            "email": "admin@cookingsecret.com",
            "password": "SecurePass123!"
        }
        
        success, response, status = self.make_request("POST", "/auth/login", login_data)
        if success and "token" in response:
            self.log_test("Admin Login", True, "Admin login successful")
        else:
            self.log_test("Admin Login", False, f"Admin login failed: {response}")
            
        # Test 1.4: Get current user info
        headers = self.get_auth_headers(self.admin_token)
        success, response, status = self.make_request("GET", "/auth/me", headers=headers)
        if success and "id" in response:
            self.log_test("Get Current User", True, f"Retrieved user info for: {response['username']}")
        else:
            self.log_test("Get Current User", False, f"Failed to get user info: {response}")
            
        # Test 1.5: Test invalid login
        invalid_login = {
            "email": "admin@cookingsecret.com",
            "password": "wrongpassword"
        }
        success, response, status = self.make_request("POST", "/auth/login", invalid_login)
        self.log_test("Invalid Login", not success, "Invalid login properly rejected")
        
        return True
        
    def test_2_user_management(self):
        """Test user management endpoints (admin only)"""
        print("\n=== 2. USER MANAGEMENT TESTS ===")
        
        if not self.admin_token:
            self.log_test("User Management Setup", False, "No admin token available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        
        # Test 2.1: List all users (admin only)
        success, response, status = self.make_request("GET", "/users", headers=headers)
        if success and isinstance(response, list):
            self.log_test("List Users", True, f"Retrieved {len(response)} users")
        else:
            self.log_test("List Users", False, f"Failed to list users: {response}")
            
        # Test 2.2: Change user role
        if self.regular_user_id:
            role_data = {"role": "chef"}
            success, response, status = self.make_request("PUT", f"/users/{self.regular_user_id}/role", 
                                                        role_data, headers)
            if success and response.get("role") == "chef":
                self.log_test("Change User Role", True, "User role changed to chef")
            else:
                self.log_test("Change User Role", False, f"Failed to change role: {response}")
                
        # Test 2.3: Toggle user active status
        if self.regular_user_id:
            success, response, status = self.make_request("PUT", f"/users/{self.regular_user_id}/toggle-active", 
                                                        headers=headers)
            if success and "message" in response:
                self.log_test("Toggle User Active", True, response["message"])
            else:
                self.log_test("Toggle User Active", False, f"Failed to toggle status: {response}")
                
        # Test 2.4: Test unauthorized access (regular user trying admin endpoint)
        user_headers = self.get_auth_headers(self.user_token) if self.user_token else {}
        success, response, status = self.make_request("GET", "/users", headers=user_headers)
        self.log_test("Unauthorized Access", not success, "Regular user properly denied admin access")
        
        return True
        
    def test_3_recipe_crud(self):
        """Test recipe CRUD operations"""
        print("\n=== 3. RECIPE CRUD TESTS ===")
        
        if not self.admin_token:
            self.log_test("Recipe CRUD Setup", False, "No admin token available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        
        # Test 3.1: Create recipe
        recipe_data = {
            "title": "Delicious Pasta Carbonara",
            "description": "A classic Italian pasta dish with eggs, cheese, and pancetta",
            "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "ingredients": [
                {"name": "Spaghetti", "amount": "400", "unit": "g"},
                {"name": "Eggs", "amount": "4", "unit": "pieces"},
                {"name": "Pancetta", "amount": "200", "unit": "g"},
                {"name": "Parmesan cheese", "amount": "100", "unit": "g"}
            ],
            "steps": [
                {"step_number": 1, "instruction": "Boil pasta in salted water", "duration_minutes": 10},
                {"step_number": 2, "instruction": "Cook pancetta until crispy", "duration_minutes": 5},
                {"step_number": 3, "instruction": "Mix eggs and cheese", "duration_minutes": 2},
                {"step_number": 4, "instruction": "Combine all ingredients", "duration_minutes": 3}
            ],
            "cooking_time_minutes": 20,
            "servings": 4,
            "difficulty": "medium",
            "category": "Pasta",
            "tags": ["Italian", "Quick", "Comfort Food"]
        }
        
        success, response, status = self.make_request("POST", "/recipes", recipe_data, headers)
        if success and "id" in response:
            self.recipe_id = response["id"]
            self.log_test("Create Recipe", True, f"Recipe created with ID: {self.recipe_id}")
        else:
            self.log_test("Create Recipe", False, f"Failed to create recipe: {response}")
            
        # Test 3.2: Get all recipes
        success, response, status = self.make_request("GET", "/recipes")
        if success and isinstance(response, list):
            self.log_test("Get All Recipes", True, f"Retrieved {len(response)} recipes")
        else:
            self.log_test("Get All Recipes", False, f"Failed to get recipes: {response}")
            
        # Test 3.3: Get specific recipe
        if self.recipe_id:
            success, response, status = self.make_request("GET", f"/recipes/{self.recipe_id}")
            if success and response.get("id") == self.recipe_id:
                self.log_test("Get Specific Recipe", True, f"Retrieved recipe: {response['title']}")
            else:
                self.log_test("Get Specific Recipe", False, f"Failed to get recipe: {response}")
                
        # Test 3.4: Search recipes
        success, response, status = self.make_request("GET", "/recipes/search/pasta")
        if success and isinstance(response, list):
            self.log_test("Search Recipes", True, f"Search returned {len(response)} results")
        else:
            self.log_test("Search Recipes", False, f"Search failed: {response}")
            
        # Test 3.5: Update recipe
        if self.recipe_id:
            updated_data = recipe_data.copy()
            updated_data["title"] = "Updated Pasta Carbonara"
            success, response, status = self.make_request("PUT", f"/recipes/{self.recipe_id}", 
                                                        updated_data, headers)
            if success and response.get("title") == "Updated Pasta Carbonara":
                self.log_test("Update Recipe", True, "Recipe updated successfully")
            else:
                self.log_test("Update Recipe", False, f"Failed to update recipe: {response}")
                
        return True
        
    def test_4_social_features(self):
        """Test like, save, and comment features"""
        print("\n=== 4. SOCIAL FEATURES TESTS ===")
        
        if not self.recipe_id or not self.user_token:
            self.log_test("Social Features Setup", False, "Missing recipe ID or user token")
            return False
            
        headers = self.get_auth_headers(self.user_token)
        
        # Test 4.1: Like recipe
        success, response, status = self.make_request("POST", f"/recipes/{self.recipe_id}/like", 
                                                    headers=headers)
        if success and response.get("liked") == True:
            self.log_test("Like Recipe", True, "Recipe liked successfully")
        else:
            self.log_test("Like Recipe", False, f"Failed to like recipe: {response}")
            
        # Test 4.2: Unlike recipe (like again)
        success, response, status = self.make_request("POST", f"/recipes/{self.recipe_id}/like", 
                                                    headers=headers)
        if success and response.get("liked") == False:
            self.log_test("Unlike Recipe", True, "Recipe unliked successfully")
        else:
            self.log_test("Unlike Recipe", False, f"Failed to unlike recipe: {response}")
            
        # Test 4.3: Save recipe
        success, response, status = self.make_request("POST", f"/recipes/{self.recipe_id}/save", 
                                                    headers=headers)
        if success and response.get("saved") == True:
            self.log_test("Save Recipe", True, "Recipe saved successfully")
        else:
            self.log_test("Save Recipe", False, f"Failed to save recipe: {response}")
            
        # Test 4.4: Add comment
        comment_data = {"text": "This recipe looks amazing! Can't wait to try it."}
        success, response, status = self.make_request("POST", f"/recipes/{self.recipe_id}/comments", 
                                                    comment_data, headers)
        if success and "id" in response:
            self.comment_id = response["id"]
            self.log_test("Add Comment", True, f"Comment added with ID: {self.comment_id}")
        else:
            self.log_test("Add Comment", False, f"Failed to add comment: {response}")
            
        # Test 4.5: Get comments
        success, response, status = self.make_request("GET", f"/recipes/{self.recipe_id}/comments")
        if success and isinstance(response, list):
            self.log_test("Get Comments", True, f"Retrieved {len(response)} comments")
        else:
            self.log_test("Get Comments", False, f"Failed to get comments: {response}")
            
        return True
        
    def test_5_follow_system(self):
        """Test follow/unfollow functionality"""
        print("\n=== 5. FOLLOW SYSTEM TESTS ===")
        
        if not self.admin_user_id or not self.user_token:
            self.log_test("Follow System Setup", False, "Missing user IDs or token")
            return False
            
        headers = self.get_auth_headers(self.user_token)
        
        # Test 5.1: Follow user
        success, response, status = self.make_request("POST", f"/users/{self.admin_user_id}/follow", 
                                                    headers=headers)
        if success and response.get("following") == True:
            self.log_test("Follow User", True, "User followed successfully")
        else:
            self.log_test("Follow User", False, f"Failed to follow user: {response}")
            
        # Test 5.2: Check if following
        success, response, status = self.make_request("GET", f"/users/{self.admin_user_id}/is-following", 
                                                    headers=headers)
        if success and response.get("following") == True:
            self.log_test("Check Following Status", True, "Following status confirmed")
        else:
            self.log_test("Check Following Status", False, f"Failed to check status: {response}")
            
        # Test 5.3: Unfollow user
        success, response, status = self.make_request("POST", f"/users/{self.admin_user_id}/follow", 
                                                    headers=headers)
        if success and response.get("following") == False:
            self.log_test("Unfollow User", True, "User unfollowed successfully")
        else:
            self.log_test("Unfollow User", False, f"Failed to unfollow user: {response}")
            
        return True
        
    def test_6_feed(self):
        """Test feed and explore endpoints"""
        print("\n=== 6. FEED TESTS ===")
        
        if not self.user_token:
            self.log_test("Feed Setup", False, "No user token available")
            return False
            
        headers = self.get_auth_headers(self.user_token)
        
        # Test 6.1: Get personalized feed
        success, response, status = self.make_request("GET", "/feed", headers=headers)
        if success and isinstance(response, list):
            self.log_test("Get Feed", True, f"Feed returned {len(response)} recipes")
        else:
            self.log_test("Get Feed", False, f"Failed to get feed: {response}")
            
        # Test 6.2: Get explore page
        success, response, status = self.make_request("GET", "/explore")
        if success and isinstance(response, list):
            self.log_test("Get Explore", True, f"Explore returned {len(response)} recipes")
        else:
            self.log_test("Get Explore", False, f"Failed to get explore: {response}")
            
        # Test 6.3: Get categories
        success, response, status = self.make_request("GET", "/categories")
        if success and "categories" in response:
            self.log_test("Get Categories", True, f"Retrieved {len(response['categories'])} categories")
        else:
            self.log_test("Get Categories", False, f"Failed to get categories: {response}")
            
        return True
        
    def test_7_admin_stats(self):
        """Test admin statistics endpoint"""
        print("\n=== 7. ADMIN STATS TESTS ===")
        
        if not self.admin_token:
            self.log_test("Admin Stats Setup", False, "No admin token available")
            return False
            
        headers = self.get_auth_headers(self.admin_token)
        
        # Test 7.1: Get admin stats
        success, response, status = self.make_request("GET", "/admin/stats", headers=headers)
        if success and "users_count" in response:
            self.log_test("Get Admin Stats", True, 
                         f"Stats: {response['users_count']} users, {response['recipes_count']} recipes")
        else:
            self.log_test("Get Admin Stats", False, f"Failed to get stats: {response}")
            
        return True
        
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Cooking Secret Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        
        try:
            self.test_1_authentication()
            self.test_2_user_management()
            self.test_3_recipe_crud()
            self.test_4_social_features()
            self.test_5_follow_system()
            self.test_6_feed()
            self.test_7_admin_stats()
        except Exception as e:
            print(f"❌ Test execution failed: {e}")
            
        # Summary
        print("\n" + "="*50)
        print("📊 TEST SUMMARY")
        print("="*50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%" if total > 0 else "0%")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
                
        return passed == total

if __name__ == "__main__":
    tester = CookingSecretAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)