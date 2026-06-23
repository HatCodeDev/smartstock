from app.routers.products import router as products_router
from app.routers.portal import router as portal_router
from app.routers.config import router as config_router
from app.routers.auth import router as auth_router
from app.routers.ws import router as ws_router
from app.routers.dashboard import router as dashboard_router
from app.routers.cycle import router as cycle_router
from app.routers.tags import router as tags_router
from app.routers.alerts import router as alerts_router
from app.routers.reports import router as reports_router

__all__ = ["products_router", "portal_router", "config_router", "auth_router", "ws_router", "dashboard_router", "cycle_router", "tags_router", "alerts_router", "reports_router"]
