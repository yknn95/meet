FROM node:22.13.1-bookworm as builder

RUN set -ex \
  && npm config set strict-ssl false \
  && npm config set registry https://registry.npmmirror.com

COPY package.json /src/
COPY pnpm-lock.yaml /src/

WORKDIR /src

RUN set -ex \
  && npm install -g pnpm \
  && pnpm install \
  && mv node_modules /node_modules

FROM node:22-slim
RUN set -ex \
  && npm config set strict-ssl false \
  && npm config set registry https://registry.npmmirror.com
RUN set -ex \
  && npm install -g pnpm
COPY . /src
COPY --from=builder /node_modules /src/node_modules
WORKDIR /src
RUN set -ex \
  && pnpm build
CMD ["pnpm", "dev"]
