"""One-time AWS credential and boto3 connectivity check for CloudSentinel."""

from os import getenv
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
from dotenv import load_dotenv


PROJECT_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(PROJECT_BACKEND_DIR / ".env")

REQUIRED_SETTINGS = (
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_DEFAULT_REGION",
)


def main() -> None:
    """List EC2 instances to confirm local credentials can call AWS."""
    missing_settings = [setting for setting in REQUIRED_SETTINGS if not getenv(setting)]
    if missing_settings:
        print(
            "Missing "
            + ", ".join(missing_settings)
            + ". Copy backend/.env.example to backend/.env and fill in your IAM credentials."
        )
        raise SystemExit(1)

    try:
        ec2 = boto3.client("ec2")
        response = ec2.describe_instances()
    except NoCredentialsError:
        print("Credentials not found. Create backend/.env from backend/.env.example.")
        raise SystemExit(1)
    except ClientError as error:
        print(f"AWS rejected the request: {error}")
        raise SystemExit(1)
    except BotoCoreError as error:
        print(f"Could not connect to AWS: {error}")
        raise SystemExit(1)

    instances = [
        instance
        for reservation in response.get("Reservations", [])
        for instance in reservation.get("Instances", [])
    ]

    if not instances:
        print("Connected successfully, but no EC2 instances were found in this AWS Region.")
        return

    print("AWS connection successful. EC2 instances found:")
    for instance in instances:
        print(
            f"ID: {instance['InstanceId']} | "
            f"State: {instance['State']['Name']} | "
            f"Type: {instance['InstanceType']}"
        )


if __name__ == "__main__":
    main()
