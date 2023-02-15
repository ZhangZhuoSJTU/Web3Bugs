#!/bin/bash
set -eu

gravityd start --rpc.laddr tcp://0.0.0.0:26657 --trace --log_level="main:info,state:debug,*:error"