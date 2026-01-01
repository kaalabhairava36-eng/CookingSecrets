from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'cooking-secret-super-secure-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Create the main app
app = FastAPI(title="Cooking Secret API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ============== MODELS ==============

class UserRole:
    ADMIN = "admin"
    MODERATOR = "moderator"
    CHEF = "chef"
    USER = "user"

class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str = UserRole.USER
    bio: Optional[str] = ""
    profile_image: Optional[str] = None  # base64 image
    followers_count: int = 0
    following_count: int = 0
    recipes_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    role: str
    bio: Optional[str] = ""
    profile_image: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    recipes_count: int = 0
    created_at: datetime
    is_active: bool = True

class AuthResponse(BaseModel):
    user: UserResponse
    token: str

class Ingredient(BaseModel):
    name: str
    amount: str
    unit: Optional[str] = ""

class CookingStep(BaseModel):
    step_number: int
    instruction: str
    duration_minutes: Optional[int] = None

class RecipeCreate(BaseModel):
    title: str
    description: str
    image: str  # base64 image
    ingredients: List[Ingredient]
    steps: List[CookingStep]
    cooking_time_minutes: int
    servings: int
    difficulty: str  # easy, medium, hard
    category: str
    tags: List[str] = []
    is_paid: bool = False
    price: float = 0.0  # Price in dollars if paid

class Recipe(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_username: str
    author_profile_image: Optional[str] = None
    author_role: str = UserRole.USER
    title: str
    description: str
    image: str  # base64 image
    ingredients: List[Ingredient]
    steps: List[CookingStep]
    cooking_time_minutes: int
    servings: int
    difficulty: str
    category: str
    tags: List[str] = []
    likes_count: int = 0
    comments_count: int = 0
    saves_count: int = 0
    is_featured: bool = False
    is_approved: bool = True
    is_paid: bool = False
    price: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CommentCreate(BaseModel):
    text: str

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipe_id: str
    user_id: str
    username: str
    user_profile_image: Optional[str] = None
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Like(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipe_id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Save(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipe_id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Follow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    follower_id: str
    following_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UpdateUserRole(BaseModel):
    role: str

class UpdateProfile(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    profile_image: Optional[str] = None

# ============== HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=AuthResponse)
async def register(user_data: UserCreate):
    # Check if email exists
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
    )
    
    # Hash password and store
    user_dict = user.model_dump()
    user_dict["password_hash"] = hash_password(user_data.password)
    
    # First user becomes admin
    user_count = await db.users.count_documents({})
    if user_count == 0:
        user_dict["role"] = UserRole.ADMIN
    
    await db.users.insert_one(user_dict)
    
    token = create_token(user_dict["id"])
    return AuthResponse(
        user=UserResponse(**user_dict),
        token=token
    )

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    token = create_token(user["id"])
    return AuthResponse(
        user=UserResponse(**user),
        token=token
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============== USER ROUTES ==============

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.MODERATOR]))):
    users = await db.users.find().to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.get("/users/username/{username}", response_model=UserResponse)
async def get_user_by_username(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    role_data: UpdateUserRole,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    if role_data.role not in [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CHEF, UserRole.USER]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": role_data.role}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id})
    return UserResponse(**user)

@api_router.put("/users/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfile,
    current_user: dict = Depends(get_current_user)
):
    update_fields = {}
    if profile_data.full_name is not None:
        update_fields["full_name"] = profile_data.full_name
    if profile_data.bio is not None:
        update_fields["bio"] = profile_data.bio
    if profile_data.profile_image is not None:
        update_fields["profile_image"] = profile_data.profile_image
    
    if update_fields:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_fields}
        )
    
    user = await db.users.find_one({"id": current_user["id"]})
    return UserResponse(**user)

@api_router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_active", True)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": new_status}}
    )
    return {"message": f"User {'activated' if new_status else 'deactivated'} successfully"}

