"""Reliability report endpoints."""

from fastapi import APIRouter, HTTPException

from backend import models


router = APIRouter(tags=["reports"])


@router.get("/reports/{run_id}")
def get_report(run_id: str) -> dict:
    run = models.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Report not found.")
    recommendation = (
        "Review the test output and reduce recovery time before production use."
        if run["status"] == "failed"
        else "Reliability behavior met the configured test criteria."
    )
    return {
        "run_id": run["id"],
        "test_name": run["test_name"],
        "result": run["status"],
        "summary": run["summary"],
        "started_at": run["started_at"],
        "finished_at": run["finished_at"],
        "recommendation": recommendation,
        "output": run["output"],
    }
