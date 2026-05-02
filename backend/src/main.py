import json
import logging
import logging.handlers
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.app.bootstrap import register_routes
from src.app.features.inbound_carrier_sales.db import init_db
from src.settings import get_settings

access_logger = logging.getLogger("carrier_sales.access")
validation_logger = logging.getLogger("carrier_sales.validation")

_LOG_FORMAT = logging.Formatter(
    "%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

_LOG_FILE = Path(__file__).parents[1] / "app.log"
_file_handler = logging.handlers.RotatingFileHandler(
    _LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8"
)
_file_handler.setFormatter(_LOG_FORMAT)

# Stream handler so logs land in stdout/stderr too — needed for Railway's
# log capture, otherwise our INFO/WARNING lines only go to app.log inside
# the container and are invisible in the dashboard.
_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(_LOG_FORMAT)

_root = logging.getLogger()
_root.addHandler(_file_handler)
_root.addHandler(_stream_handler)
_root.setLevel(logging.INFO)

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
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Cookie",
        "X-API-Key",
        "X-Requested-With",
    ],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def access_log_middleware(request: Request, call_next):
    request_id = uuid.uuid4().hex[:8]
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    access_logger.info(
        "%s %s %s %d %.1fms",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", "—")
    body_bytes = await request.body()
    try:
        body_repr = json.loads(body_bytes) if body_bytes else None
    except (ValueError, TypeError):
        body_repr = body_bytes.decode("utf-8", errors="replace")[:2000]

    validation_logger.warning(
        "[%s] 422 %s %s — %d errors — body=%s",
        request_id,
        request.method,
        request.url.path,
        len(exc.errors()),
        json.dumps(body_repr, default=str)[:2000],
    )
    for err in exc.errors():
        validation_logger.warning(
            "[%s]   field=%s type=%s msg=%s input=%r",
            request_id,
            ".".join(str(p) for p in err.get("loc", [])),
            err.get("type"),
            err.get("msg"),
            err.get("input"),
        )

    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "request_id": request_id,
        },
    )


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": "carrier-sales-api", "status": "ok"}


register_routes(app)