# ============== RECIPE ROUTES ==============

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(
    recipe_data: RecipeCreate,
    current_user: dict = Depends(get_current_user)
):
    recipe = Recipe(
        author_id=current_user["id"],
        author_username=current_user["username"],
        author_profile_image=current_user.get("profile_image"),
        author_role=current_user["role"],
        title=recipe_data.title,
        description=recipe_data.description,
        image=recipe_data.image,
        ingredients=[i.model_dump() for i in recipe_data.ingredients],
        steps=[s.model_dump() for s in recipe_data.steps],
        cooking_time_minutes=recipe_data.cooking_time_minutes,
        servings=recipe_data.servings,
        difficulty=recipe_data.difficulty,
        category=recipe_data.category,
        tags=recipe_data.tags,
        is_featured=current_user["role"] == UserRole.CHEF,
        is_paid=recipe_data.is_paid,
        price=recipe_data.price if recipe_data.is_paid else 0.0,
    )
    
    await db.recipes.insert_one(recipe.model_dump())
    
    # Update user's recipe count
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"recipes_count": 1}}
    )
    
    return recipe

@api_router.get("/recipes", response_model=List[Recipe])
async def get_recipes(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    author_id: Optional[str] = None,
    featured_only: bool = False
):
    query = {"is_approved": True}
    if category:
        query["category"] = category
    if author_id:
        query["author_id"] = author_id
    if featured_only:
        query["is_featured"] = True
    
    recipes = await db.recipes.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [Recipe(**r) for r in recipes]

@api_router.get("/recipes/{recipe_id}", response_model=Recipe)
async def get_recipe(recipe_id: str):
    recipe = await db.recipes.find_one({"id": recipe_id})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return Recipe(**recipe)

@api_router.put("/recipes/{recipe_id}", response_model=Recipe)
async def update_recipe(
    recipe_id: str,
    recipe_data: RecipeCreate,
    current_user: dict = Depends(get_current_user)
):
    recipe = await db.recipes.find_one({"id": recipe_id})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    if recipe["author_id"] != current_user["id"] and current_user["role"] not in [UserRole.ADMIN, UserRole.MODERATOR]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this recipe")
    
    update_data = recipe_data.model_dump()
    update_data["ingredients"] = [i.model_dump() if hasattr(i, 'model_dump') else i for i in recipe_data.ingredients]
    update_data["steps"] = [s.model_dump() if hasattr(s, 'model_dump') else s for s in recipe_data.steps]
    update_data["updated_at"] = datetime.utcnow()
    
    await db.recipes.update_one(
        {"id": recipe_id},
        {"$set": update_data}
    )
    
    updated_recipe = await db.recipes.find_one({"id": recipe_id})
    return Recipe(**updated_recipe)

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
):
    recipe = await db.recipes.find_one({"id": recipe_id})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    if recipe["author_id"] != current_user["id"] and current_user["role"] not in [UserRole.ADMIN, UserRole.MODERATOR]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this recipe")
    
    await db.recipes.delete_one({"id": recipe_id})
    await db.comments.delete_many({"recipe_id": recipe_id})
    await db.likes.delete_many({"recipe_id": recipe_id})
    await db.saves.delete_many({"recipe_id": recipe_id})
    
    # Update user's recipe count
    await db.users.update_one(
        {"id": recipe["author_id"]},
        {"$inc": {"recipes_count": -1}}
    )
    
    return {"message": "Recipe deleted successfully"}

@api_router.get("/recipes/search/{query}")
async def search_recipes(query: str, limit: int = 20):
    recipes = await db.recipes.find({
        "$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"description": {"$regex": query, "$options": "i"}},
            {"tags": {"$regex": query, "$options": "i"}},
            {"category": {"$regex": query, "$options": "i"}}
        ],
        "is_approved": True
    }).limit(limit).to_list(limit)
    return [Recipe(**r) for r in recipes]

# ============== LIKE ROUTES ==============

