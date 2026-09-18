"""Endpoints for starting and inspecting reliability tests."""

from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend import models
from backend.test_runner import available_tests, start_run


router = APIRouter(tags=["tests"])


class StartTestRequest(BaseModel):
    confirm: Literal[True] = Field(
        description="Must be true because every test intentionally changes AWS infrastructure."
    )


@router.get("/tests")
def get_available_tests() -> dict[str, list[str]]:
    return {"tests": available_tests()}


@router.post("/run-test/{test_name}", status_code=status.HTTP_202_ACCEPTED)
def run_test(test_name: str, request: StartTestRequest) -> dict[str, str]:
    del request
    if test_name not in available_tests():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown test. Use one of: {', '.join(available_tests())}",
        )
    run_id = start_run(test_name)
    return {
        "run_id": run_id,
        "status": "queued",
        "status_url": f"/test-runs/{run_id}",
        "report_url": f"/reports/{run_id}",
    }


@router.get("/test-runs")
def get_test_runs() -> list[dict]:
    return models.list_runs()


@router.get("/test-runs/{run_id}")
def get_test_run(run_id: str) -> dict:
    run = models.get_run(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test run not found.")
    return run
