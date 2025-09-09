#!/bin/bash

set -ex

name=livekit-meet
image="docker-hub.tpo.tzoa.com/livekit/meet-demo:v1.5"
docker pull docker-hub.tpo.tzoa.com/livekit/meet-demo:v1.5

docker rm -f $name || echo

docker run -d --name $name --restart always \
  -p 23000:3000 \
  -v /opt/livekit/default.conf:/etc/nginx/conf.d/default.conf \
  $image

docker logs -f $name
