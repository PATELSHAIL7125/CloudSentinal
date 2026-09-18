"""CloudSentinel Test 5: force ASG scale-down, then restore original capacity.

This test is reversible. Once the script has reduced desired capacity, it always
requests the original desired capacity again before it exits.
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
DEFAULT_THRESHOLD_SECONDS = 300


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


def healthy_target_ids(elbv2, target_group_arn: str) -> list[str]:
    response = elbv2.describe_target_health(TargetGroupArn=target_group_arn)
    return sorted(
        description["Target"]["Id"]
        for description in response.get("TargetHealthDescriptions", [])
        if description["TargetHealth"]["State"] == "healthy"
    )


def wait_for_capacity(
    autoscaling,
    elbv2,
    asg_name: str,
    target_group_arn: str,
    expected_desired: int,
    expected_healthy: int,
    threshold_seconds: int,
    stage: str,
) -> bool:
    """Poll ASG and ALB until the expected capacity is established."""
    started_at = time.monotonic()
    while time.monotonic() - started_at <= threshold_seconds:
        elapsed = int(time.monotonic() - started_at)
        asg = get_asg(autoscaling, asg_name)
        healthy_ids = healthy_target_ids(elbv2, target_group_arn)
        in_service_count = sum(
            instance["LifecycleState"] == "InService" for instance in asg.get("Instances", [])
        )
        print(
            f"{stage} {elapsed:>3}s | desired: {asg['DesiredCapacity']} | "
            f"InService: {in_service_count} | healthy: {len(healthy_ids)} | "
            f"{', '.join(healthy_ids) or 'none'}"
        )
        if (
            asg["DesiredCapacity"] == expected_desired
            and len(healthy_ids) >= expected_healthy
        ):
            return True
        time.sleep(POLL_INTERVAL_SECONDS)
    return False


def wait_for_scale_down(
    autoscaling,
    elbv2,
    asg_name: str,
    target_group_arn: str,
    threshold_seconds: int,
) -> bool:
    """Wait until the ASG has actually reduced to one healthy target."""
    started_at = time.monotonic()
    while time.monotonic() - started_at <= threshold_seconds:
        elapsed = int(time.monotonic() - started_at)
        asg = get_asg(autoscaling, asg_name)
        healthy_ids = healthy_target_ids(elbv2, target_group_arn)
        in_service_count = sum(
            instance["LifecycleState"] == "InService" for instance in asg.get("Instances", [])
        )
        print(
            f"Scale-down {elapsed:>3}s | desired: {asg['DesiredCapacity']} | "
            f"InService: {in_service_count} | healthy: {len(healthy_ids)} | "
            f"{', '.join(healthy_ids) or 'none'}"
        )
        if (
            asg["DesiredCapacity"] == 1
            and in_service_count <= 1
            and len(healthy_ids) <= 1
        ):
            return True
        time.sleep(POLL_INTERVAL_SECONDS)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CloudSentinel Test 5.")
    parser.add_argument(
        "--confirm-scale-down",
        action="store_true",
        help="Required before the script changes ASG desired capacity.",
    )
    args = parser.parse_args()

    asg_name = required_setting("CLOUDSENTINEL_ASG_NAME")
    threshold_seconds = int(
        os.getenv(
            "CLOUDSENTINEL_SCALE_ASG_THRESHOLD_SECONDS",
            str(DEFAULT_THRESHOLD_SECONDS),
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
        original_desired = asg["DesiredCapacity"]
        original_healthy = len(healthy_target_ids(elbv2, target_group_arn))
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS setup check failed: {error}") from error

    if original_desired < 2 or original_healthy < 2:
        raise SystemExit(
            "Test 5 requires an ASG desired capacity of at least 2 and two healthy targets."
        )

    print(f"Auto Scaling Group: {asg_name}")
    print(f"Original desired capacity: {original_desired}")
    print(f"Scale/recovery threshold: {threshold_seconds} seconds per stage")

    if not args.confirm_scale_down:
        print("Preview only - ASG desired capacity was not changed.")
        print("To run the test, add the --confirm-scale-down flag.")
        return

    capacity_changed = False
    test_passed = False
    try:
        print("Injecting failure: setting desired capacity to 1...")
        autoscaling.set_desired_capacity(
            AutoScalingGroupName=asg_name,
            DesiredCapacity=1,
            HonorCooldown=False,
        )
        capacity_changed = True

        scale_down_complete = wait_for_scale_down(
            autoscaling,
            elbv2,
            asg_name,
            target_group_arn,
            threshold_seconds=threshold_seconds,
        )
        if not scale_down_complete:
            print("FAIL - ASG did not reach one healthy target within the scale-down threshold.")
            return

        print(f"Restoring desired capacity to {original_desired}...")
        autoscaling.set_desired_capacity(
            AutoScalingGroupName=asg_name,
            DesiredCapacity=original_desired,
            HonorCooldown=False,
        )
        capacity_changed = False

        restore_complete = wait_for_capacity(
            autoscaling,
            elbv2,
            asg_name,
            target_group_arn,
            expected_desired=original_desired,
            expected_healthy=original_healthy,
            threshold_seconds=threshold_seconds,
            stage="Restore",
        )
        if restore_complete:
            test_passed = True
            print("PASS - ASG scaled down and then restored its original healthy capacity.")
        else:
            print("FAIL - ASG did not restore its original healthy capacity within the threshold.")
    except (BotoCoreError, ClientError) as error:
        print(f"FAIL - AWS operation failed: {error}")
    finally:
        if capacity_changed:
            print(f"Safety restore: setting desired capacity back to {original_desired}...")
            try:
                autoscaling.set_desired_capacity(
                    AutoScalingGroupName=asg_name,
                    DesiredCapacity=original_desired,
                    HonorCooldown=False,
                )
                print("Safety restore request submitted.")
            except (BotoCoreError, ClientError) as error:
                print(f"WARNING - safety restore failed: {error}")

    if not test_passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
