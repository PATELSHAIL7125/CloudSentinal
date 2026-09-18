"""Background execution adapter for existing CloudSentinel test scripts."""

from __future__ import annotations

import subprocess
import sys
import threading
from pathlib import Path
from uuid import uuid4

from backend import models
from backend.config import BACKEND_DIR, PROJECT_ROOT


TEST_COMMANDS: dict[str, tuple[str, str]] = {
    "stop-ec2": ("test_stop_ec2.py", "--confirm-stop"),
    "terminate-ec2": ("test_terminate_ec2.py", "--confirm-terminate"),
    "detach-lb": ("test_detach_lb.py", "--confirm-detach"),
    "reboot-ec2": ("test_reboot_ec2.py", "--confirm-reboot"),
    "scale-asg": ("test_scale_asg.py", "--confirm-scale-down"),
    "cpu-stress": ("test_cpu_stress.py", "--confirm-cpu-stress"),
    "sg-block": ("test_sg_block.py", "--confirm-sg-block"),
}


def available_tests() -> list[str]:
    return sorted(TEST_COMMANDS)


def start_run(test_name: str) -> str:
    if test_name not in TEST_COMMANDS:
        raise ValueError(f"Unknown test name: {test_name}")
    run_id = str(uuid4())
    models.create_run(run_id, test_name)
    threading.Thread(target=execute_run, args=(run_id, test_name), daemon=True).start()
    return run_id


def execute_run(run_id: str, test_name: str) -> None:
    script_name, confirmation_flag = TEST_COMMANDS[test_name]
    script_path = BACKEND_DIR / "tests" / script_name
    models.update_run(run_id, status="running", started_at=models.now())
    try:
        process = subprocess.run(
            [sys.executable, str(script_path), confirmation_flag],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=1_200,
        )
        output = (process.stdout + process.stderr).strip()
        status = "passed" if process.returncode == 0 and "PASS" in output else "failed"
        summary = last_result_line(output) or f"Test process finished with exit code {process.returncode}."
        models.update_run(
            run_id,
            status=status,
            finished_at=models.now(),
            exit_code=process.returncode,
            summary=summary,
            output=output,
        )
    except subprocess.TimeoutExpired as error:
        output = ((error.stdout or "") + (error.stderr or "")).strip()
        models.update_run(
            run_id,
            status="failed",
            finished_at=models.now(),
            exit_code=None,
            summary="Test exceeded the 20-minute backend safety timeout.",
            output=output,
        )
    except Exception as error:  # record unexpected process failures for the API client
        models.update_run(
            run_id,
            status="failed",
            finished_at=models.now(),
            exit_code=None,
            summary=f"Backend runner error: {error}",
            output="",
        )


def last_result_line(output: str) -> str | None:
    for line in reversed(output.splitlines()):
        if "PASS" in line or "FAIL" in line:
            return line.strip()
    return None
