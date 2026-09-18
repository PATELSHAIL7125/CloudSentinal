"""CloudSentinel Test 4: reboot one EC2 target while preserving ALB availability."""

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
DEFAULT_RECOVERY_THRESHOLD_SECONDS = 60


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


def target_state(descriptions: list[dict], instance_id: str) -> str:
    for description in descriptions:
        if description["Target"]["Id"] == instance_id:
            return description["TargetHealth"]["State"]
    return "unused"


def select_healthy_instance(descriptions: list[dict]) -> str:
    healthy_ids = sorted(
        description["Target"]["Id"]
        for description in descriptions
        if description["TargetHealth"]["State"] == "healthy"
    )
    if len(healthy_ids) < 2:
        raise SystemExit("Test 4 requires at least two healthy targets before rebooting one.")
    return healthy_ids[0]


def request_alb(alb_dns_name: str) -> tuple[bool, str]:
    """Make one request through the user-owned ALB."""
    url = alb_dns_name if alb_dns_name.startswith("http") else f"http://{alb_dns_name}"
    try:
        with urlopen(url, timeout=10) as response:  # nosec B310 - user-owned endpoint
            return response.status == 200, f"HTTP {response.status}"
    except HTTPError as error:
        return False, f"HTTP {error.code}"
    except URLError as error:
        return False, f"Connection error: {error.reason}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CloudSentinel Test 4.")
    parser.add_argument(
        "--confirm-reboot",
        action="store_true",
        help="Required before the script reboots an EC2 instance.",
    )
    args = parser.parse_args()

    asg_name = required_setting("CLOUDSENTINEL_ASG_NAME")
    alb_dns_name = required_setting("CLOUDSENTINEL_ALB_DNS_NAME")
    threshold_seconds = int(
        os.getenv(
            "CLOUDSENTINEL_REBOOT_RECOVERY_THRESHOLD_SECONDS",
            str(DEFAULT_RECOVERY_THRESHOLD_SECONDS),
        )
    )

    try:
        ec2 = boto3.client("ec2")
        autoscaling = boto3.client("autoscaling")
        elbv2 = boto3.client("elbv2")
        asg = get_asg(autoscaling, asg_name)
        target_groups = asg.get("TargetGroupARNs", [])
        if len(target_groups) != 1:
            raise SystemExit("Expected exactly one target group on the Auto Scaling Group.")
        target_group_arn = target_groups[0]
        instance_id = select_healthy_instance(target_descriptions(elbv2, target_group_arn))
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS setup check failed: {error}") from error

    print(f"Auto Scaling Group: {asg_name}")
    print(f"Selected healthy instance: {instance_id}")
    print(f"Reboot recovery threshold: {threshold_seconds} seconds")

    if not args.confirm_reboot:
        print("Preview only - no instance was rebooted.")
        print("To run the test, add the --confirm-reboot flag.")
        return

    try:
        preflight_ok, preflight_result = request_alb(alb_dns_name)
        if not preflight_ok:
            raise SystemExit(
                f"Preflight failed ({preflight_result}). Fix ALB access before running Test 4."
            )
        print(f"Preflight ALB request: {preflight_result}")
        print(f"Injecting failure: rebooting {instance_id}...")
        ec2.reboot_instances(InstanceIds=[instance_id])
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"Could not reboot {instance_id}: {error}") from error

    started_at = time.monotonic()
    request_failures = 0
    target_became_unhealthy = False
    while time.monotonic() - started_at <= threshold_seconds:
        elapsed = int(time.monotonic() - started_at)
        try:
            descriptions = target_descriptions(elbv2, target_group_arn)
        except (BotoCoreError, ClientError) as error:
            raise SystemExit(f"Could not poll target health: {error}") from error

        rebooted_target_state = target_state(descriptions, instance_id)
        other_healthy_count = sum(
            description["TargetHealth"]["State"] == "healthy"
            and description["Target"]["Id"] != instance_id
            for description in descriptions
        )
        if rebooted_target_state != "healthy":
            target_became_unhealthy = True
        request_ok, request_result = request_alb(alb_dns_name)
        request_failures += not request_ok
        print(
            f"{elapsed:>3}s | rebooted target: {rebooted_target_state} | "
            f"other healthy targets: {other_healthy_count} | ALB: {request_result}"
        )

        if request_failures:
            print("FAIL - one or more sampled ALB requests failed during the reboot.")
            raise SystemExit(1)

        # Wait the full threshold: ALB health state can remain cached for several checks.
        if elapsed >= threshold_seconds:
            break
        time.sleep(POLL_INTERVAL_SECONDS)

    final_state = target_state(target_descriptions(elbv2, target_group_arn), instance_id)
    if final_state == "healthy" and request_failures == 0:
        transition_note = (
            "The target temporarily left healthy state and recovered."
            if target_became_unhealthy
            else "The target remained healthy according to the ALB checks during sampling."
        )
        print(
            "PASS - the ALB stayed available and the rebooted target was healthy within "
            f"{threshold_seconds} seconds. {transition_note}"
        )
        return

    print(
        f"FAIL - rebooted target state was '{final_state}' after {threshold_seconds} seconds."
    )
    raise SystemExit(1)


if __name__ == "__main__":
    main()
