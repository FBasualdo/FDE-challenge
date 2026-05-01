import logging
import logging.handlers
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.app.bootstrap import register_routes
from src.app.features.inbound_carrier_sales.db import init_db
from src.settings import get_settings

_LOG_FILE = Path(__file__).parents[1] / "app.log"
_file_handler = logging.handlers.RotatingFileHandler(
    _LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8"
)
_file_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s %(levelname)-8s %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )
)
logging.getLogger().addHandler(_file_handler)
logging.getLogger().setLevel(logging.INFO)

_settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Carrier Sales API",
    version="0.1.0",
    description="Backend for an inbound carrier sales voice agent.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": "carrier-sales-api", "status": "ok"}


register_routes(app)
