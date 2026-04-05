#!/usr/bin/env bash
# Starts SeaweedFS (weed mini) in Docker, waits for the S3 port, then creates a bucket via S3 API (curl + SigV4).
# Intended for E2E and local runs; not for production.
#
# Required environment variables:
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY — passed into the container and used by curl (see SeaweedFS wiki)
#   S3_BUCKET        — bucket name
# Optional:
#   S3_PORT          — S3 gateway port (default 8333)
#   SEAWEED_IMAGE    — image (default chrislusf/seaweedfs:latest)
#   S3_HOST          — host for curl (default 127.0.0.1)
#   SEAWEED_CONTAINER_NAME — docker container name (default seaweed)

set -euo pipefail
set -x

S3_PORT="${S3_PORT:-8333}"
S3_BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
SEAWEED_IMAGE="${SEAWEED_IMAGE:-chrislusf/seaweedfs:latest}"
S3_HOST="${S3_HOST:-127.0.0.1}"

CONTAINER_NAME="${SEAWEED_CONTAINER_NAME:-seaweed}"

echo "==> Starting SeaweedFS (${SEAWEED_IMAGE}), S3 on :${S3_PORT}"
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
docker run -d --name "${CONTAINER_NAME}" \
  -p "${S3_PORT}:${S3_PORT}" \
  -e AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
  -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
  "${SEAWEED_IMAGE}" \
  server -s3

# Loop for up to 60 seconds to wait for S3 API to be responsive (beyond just the TCP port).
echo "==> Waiting for SeaweedFS S3 API to respond to S3 requests"
for _ in $(seq 1 60); do
  # Attempt to list buckets (which only checks API, not port). Use curl with SigV4 auth.
  set +e
  s3_resp_code="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      --max-time 2 \
      --aws-sigv4 "aws:amz:us-east-1:s3" \
      -u "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" \
      "http://${S3_HOST}:${S3_PORT}/"
  )"
  set -e

  # Success if HTTP 200 (OK) for ListBuckets.
  if [ "$s3_resp_code" = "200" ]; then
    echo "S3 API is up (HTTP 200)"
    break
  fi

  sleep 1
done

if [ "$s3_resp_code" != "200" ]; then
  echo "S3 API did not respond with HTTP 200 in time (got $s3_resp_code)" >&2
  docker logs "${CONTAINER_NAME}" || true
  exit 1
fi


echo "==> CreateBucket: PUT /${S3_BUCKET}/ (curl --aws-sigv4)"
code="$(
  curl -sS -o /tmp/s3-mb-body.txt -w "%{http_code}" \
    --aws-sigv4 "aws:amz:us-east-1:s3" \
    -u "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" \
    -X PUT \
    "http://${S3_HOST}:${S3_PORT}/${S3_BUCKET}/"
)"
echo "HTTP ${code}"
cat /tmp/s3-mb-body.txt || true
case "${code}" in
  200|204) echo "bucket created" ;;
  409) echo "bucket already exists (ok)" ;;
  *)
    echo "unexpected HTTP status" >&2
    exit 1
    ;;
esac

echo "==> s3_up: done"
