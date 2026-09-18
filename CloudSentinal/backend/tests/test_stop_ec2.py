"""CloudSentinel Test 1: stop an ASG instance and measure automatic recovery.

Run without --confirm-stop to preview the selected instance. The script performs no
AWS mutation until the confirmation flag is explicitly supplied.
"""

from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

POLL_INTERVAL_SECONDS = 5
DEFAULT_RECOVERY_THRESHOLD_SECONDS = 180


def required_setting(name: str) -> str:
    """Return a required environment setting or stop with a useful message."""
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing {name} in backend/.env.")
    return value


def get_asg(autoscaling, asg_name: str) -> dict:
    """Load the configured Auto Scaling Group."""
    response = autoscaling.describe_auto_scaling_groups(
        AutoScalingGroupNames=[asg_name]
    )
    groups = response.get("AutoScalingGroups", [])
    if not groups:
        raise SystemExit(f"Auto Scaling Group '{asg_name}' was not found.")
    return groups[0]


def target_health_by_instance(elbv2, target_group_arn: str) -> dict[str, str]:
    """Return ALB target-health states keyed by EC2 instance ID."""
    response = elbv2.describe_target_health(TargetGroupArn=target_group_arn)
    return {
        description["Target"]["Id"]: description["TargetHealth"]["State"]
        for description in response.get("TargetHealthDescriptions", [])
    }


def select_healthy_instance(asg: dict, health: dict[str, str]) -> str:
    """Choose one healthy, in-service ASG instance to stop."""
    candidates = sorted(
        instance["InstanceId"]
        for instance in asg.get("Instances", [])
        if instance["LifecycleState"] == "InService"
        and health.get(instance["InstanceId"]) == "healthy"
    )
    if not candidates:
        raise SystemExit(
            "No healthy InService instance was found. Wait for the target group to be healthy."
        )
    return candidates[0]


def recovery_succeeded(
    asg: dict,
    health: dict[str, str],
    desired_capacity: int,
    initial_instance_ids: set[str],
) -> bool:
    """Require both restored capacity and a healthy newly launched replacement."""
    healthy_in_service = [
        instance["InstanceId"]
        for instance in asg.get("Instances", [])
        if instance["LifecycleState"] == "InService"
        and health.get(instance["InstanceId"]) == "healthy"
    ]
    healthy_replacements = [
        instance_id
        for instance_id in healthy_in_service
        if instance_id not in initial_instance_ids
    ]
    return len(healthy_in_service) >= desired_capacity and bool(healthy_replacements)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CloudSentinel Test 1.")
    parser.add_argument(
        "--confirm-stop",
        action="store_true",
        help="Required before the script stops an EC2 instance.",
    )
    args = parser.parse_args()

    asg_name = required_setting("CLOUDSENTINEL_ASG_NAME")
    threshold_seconds = int(
        os.getenv(
            "CLOUDSENTINEL_RECOVERY_THRESHOLD_SECONDS",
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
            raise SystemExit(
                "Expected exactly one target group attached to the Auto Scaling Group."
            )
        target_group_arn = target_groups[0]
        health = target_health_by_instance(elbv2, target_group_arn)
        instance_id = select_healthy_instance(asg, health)
        desired_capacity = asg["DesiredCapacity"]
        initial_instance_ids = {
            instance["InstanceId"] for instance in asg.get("Instances", [])
        }
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS setup check failed: {error}") from error

    print(f"Auto Scaling Group: {asg_name}")
    print(f"Target Group: {target_group_arn}")
    print(f"Selected healthy instance: {instance_id}")
    print(f"Recovery threshold: {threshold_seconds} seconds")

    if not args.confirm_stop:
        print("Preview only - no instance was stopped.")
        print("To run the test, add the --confirm-stop flag.")
        return

    try:
        print(f"Injecting failure: stopping {instance_id}...")
        ec2.stop_instances(InstanceIds=[instance_id])
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"Could not stop {instance_id}: {error}") from error

    started_at = time.monotonic()
    while time.monotonic() - started_at <= threshold_seconds:
        elapsed = int(time.monotonic() - started_at)
        try:
            asg = get_asg(autoscaling, asg_name)
            health = target_health_by_instance(elbv2, target_group_arn)
        except (BotoCoreError, ClientError) as error:
            raise SystemExit(f"Could not poll recovery state: {error}") from error

        healthy_ids = sorted(
            instance["InstanceId"]
            for instance in asg.get("Instances", [])
            if instance["LifecycleState"] == "InService"
            and health.get(instance["InstanceId"]) == "healthy"
        )
        healthy_replacement_ids = [
            healthy_id
            for healthy_id in healthy_ids
            if healthy_id not in initial_instance_ids
        ]
        print(
            f"{elapsed:>3}s | healthy capacity: {len(healthy_ids)}/"
            f"{desired_capacity} | new healthy replacement: "
            f"{', '.join(healthy_replacement_ids) or 'none'}"
        )

        if recovery_succeeded(asg, health, desired_capacity, initial_instance_ids):
            print(f"PASS - ASG restored healthy capacity in {elapsed} seconds.")
            return
        time.sleep(POLL_INTERVAL_SECONDS)

    print(f"FAIL - ASG did not restore healthy capacity within {threshold_seconds} seconds.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
