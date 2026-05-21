# syntax=docker/dockerfile:1
# chatLibre server — multi-stage build

# Stage 1: build
FROM ubuntu:24.04 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libboost-dev \
    libsodium-dev \
    libopus-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN cmake -B build -S . -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build -j"$(nproc)" \
    && cp build/chatlibre-server /chatlibre-server

# Stage 2: runtime
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsodium23 \
    libopus0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /chatlibre-server /usr/local/bin/chatlibre-server

EXPOSE 9733
VOLUME ["/root/.chatlibre"]

ENTRYPOINT ["chatlibre-server"]
CMD ["--port", "9733"]
