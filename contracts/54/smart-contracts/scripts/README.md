# Various scripts to manage the contracts

## Notes on UDT Upgrade

### Whats happening

The v1 of the UDT contract was importing contracts from `@openzeppelin/contracts-ethereum-package` which rely solidity 0.5.17. In order to support the Compoud-like governance extension provided by `@openzeppelin/contracts-upgradeable` an upgrade is required. 

The upgrade requires a few changes, namely

1. upgrade solidity pragma to `^0.8.0` 
2. renaming of the initialization function to support `@openzeppelin/upgrades` pattern (i.e. from `_initialize` to `initialize`)
3. adding some gaps to prevent future conflicts in storage (i.e. a variable named `____gap`)

### How to solve it

@Amxx provided a template (ba7da40868e861aac015cd95910cdbb6c28ac27f) to proceed with the upgrade consisting of:

1. create `ERC20Patched.template.sol` with a new version of the contract that import the deprecated lib (i.e. `@openzeppelin/contracts-ethereum-package/contracts/access/Roles.sol`)  
2. flatten `ERC20Patched.template.sol` into `contracts/ERC20Patched.generated.sol`
3. remove duplicated licenses (hardhat doesnt support them)
4. manually correct the issues in the generated file.  Corrections are saved as `contracts/ERC20Patched.ref`)
1. generate a patch containing the changes 
```
diff -u contracts/ERC20Patched.ref contracts/ERC20Patched.generated.sol > genV2/ERC20Patched.patch
```
6. create a script that replay steps 1-3 and apply the patch to generate the new version of the contract

```sh
sh udt-flatten-v2.sh
```

## Upgrading `.openzeppelin` files

For reference the outcome of oz CLI > upgrades migration (following the [guide](https://docs.openzeppelin.com/upgrades-plugins/1.x/migrate-from-cli?pref=hardhat))

```
npx migrate-oz-cli-project                                                                                                                                                                                      3 ↵
✔ Successfully migrated .openzeppelin/unknown-100.json
✔ Successfully migrated .openzeppelin/unknown-137.json
✔ Successfully migrated .openzeppelin/kovan.json
✔ Successfully migrated .openzeppelin/mainnet.json
✔ Successfully migrated .openzeppelin/rinkeby.json
✔ Successfully migrated .openzeppelin/ropsten.json
✔ Migration data exported to openzeppelin-cli-export.json
✔ Deleting .openzeppelin/project.json

These were your project's compiler options:
{
  "manager": "openzeppelin",
  "compilerSettings": {
    "optimizer": {
      "enabled": true,
      "runs": "200"
    },
    "evmVersion": "istanbul"
  },
  "solcVersion": "0.5.17",
  "artifactsDir": "build/contracts",
  "contractsDir": "contracts",
  "typechain": {
    "enabled": false
  }
}
````

