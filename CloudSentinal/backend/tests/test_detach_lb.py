"""CloudSentinel Test 3: detach one target and verify ALB traffic failover.

The target is always registered again before this script exits after it has
successfully deregistered the target.
"""

from __future__ import annotations

import argparse
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

POLL_INTERVAL_SECONDS = 5
DEFAULT_TRAFFIC_SHIFT_THRESHOLD_SECONDS = 60
DEFAULT_TRAFFIC_OBSERVATION_SECONDS = 30
RESTORE_TIMEOUT_SECONDS = 300


def required_setting(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing {name} in backend/.env.")
    return value


def get_asg(autoscaling, asg_name: str) -> dict:
    response = autoscaling.describe_auto_scaling_groups(
        AutoScalingGroupNames=[asg_name]
    )
    groups = response.get("AutoScalingGroups", [])
    if not groups:
        raise SystemExit(f"Auto Scaling Group '{asg_name}' was not found.")
    return groups[0]


def target_descriptions(elbv2, target_group_arn: str) -> list[dict]:
    response = elbv2.describe_target_health(TargetGroupArn=target_group_arn)
    return response.get("TargetHealthDescriptions", [])


def request_alb(alb_dns_name: str) -> tuple[bool, str]:
    """Make one HTTP request through the ALB and report whether it succeeded."""
    url = alb_dns_name if alb_dns_name.startswith("http") else f"http://{alb_dns_name}"
    try:
        with urlopen(url, timeout=10) as response:  # nosec B310 - user-owned ALB endpoint
            return response.status == 200, f"HTTP {response.status}"
    except HTTPError as error:
        return False, f"HTTP {error.code}"
    except URLError as error:
        return False, f"Connection error: {error.reason}"


def select_target(descriptions: list[dict]) -> dict:
    healthy_targets = sorted(
        (
            description["Target"]
            for description in descriptions
            if description["TargetHealth"]["State"] == "healthy"
        ),
        key=lambda target: target["Id"],
    )
    if len(healthy_targets) < 2:
        raise SystemExit("Test 3 requires at least two healthy targets before detaching one.")
    return healthy_targets[0]


def target_state(descriptions: list[dict], instance_id: str) -> str:
    for description in descriptions:
        if description["Target"]["Id"] == instance_id:
            return description["TargetHealth"]["State"]
    return "unused"


def wait_for_target_healthy(elbv2, target_group_arn: str, instance_id: str) -> bool:
    """Wait for the restored target to become healthy again."""
    deadline = time.monotonic() + RESTORE_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        descriptions = target_descriptions(elbv2, target_group_arn)
        if target_state(descriptions, instance_id) == "healthy":
            return True
        time.sleep(POLL_INTERVAL_SECONDS)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CloudSentinel Test 3.")
    parser.add_argument(
        "--confirm-detach",
        action="store_true",
        help="Required before the script deregisters a target from the ALB.",
    )
    args = parser.parse_args()

    asg_name = required_setting("CLOUDSENTINEL_ASG_NAME")
    alb_dns_name = required_setting("CLOUDSENTINEL_ALB_DNS_NAME")
    threshold_seconds = int(
        os.getenv(
            "CLOUDSENTINEL_TRAFFIC_SHIFT_THRESHOLD_SECONDS",
            str(DEFAULT_TRAFFIC_SHIFT_THRESHOLD_SECONDS),
        )
    )
    observation_seconds = int(
        os.getenv(
            "CLOUDSENTINEL_TRAFFIC_OBSERVATION_SECONDS",
            str(DEFAULT_TRAFFIC_OBSERVATION_SECONDS),
        )
    )

    try:
        autoscaling = boto3.client("autoscaling")
        elbv2 = boto3.client("elbv2")
        asg = get_asg(autoscaling, asg_name)
        target_groups = asg.get("TargetGroupARNs", [])
        if len(target_groups) != 1:
            raise SystemExit("Expected exactly one target group on the Auto Scaling Group.")
        target_group_arn = target_groups[0]
        target = select_target(target_descriptions(elbv2, target_group_arn))
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS setup check failed: {error}") from error

    print(f"Auto Scaling Group: {asg_name}")
    print(f"Selected target: {target['Id']}")
    print(f"Traffic-shift threshold: {threshold_seconds} seconds")
    print(f"Observation duration: {observation_seconds} seconds")

    if not args.confirm_detach:
        print("Preview only - no target was deregistered.")
        print("To run the test, add the --confirm-detach flag.")
        return

    deregistered = False
    try:
        preflight_ok, preflight_result = request_alb(alb_dns_name)
        if not preflight_ok:
            raise SystemExit(
                f"Preflight failed ({preflight_result}). Fix ALB access before running Test 3."
            )
        print(f"Preflight ALB request: {preflight_result}")
        print(f"Injecting failure: deregistering target {target['Id']}...")
        elbv2.deregister_targets(TargetGroupArn=target_group_arn, Targets=[target])
        deregistered = True

        started_at = time.monotonic()
        traffic_shifted_at: float | None = None
        request_failures = 0
        while time.monotonic() - started_at <= threshold_seconds:
            elapsed = int(time.monotonic() - started_at)
            descriptions = target_descriptions(elbv2, target_group_arn)
            state = target_state(descriptions, target["Id"])
            remaining_healthy = sum(
                description["TargetHealth"]["State"] == "healthy"
                and description["Target"]["Id"] != target["Id"]
                for description in descriptions
            )
            request_ok, request_result = request_alb(alb_dns_name)
            request_failures += not request_ok
            print(
                f"{elapsed:>3}s | detached target: {state} | "
                f"other healthy targets: {remaining_healthy} | ALB: {request_result}"
            )

            traffic_shifted = state in {"draining", "unused"} and remaining_healthy >= 1
            if traffic_shifted and traffic_shifted_at is None:
                traffic_shifted_at = time.monotonic()
                print("Traffic shift detected; starting sustained availability observation.")

            if request_failures:
                print("FAIL - one or more sampled ALB requests failed during the test.")
                raise SystemExit(1)

            if (
                traffic_shifted_at is not None
                and time.monotonic() - traffic_shifted_at >= observation_seconds
            ):
                print(
                    "PASS - traffic shifted and sampled ALB requests stayed successful for "
                    f"{observation_seconds} seconds."
                )
                return
            time.sleep(POLL_INTERVAL_SECONDS)

        print("FAIL - traffic did not shift cleanly within the configured threshold.")
        raise SystemExit(1)
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS test failed: {error}") from error
    finally:
        if deregistered:
            print(f"Restoring target {target['Id']} to the target group...")
            try:
                elbv2.register_targets(TargetGroupArn=target_group_arn, Targets=[target])
                if wait_for_target_healthy(elbv2, target_group_arn, target["Id"]):
                    print("Restore complete - target is healthy again.")
                else:
                    print("Restore submitted, but target did not become healthy within 300 seconds.")
            except (BotoCoreError, ClientError) as error:
                print(f"WARNING - automatic restore failed: {error}")


if __name__ == "__main__":
    main()