@api_router.post("/recipes/{recipe_id}/like")
async def like_recipe(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Check if already liked
    existing = await db.likes.find_one({
        "recipe_id": recipe_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        # Unlike
        await db.likes.delete_one({"id": existing["id"]})
        await db.recipes.update_one(
            {"id": recipe_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"liked": False, "message": "Recipe unliked"}
    else:
        # Like
        like = Like(
            recipe_id=recipe_id,
            user_id=current_user["id"]
        )
        await db.likes.insert_one(like.model_dump())
        await db.recipes.update_one(
            {"id": recipe_id},
            {"$inc": {"likes_count": 1}}
        )
        return {"liked": True, "message": "Recipe liked"}

@api_router.get("/recipes/{recipe_id}/liked")
async def check_liked(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.likes.find_one({
        "recipe_id": recipe_id,
        "user_id": current_user["id"]
    })
    return {"liked": existing is not None}

# ============== SAVE ROUTES ==============

@api_router.post("/recipes/{recipe_id}/save")
async def save_recipe(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.saves.find_one({
        "recipe_id": recipe_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        await db.saves.delete_one({"id": existing["id"]})
        await db.recipes.update_one(
            {"id": recipe_id},
            {"$inc": {"saves_count": -1}}
        )
        return {"saved": False, "message": "Recipe unsaved"}
    else:
        save = Save(
            recipe_id=recipe_id,
            user_id=current_user["id"]
        )
        await db.saves.insert_one(save.model_dump())
        await db.recipes.update_one(
            {"id": recipe_id},
            {"$inc": {"saves_count": 1}}
        )
        return {"saved": True, "message": "Recipe saved"}

@api_router.get("/recipes/{recipe_id}/saved")
async def check_saved(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.saves.find_one({
        "recipe_id": recipe_id,
        "user_id": current_user["id"]
    })
    return {"saved": existing is not None}

@api_router.get("/users/{user_id}/saved-recipes", response_model=List[Recipe])
async def get_saved_recipes(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only view your own saved recipes")
    
    saves = await db.saves.find({"user_id": user_id}).to_list(1000)
    recipe_ids = [s["recipe_id"] for s in saves]
    recipes = await db.recipes.find({"id": {"$in": recipe_ids}}).to_list(1000)
    return [Recipe(**r) for r in recipes]

# ============== COMMENT ROUTES ==============

@api_router.post("/recipes/{recipe_id}/comments", response_model=Comment)
async def create_comment(
    recipe_id: str,
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    comment = Comment(
        recipe_id=recipe_id,
        user_id=current_user["id"],
        username=current_user["username"],
        user_profile_image=current_user.get("profile_image"),
        text=comment_data.text
    )
    
    await db.comments.insert_one(comment.model_dump())
    await db.recipes.update_one(
        {"id": recipe_id},
        {"$inc": {"comments_count": 1}}
    )
    
    return comment

@api_router.get("/recipes/{recipe_id}/comments", response_model=List[Comment])
async def get_comments(recipe_id: str):
    comments = await db.comments.find({"recipe_id": recipe_id}).sort("created_at", -1).to_list(1000)
    return [Comment(**c) for c in comments]

@api_router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != current_user["id"] and current_user["role"] not in [UserRole.ADMIN, UserRole.MODERATOR]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    await db.comments.delete_one({"id": comment_id})
    await db.recipes.update_one(
        {"id": comment["recipe_id"]},
        {"$inc": {"comments_count": -1}}
    )
    
    return {"message": "Comment deleted successfully"}

# ============== FOLLOW ROUTES ==============

@api_router.post("/users/{user_id}/follow")
async def follow_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    existing = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    
    if existing:
        await db.follows.delete_one({"id": existing["id"]})
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": -1}})
        await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
        return {"following": False, "message": "Unfollowed"}
    else:
        follow = Follow(
            follower_id=current_user["id"],
            following_id=user_id
        )
        await db.follows.insert_one(follow.model_dump())
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": 1}})
        await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})
        return {"following": True, "message": "Following"}

@api_router.get("/users/{user_id}/is-following")
async def check_following(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    return {"following": existing is not None}

@api_router.get("/users/{user_id}/followers", response_model=List[UserResponse])
async def get_followers(user_id: str):
    follows = await db.follows.find({"following_id": user_id}).to_list(1000)
    follower_ids = [f["follower_id"] for f in follows]
    users = await db.users.find({"id": {"$in": follower_ids}}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}/following", response_model=List[UserResponse])
async def get_following(user_id: str):
    follows = await db.follows.find({"follower_id": user_id}).to_list(1000)
    following_ids = [f["following_id"] for f in follows]
    users = await db.users.find({"id": {"$in": following_ids}}).to_list(1000)
    return [UserResponse(**u) for u in users]

# ============== FEED ROUTES ==============

@api_router.get("/feed", response_model=List[Recipe])
async def get_feed(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    # Get users that current user follows
    follows = await db.follows.find({"follower_id": current_user["id"]}).to_list(1000)
    following_ids = [f["following_id"] for f in follows]
    following_ids.append(current_user["id"])  # Include own posts
    
    recipes = await db.recipes.find({
        "author_id": {"$in": following_ids},
        "is_approved": True
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [Recipe(**r) for r in recipes]

@api_router.get("/explore", response_model=List[Recipe])
async def get_explore(skip: int = 0, limit: int = 20):
    # Get trending/featured recipes
    recipes = await db.recipes.find({"is_approved": True}).sort([("likes_count", -1), ("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    return [Recipe(**r) for r in recipes]

@api_router.get("/categories")
async def get_categories():
    return {
        "categories": [
            "Breakfast", "Lunch", "Dinner", "Dessert", "Appetizer",
            "Salad", "Soup", "Snack", "Beverage", "Side Dish",
            "Vegan", "Vegetarian", "Seafood", "Meat", "Pasta",
            "Asian", "Italian", "Mexican", "Indian", "Mediterranean"
        ]
    }

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    users_count = await db.users.count_documents({})
    recipes_count = await db.recipes.count_documents({})
    comments_count = await db.comments.count_documents({})
    
    role_counts = {
        "admin": await db.users.count_documents({"role": UserRole.ADMIN}),
        "moderator": await db.users.count_documents({"role": UserRole.MODERATOR}),
        "chef": await db.users.count_documents({"role": UserRole.CHEF}),
        "user": await db.users.count_documents({"role": UserRole.USER})
    }
    
    return {
        "users_count": users_count,
        "recipes_count": recipes_count,
        "comments_count": comments_count,
        "role_counts": role_counts
    }

# ============== AI CHATBOT ROUTES ==============

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    role: str  # 'user' or 'assistant'
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str

FOOD_SYSTEM_PROMPT = """You are ChefBot, a friendly and knowledgeable AI cooking assistant for the Cooking Secret app. 
Your expertise includes:
- Suggesting recipes based on available ingredients
- Providing cooking tips and techniques
- Recommending ingredient substitutions
- Explaining cooking methods and terminology
- Dietary advice and nutritional information
- Food pairing suggestions
- Kitchen equipment recommendations

Guidelines:
- Be warm, helpful, and encouraging
- Give concise but informative answers
- Use cooking emojis sparingly to make responses engaging
- If asked about non-food topics, politely redirect to cooking-related discussions
- Always prioritize food safety in your advice"""

@api_router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(
    chat_request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    session_id = chat_request.session_id or str(uuid.uuid4())
    
    # Get API key
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        # Initialize chat
        chat = LlmChat(
            api_key=api_key,
            session_id=f"{current_user['id']}_{session_id}",
            system_message=FOOD_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4.1-mini")
        
        # Get conversation history from DB
        history = await db.chat_messages.find({
            "user_id": current_user["id"],
            "session_id": session_id
        }).sort("created_at", 1).to_list(50)
        
        # Add history to chat context
        for msg in history:
            if msg["role"] == "user":
                await chat.send_message(UserMessage(text=msg["content"]))
        
        # Send new message
        user_message = UserMessage(text=chat_request.message)
        response = await chat.send_message(user_message)
        
        # Store messages in DB
        user_msg = ChatMessage(
            user_id=current_user["id"],
            session_id=session_id,
            role="user",
            content=chat_request.message
        )
        assistant_msg = ChatMessage(
            user_id=current_user["id"],
            session_id=session_id,
            role="assistant",
            content=response
        )
        
        await db.chat_messages.insert_many([
            user_msg.model_dump(),
            assistant_msg.model_dump()
        ])
        
        return ChatResponse(response=response, session_id=session_id)
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat service error: {str(e)}")

@api_router.get("/chat/history")
async def get_chat_history(
    session_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if session_id:
        query["session_id"] = session_id
    
    messages = await db.chat_messages.find(query).sort("created_at", 1).to_list(100)
    return [{"role": m["role"], "content": m["content"], "created_at": m["created_at"]} for m in messages]

@api_router.get("/chat/sessions")
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    # Get unique session IDs
    pipeline = [
        {"$match": {"user_id": current_user["id"]}},
        {"$group": {"_id": "$session_id", "last_message": {"$last": "$created_at"}}},
        {"$sort": {"last_message": -1}},
        {"$limit": 20}
    ]
    sessions = await db.chat_messages.aggregate(pipeline).to_list(20)
    return [{"session_id": s["_id"], "last_message": s["last_message"]} for s in sessions]

@api_router.delete("/chat/session/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = await db.chat_messages.delete_many({
        "user_id": current_user["id"],
        "session_id": session_id
    })
    return {"deleted": result.deleted_count}

# ============== RECIPE PURCHASE ROUTES ==============

class Purchase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    recipe_id: str
    amount: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

@api_router.post("/recipes/{recipe_id}/purchase")
async def purchase_recipe(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
):
    recipe = await db.recipes.find_one({"id": recipe_id})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    if not recipe.get("is_paid", False):
        raise HTTPException(status_code=400, detail="This recipe is free")
    
    # Check if already purchased
    existing = await db.purchases.find_one({
        "user_id": current_user["id"],
        "recipe_id": recipe_id
    })
    if existing:
        return {"purchased": True, "message": "Already purchased"}
    
    # Create purchase record (in production, integrate with payment gateway)
    purchase = Purchase(
        user_id=current_user["id"],
        recipe_id=recipe_id,
        amount=recipe.get("price", 0)
    )
    await db.purchases.insert_one(purchase.model_dump())
    
    return {"purchased": True, "message": "Recipe purchased successfully"}

@api_router.get("/recipes/{recipe_id}/purchased")
async def check_purchased(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
):
    recipe = await db.recipes.find_one({"id": recipe_id})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Free recipes or author's own recipes are accessible
    if not recipe.get("is_paid", False) or recipe["author_id"] == current_user["id"]:
        return {"purchased": True, "is_free": not recipe.get("is_paid", False)}
    
    # Admin and moderators can access all
    if current_user["role"] in [UserRole.ADMIN, UserRole.MODERATOR]:
        return {"purchased": True, "is_free": False}
    
    existing = await db.purchases.find_one({
        "user_id": current_user["id"],
        "recipe_id": recipe_id
    })
    return {"purchased": existing is not None, "is_free": False}

@api_router.get("/users/{user_id}/purchases")
async def get_user_purchases(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    if user_id != current_user["id"] and current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Can only view your own purchases")
    
    purchases = await db.purchases.find({"user_id": user_id}).to_list(1000)
    recipe_ids = [p["recipe_id"] for p in purchases]
    recipes = await db.recipes.find({"id": {"$in": recipe_ids}}).to_list(1000)
    return [Recipe(**r) for r in recipes]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
