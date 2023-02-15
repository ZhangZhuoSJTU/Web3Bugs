#!/bin/bash
set -eu

gravityd init --chain-id=testing local
gravityd add-genesis-account validator 1000000000stake
gravityd gentx --name validator  --amount 1000000000stake
gravityd collect-gentxs
