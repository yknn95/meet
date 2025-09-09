#!/bin/bash

set -ex

name=livekit-minio
image="minio/minio:RELEASE.2022-03-17T06-34-49Z"

docker rm -f $name || echo

docker run -d --name $name --restart always \
  -p 31060:31060 \
  -p 31061:31061 \
  -e TZ="Asia/Shanghai" \
  -e MINIO_ACCESS_KEY=admin \
  -e MINIO_SECRET_KEY=admin123 \
  -v /opt/livekit/minio-data:/data \
  $image minio server /data --json --address ":31060" --console-address ":31061"
