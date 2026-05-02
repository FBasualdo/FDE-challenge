"""Route registration bootstrap."""

import logging
from importlib import import_module
from pathlib import Path

from fastapi import APIRouter, FastAPI

logger = logging.getLogger("carrier_sales.bootstrap")


def register_routes(app: FastAPI) -> None:
    app_dir = Path(__file__).parent
    registered: list[tuple[str, str]] = []

    for group in ["built_in", "features"]:
        group_dir = app_dir / group
        if not group_dir.exists():
            continue
        for module_dir in sorted(group_dir.iterdir()):
            router_file = module_dir / "router.py"
            if not router_file.exists():
                continue
            module = import_module(f"src.app.{group}.{module_dir.name}.router")
            router = getattr(module, "router", None)
            if isinstance(router, APIRouter):
                app.include_router(router)
                registered.append((group, module_dir.name))

    for route in app.routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        if methods and path and not path.startswith(("/openapi", "/docs", "/redoc")):
            logger.info("route registered %s %s", ",".join(sorted(methods)), path)

    logger.info("modules registered: %d", len(registered))
