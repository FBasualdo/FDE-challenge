from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/check")
async def health() -> dict:
    return {"status": "ok"}
