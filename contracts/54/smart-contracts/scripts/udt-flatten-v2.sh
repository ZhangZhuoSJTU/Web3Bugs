#!/bin/bash

here=$(pwd)

UDT_V2_FLATTENED="contracts/ERC20Patched.generated.sol"

UDT_V2_TEMPLATE="scripts/udt-flatten/ERC20Patched.template.sol"
UDT_V2_PATCH="scripts/udt-flatten/ERC20Patched.patch"
UDT_V2_TARGET="contracts/ERC20Patched.sol"


# flatten using hardhat
npx hardhat flatten $UDT_V2_TEMPLATE > $UDT_V2_FLATTENED

# needed because hardhat flatten doesn't remove duplicated Licences
sed -i'.bak' -e '/SPDX-License-Identifier/d' $UDT_V2_FLATTENED

# patch ERC20 and Solidity version
patch -R $UDT_V2_FLATTENED $UDT_V2_PATCH -o $UDT_V2_TARGET

#cleanup
# rm $UDT_V2_FLATTENED