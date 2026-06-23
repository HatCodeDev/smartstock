from pydantic import BaseModel
from typing import Optional

# Auth no sigue estrictamente el patrón Base/Create/Response ya que no mapea a una tabla,
# sino que maneja la estructura de los JWT tokens y login requests.


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str
