"""Route registration bootstrap."""

from importlib import import_module
from pathlib import Path

from fastapi import APIRouter, FastAPI


def register_routes(app: FastAPI) -> None:
    app_dir = Path(__file__).parent

    for group in ["built_in", "features"]:
        group_dir = app_dir / group
        if not group_dir.exists():
            continue
        for module_dir in sorted(group_dir.iterdir()):
            router_file = module_dir / "router.py"
            if router_file.exists():
                module = import_module(f"src.app.{group}.{module_dir.name}.router")
                router = getattr(module, "router", None)
                if isinstance(router, APIRouter):
                    app.include_router(router)
