#!/bin/bash
set -eu

echo "## Add ETH key"
gravitycli tx gravity update-eth-addr 0xb8662f35f9de8720424e82b232e8c98d15399490adae9ca993f5ef1dc4883690 --from validator  --chain-id=testing -b block -y
echo "## Request valset update"
gravitycli tx gravity valset-request --from validator --chain-id=testing -b block -y
echo "## Query pending request nonce"
nonce=$(gravitycli q gravity pending-valset-request $(gravitycli keys show validator -a) -o json | jq -r ".value.nonce")

echo "## Approve pending request"
gravitycli tx gravity approved valset-confirm  "$nonce" 0xb8662f35f9de8720424e82b232e8c98d15399490adae9ca993f5ef1dc4883690 --from validator --chain-id=testing -b block -y

echo "## View attestations"
gravitycli q gravity attestation orchestrator_signed_multisig_update $nonce -o json | jq

echo "## Submit observation"
# chain id: 1
# bridge contract address: 0x8858eeb3dfffa017d4bce9801d340d36cf895ccf
#gravitycli tx gravity observed  multisig-update 1 0x8858eeb3dfffa017d4bce9801d340d36cf895ccf  "$nonce" --from validator --chain-id=testing -b block -y
echo "## Query last observed state"
gravitycli q gravity observed nonces -o json