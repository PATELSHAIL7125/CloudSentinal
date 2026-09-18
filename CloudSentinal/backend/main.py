"""FastAPI application entry point for CloudSentinel."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend import models
from backend.routes import reports, tests

app = FastAPI(title="CloudSentinel", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(tests.router)
app.include_router(reports.router)


@app.on_event("startup")
def startup() -> None:
    models.initialize_database()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "CloudSentinel API"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

