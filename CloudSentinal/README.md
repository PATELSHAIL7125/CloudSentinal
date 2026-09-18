# CloudSentinel

Cloud reliability validation platform for AWS infrastructure.

## Step 4: Verify AWS connectivity

1. Copy `backend/.env.example` to `backend/.env`.
2. Add your IAM user's access key, secret access key, and AWS Region.
3. From the project root, run:

   ```powershell
   .\.venv\Scripts\python.exe .\backend\check_aws_connection.py
   ```

The script should print the EC2 instances in your selected AWS Region.

## Run the API

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Open `http://127.0.0.1:8000/docs` to use the API documentation. Starting a
reliability test requires the request body `{ "confirm": true }`.
