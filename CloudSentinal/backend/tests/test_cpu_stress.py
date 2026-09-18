"""CloudSentinel Test 6: CPU stress triggers a CloudWatch ASG scale-out.

This implementation uses AWS Systems Manager Run Command. It stresses every
healthy ASG target so a group-level CPU alarm can reliably cross its threshold.
The remote stress command ends automatically after the configured duration.
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

POLL_INTERVAL_SECONDS = 10
DEFAULT_STRESS_DURATION_SECONDS = 360
DEFAULT_SCALE_OUT_THRESHOLD_SECONDS = 300
DEFAULT_TEST_TIMEOUT_SECONDS = 900


def required_setting(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing {name} in backend/.env.")
    return value


def int_setting(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise SystemExit(f"{name} must be a positive number.")
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


def get_alarm(cloudwatch, alarm_name: str) -> dict:
    response = cloudwatch.describe_alarms(AlarmNames=[alarm_name])
    alarms = response.get("MetricAlarms", [])
    if not alarms:
        raise SystemExit(f"CloudWatch alarm '{alarm_name}' was not found.")
    alarm = alarms[0]
    if not alarm.get("ActionsEnabled") or not alarm.get("AlarmActions"):
        raise SystemExit(
            "The CloudWatch alarm has no enabled alarm action. Attach an ASG scale-out policy first."
        )
    return alarm


def build_stress_command(duration_seconds: int) -> str:
    """Install stress-ng if needed, then run one CPU worker in the background."""
    return (
        "set -e; "
        "if command -v stress-ng >/dev/null 2>&1; then true; "
        "elif command -v apt-get >/dev/null 2>&1; then "
        "apt-get update -y && apt-get install -y stress-ng; "
        "elif command -v dnf >/dev/null 2>&1; then "
        "dnf install -y stress-ng; "
        "elif command -v yum >/dev/null 2>&1; then "
        "yum install -y stress-ng; "
        "else echo 'No supported package manager found'; exit 1; fi; "
        f"nohup stress-ng --cpu \"$(nproc)\" --timeout {duration_seconds}s "
        ">/tmp/cloudsentinel-cpu-stress.log 2>&1 </dev/null &"
    )


def verify_ssm_managed_instance(ssm, instance_id: str) -> None:
    """Ensure Systems Manager sees the selected EC2 instance as online."""
    response = ssm.describe_instance_information(
        Filters=[{"Key": "InstanceIds", "Values": [instance_id]}]
    )
    information = response.get("InstanceInformationList", [])
    if not information:
        raise SystemExit(
            "The instance is not registered in Systems Manager yet. Confirm it has the "
            "CloudSentinel-EC2-SSMRole and wait a few minutes after the instance refresh."
        )
    if information[0].get("PingStatus") != "Online":
        raise SystemExit(
            f"The SSM managed instance is not online (status: {information[0].get('PingStatus')})."
        )


def start_cpu_stress(ssm, instance_ids: list[str], duration_seconds: int) -> str:
    """Start the bounded stress command through AWS Systems Manager Run Command."""
    response = ssm.send_command(
        InstanceIds=instance_ids,
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": [build_stress_command(duration_seconds)]},
        TimeoutSeconds=120,
        Comment="CloudSentinel Test 6 CPU stress",
    )
    command_id = response["Command"]["CommandId"]
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        time.sleep(3)
        statuses: list[str] = []
        for instance_id in instance_ids:
            try:
                invocation = ssm.get_command_invocation(
                    CommandId=command_id, InstanceId=instance_id
                )
            except ClientError as error:
                if error.response["Error"]["Code"] == "InvocationDoesNotExist":
                    statuses = []
                    break
                raise
            status = invocation["Status"]
            if status in {"Cancelled", "Failed", "TimedOut", "Cancelling"}:
                detail = invocation.get("StandardErrorContent", "").strip()
                raise SystemExit(f"SSM CPU stress command {status}: {detail}")
            statuses.append(status)
        if statuses and all(status == "Success" for status in statuses):
            return command_id
    raise SystemExit("Timed out waiting for Systems Manager to start the CPU stress command.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CloudSentinel Test 6.")
    parser.add_argument(
        "--confirm-cpu-stress",
        action="store_true",
        help="Required before the script runs CPU stress on an EC2 instance.",
    )
    args = parser.parse_args()

    asg_name = required_setting("CLOUDSENTINEL_ASG_NAME")
    alarm_name = required_setting("CLOUDSENTINEL_CPU_ALARM_NAME")
    stress_duration = int_setting(
        "CLOUDSENTINEL_CPU_STRESS_DURATION_SECONDS", DEFAULT_STRESS_DURATION_SECONDS
    )
    scale_out_threshold = int_setting(
        "CLOUDSENTINEL_CPU_SCALE_OUT_THRESHOLD_SECONDS", DEFAULT_SCALE_OUT_THRESHOLD_SECONDS
    )
    test_timeout = int_setting(
        "CLOUDSENTINEL_CPU_TEST_TIMEOUT_SECONDS", DEFAULT_TEST_TIMEOUT_SECONDS
    )

    try:
        autoscaling = boto3.client("autoscaling")
        elbv2 = boto3.client("elbv2")
        cloudwatch = boto3.client("cloudwatch")
        ssm = boto3.client("ssm")
        asg = get_asg(autoscaling, asg_name)
        target_groups = asg.get("TargetGroupARNs", [])
        if len(target_groups) != 1:
            raise SystemExit("Expected exactly one target group on the Auto Scaling Group.")
        target_group_arn = target_groups[0]
        healthy_ids = healthy_target_ids(elbv2, target_group_arn)
        if len(healthy_ids) < 2:
            raise SystemExit("Test 6 requires at least two healthy targets before starting.")
        stress_instance_ids = healthy_ids
        alarm = get_alarm(cloudwatch, alarm_name)
        for stress_instance_id in stress_instance_ids:
            verify_ssm_managed_instance(ssm, stress_instance_id)
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS setup check failed: {error}") from error

    initial_instance_ids = {instance["InstanceId"] for instance in asg.get("Instances", [])}
    initial_desired = asg["DesiredCapacity"]
    print(f"Auto Scaling Group: {asg_name}")
    print(f"CPU stress instances: {', '.join(stress_instance_ids)}")
    print(f"CloudWatch alarm: {alarm_name} ({alarm['StateValue']})")
    print(f"Initial desired capacity: {initial_desired}")
    print(f"Stress duration: {stress_duration} seconds")

    if not args.confirm_cpu_stress:
        print("Preview only - CPU stress was not started.")
        print("To run the test, add the --confirm-cpu-stress flag.")
        return

    print("Injecting failure: starting CPU stress on healthy targets through SSM...")
    command_id = start_cpu_stress(ssm, stress_instance_ids, stress_duration)
    print(f"SSM command started: {command_id}")
    print("CPU stress started. Polling CloudWatch alarm and Auto Scaling Group...")

    started_at = time.monotonic()
    alarm_triggered_at: float | None = None
    while time.monotonic() - started_at <= test_timeout:
        elapsed = int(time.monotonic() - started_at)
        try:
            alarm = get_alarm(cloudwatch, alarm_name)
            asg = get_asg(autoscaling, asg_name)
        except (BotoCoreError, ClientError) as error:
            raise SystemExit(f"Could not poll scale-out progress: {error}") from error

        current_ids = {instance["InstanceId"] for instance in asg.get("Instances", [])}
        new_ids = sorted(current_ids - initial_instance_ids)
        print(
            f"{elapsed:>3}s | alarm: {alarm['StateValue']} | desired: "
            f"{asg['DesiredCapacity']} | new instances: {', '.join(new_ids) or 'none'}"
        )

        if alarm["StateValue"] == "ALARM" and alarm_triggered_at is None:
            alarm_triggered_at = time.monotonic()
            print("CloudWatch alarm triggered; measuring time to a new instance launch.")

        if alarm_triggered_at is not None and new_ids and asg["DesiredCapacity"] > initial_desired:
            scale_out_elapsed = int(time.monotonic() - alarm_triggered_at)
            if scale_out_elapsed <= scale_out_threshold:
                print(
                    "PASS - alarm triggered scale-out and new instance(s) launched in "
                    f"{scale_out_elapsed} seconds: {', '.join(new_ids)}"
                )
                return
            print(
                "FAIL - scale-out occurred, but exceeded the "
                f"{scale_out_threshold}-second threshold after the alarm."
            )
            raise SystemExit(1)

        time.sleep(POLL_INTERVAL_SECONDS)

    if alarm_triggered_at is None:
        print("FAIL - CloudWatch alarm did not enter ALARM state during the test window.")
    else:
        print("FAIL - alarm triggered but did not launch a new instance within the test window.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
