import json
from brownie import wfCashERC4626, nUpgradeableBeacon, WrappedfCashFactory, network, accounts

notionalAddress = {
    "kovan": "0x0EAE7BAdEF8f95De91fDDb74a89A786cF891Eb0e",
    "kovan-fork": "0x0EAE7BAdEF8f95De91fDDb74a89A786cF891Eb0e"
}

def main():
    deployer = accounts.load("KOVAN_DEPLOYER")

    impl = wfCashERC4626.deploy(notionalAddress[network.show_active()], {"from": deployer}, publish_source=True)
    beacon = nUpgradeableBeacon.deploy(impl.address, {"from": deployer}, publish_source=True)
    factory = WrappedfCashFactory.deploy(beacon.address, {"from": deployer}, publish_source=True)

    with open("wrapper.{}.json".format(network.show_active()), "w") as f:
        json.dump({
            "implementation": impl.address,
            "beacon": beacon.address,
            "factory": factory.address
        }, f, indent=4, sort_keys=True)

    with open("abi/WrappedfCash.json", "w") as f:
        json.dump(wfCashERC4626.abi, f, indent=4, sort_keys=True)