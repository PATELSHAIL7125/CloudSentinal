"""CloudSentinel Test 7: block ALB traffic to one instance through its SG.

For safety, the security group must be dedicated to exactly one healthy target.
All revoked HTTP ingress permissions are restored before this script exits.
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
DEFAULT_BLOCK_THRESHOLD_SECONDS = 60
DEFAULT_OBSERVATION_SECONDS = 30
RESTORE_TIMEOUT_SECONDS = 300


def required_setting(name: str) -> str:
    value = os.getenv(name)
    if not value or value.startswith("replace_") or "replace_with" in value:
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


def request_alb(alb_dns_name: str) -> tuple[bool, str]:
    url = alb_dns_name if alb_dns_name.startswith("http") else f"http://{alb_dns_name}"
    try:
        with urlopen(url, timeout=10) as response:  # nosec B310 - user-owned ALB endpoint
            return response.status == 200, f"HTTP {response.status}"
    except HTTPError as error:
        return False, f"HTTP {error.code}"
    except URLError as error:
        return False, f"Connection error: {error.reason}"
    except (TimeoutError, OSError) as error:
        return False, f"Connection error: {error}"


def healthy_target_ids(descriptions: list[dict]) -> list[str]:
    return sorted(
        description["Target"]["Id"]
        for description in descriptions
        if description["TargetHealth"]["State"] == "healthy"
    )


def instance_security_group_ids(ec2, instance_ids: list[str]) -> dict[str, set[str]]:
    response = ec2.describe_instances(InstanceIds=instance_ids)
    return {
        instance["InstanceId"]: {group["GroupId"] for group in instance.get("SecurityGroups", [])}
        for reservation in response.get("Reservations", [])
        for instance in reservation.get("Instances", [])
    }


def get_http_ingress_permissions(ec2, security_group_id: str) -> list[dict]:
    response = ec2.describe_security_groups(GroupIds=[security_group_id])
    permissions = response["SecurityGroups"][0].get("IpPermissions", [])
    http_permissions = [
        permission
        for permission in permissions
        if permission.get("IpProtocol") == "tcp"
        and permission.get("FromPort") == 80
        and permission.get("ToPort") == 80
    ]
    if not http_permissions:
        raise SystemExit(
            "The dedicated Test 7 security group has no inbound HTTP/80 rule to revoke."
        )
    return http_permissions


def security_group_allows_http(ec2, security_group_id: str) -> bool:
    """Return whether a group permits inbound TCP port 80 from any source."""
    response = ec2.describe_security_groups(GroupIds=[security_group_id])
    return any(
        permission.get("IpProtocol") == "tcp"
        and permission.get("FromPort") == 80
        and permission.get("ToPort") == 80
        for permission in response["SecurityGroups"][0].get("IpPermissions", [])
    )


def wait_for_target_healthy(elbv2, target_group_arn: str, instance_id: str) -> bool:
    deadline = time.monotonic() + RESTORE_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if target_state(target_descriptions(elbv2, target_group_arn), instance_id) == "healthy":
            return True
        time.sleep(POLL_INTERVAL_SECONDS)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CloudSentinel Test 7.")
    parser.add_argument(
        "--confirm-sg-block",
        action="store_true",
        help="Required before the script revokes HTTP ingress from the dedicated SG.",
    )
    args = parser.parse_args()

    asg_name = required_setting("CLOUDSENTINEL_ASG_NAME")
    alb_dns_name = required_setting("CLOUDSENTINEL_ALB_DNS_NAME")
    security_group_id = required_setting("CLOUDSENTINEL_TEST7_SECURITY_GROUP_ID")
    block_threshold = int(
        os.getenv("CLOUDSENTINEL_SG_BLOCK_THRESHOLD_SECONDS", DEFAULT_BLOCK_THRESHOLD_SECONDS)
    )
    observation_seconds = int(
        os.getenv("CLOUDSENTINEL_SG_OBSERVATION_SECONDS", DEFAULT_OBSERVATION_SECONDS)
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
        healthy_ids = healthy_target_ids(target_descriptions(elbv2, target_group_arn))
        if len(healthy_ids) < 2:
            raise SystemExit("Test 7 requires at least two healthy targets before starting.")
        groups_by_instance = instance_security_group_ids(ec2, healthy_ids)
        selected_ids = [
            instance_id
            for instance_id in healthy_ids
            if security_group_id in groups_by_instance.get(instance_id, set())
        ]
        if len(selected_ids) != 1:
            raise SystemExit(
                "Safety check failed: the configured Test 7 security group must be attached to "
                "exactly one healthy target, not zero or multiple targets."
            )
        selected_id = selected_ids[0]
        other_groups_allowing_http = [
            group_id
            for group_id in groups_by_instance[selected_id]
            if group_id != security_group_id and security_group_allows_http(ec2, group_id)
        ]
        if other_groups_allowing_http:
            raise SystemExit(
                "Safety check failed: the selected instance also receives HTTP/80 through "
                f"other security groups ({', '.join(other_groups_allowing_http)}). Remove or "
                "replace those HTTP rules before Test 7, otherwise blocking the dedicated group "
                "would not simulate a failure."
            )
        permissions = get_http_ingress_permissions(ec2, security_group_id)
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS setup check failed: {error}") from error

    print(f"Auto Scaling Group: {asg_name}")
    print(f"Dedicated Test 7 security group: {security_group_id}")
    print(f"Selected target: {selected_id}")

    if not args.confirm_sg_block:
        print("Preview only - no Security Group rule was changed.")
        print("To run the test, add the --confirm-sg-block flag.")
        return

    revoked = False
    try:
        preflight_ok, preflight_result = request_alb(alb_dns_name)
        if not preflight_ok:
            raise SystemExit(f"Preflight failed ({preflight_result}). Fix ALB access first.")
        print(f"Preflight ALB request: {preflight_result}")
        print(f"Injecting failure: revoking HTTP/80 from {security_group_id}...")
        ec2.revoke_security_group_ingress(
            GroupId=security_group_id, IpPermissions=permissions
        )
        revoked = True

        started_at = time.monotonic()
        blocked_at: float | None = None
        while time.monotonic() - started_at <= block_threshold:
            elapsed = int(time.monotonic() - started_at)
            descriptions = target_descriptions(elbv2, target_group_arn)
            state = target_state(descriptions, selected_id)
            other_healthy = len(healthy_target_ids(descriptions)) - (state == "healthy")
            request_ok, request_result = request_alb(alb_dns_name)
            print(
                f"{elapsed:>3}s | blocked target: {state} | other healthy targets: "
                f"{other_healthy} | ALB: {request_result}"
            )
            if not request_ok:
                print("FAIL - an ALB request failed while traffic was expected to reroute.")
                raise SystemExit(1)
            if state == "unhealthy" and other_healthy >= 1:
                blocked_at = time.monotonic()
                print("Block detected; starting sustained availability observation.")
                break
            time.sleep(POLL_INTERVAL_SECONDS)

        if blocked_at is None:
            print("FAIL - ALB did not mark the blocked target unhealthy within the threshold.")
            raise SystemExit(1)

        while time.monotonic() - blocked_at < observation_seconds:
            request_ok, request_result = request_alb(alb_dns_name)
            elapsed = int(time.monotonic() - started_at)
            print(f"{elapsed:>3}s | observation | ALB: {request_result}")
            if not request_ok:
                print("FAIL - an ALB request failed during the observation period.")
                raise SystemExit(1)
            time.sleep(POLL_INTERVAL_SECONDS)

        print("PASS - blocked target became unhealthy and ALB traffic stayed available.")
    except (BotoCoreError, ClientError) as error:
        raise SystemExit(f"AWS test failed: {error}") from error
    finally:
        if revoked:
            print(f"Restoring HTTP/80 ingress to {security_group_id}...")
            try:
                ec2.authorize_security_group_ingress(
                    GroupId=security_group_id, IpPermissions=permissions
                )
                if wait_for_target_healthy(elbv2, target_group_arn, selected_id):
                    print("Restore complete - target is healthy again.")
                else:
                    print("Restore submitted, but target did not become healthy within 300 seconds.")
            except (BotoCoreError, ClientError) as error:
                print(f"WARNING - automatic Security Group restore failed: {error}")


if __name__ == "__main__":
    main()
