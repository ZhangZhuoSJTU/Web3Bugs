#!/bin/bash
set -eux
cross build --target=x86_64-unknown-linux-musl --release  --all
cross build --target=aarch64-unknown-linux-musl --release  --all

mkdir -p bins

cp target/x86_64-unknown-linux-musl/release/gbt bins/

cp target/aarch64-unknown-linux-musl/release/gbt bins/gbt-arm
