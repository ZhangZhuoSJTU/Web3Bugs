from brownie.test.managers.runner import RevertContextManager as reverts

from support.constants import ADMIN_DELAY, AddressProviderKeys
from support.convert import format_to_bytes
from support.mainnet_contracts import TokenAddresses

KEY = format_to_bytes("newContract", 32, output_hex=True)
ADDRESS = TokenAddresses.C_DAI
OTHER_ADDRESS = TokenAddresses.CVX


def test_known_keys(address_provider):
    known_keys = address_provider.getKnownAddressKeys()
    assert len(known_keys) == 8
    expected_keys = [v.value for v in AddressProviderKeys]
    assert all(key in expected_keys for key in known_keys)


def test_initialize_address(address_provider, admin):
    known_keys = address_provider.getKnownAddressKeys()
    assert len(known_keys) == 8
    address_provider.initializeAddress(KEY, ADDRESS, {"from": admin})
    assert KEY in address_provider.getKnownAddressKeys()
    assert address_provider.getAddressMeta(KEY) == (False, False)
    assert address_provider.getAddress(KEY) == ADDRESS


def test_initialize_and_freezeaddress(address_provider, admin):
    address_provider.initializeAndFreezeAddress(KEY, ADDRESS, {"from": admin})
    assert KEY in address_provider.getKnownAddressKeys()
    assert address_provider.getAddressMeta(KEY) == (True, True)
    assert address_provider.getAddress(KEY) == ADDRESS


def test_update_address(address_provider, admin, chain):
    address_provider.initializeAddress(KEY, ADDRESS, {"from": admin})
    address_provider.prepareAddress(KEY, OTHER_ADDRESS, {"from": admin})
    assert address_provider.getAddress(KEY) == ADDRESS
    chain.sleep(ADMIN_DELAY)
    address_provider.executeAddress(KEY, {"from": admin})
    assert address_provider.getAddress(KEY) == OTHER_ADDRESS


def test_update_frozen_address(address_provider, admin):
    address_provider.initializeAndFreezeAddress(KEY, ADDRESS, {"from": admin})
    with reverts("address is frozen"):
        address_provider.prepareAddress(KEY, OTHER_ADDRESS, {"from": admin})


def test_freeze_address(address_provider, admin):
    address_provider.initializeAddress(KEY, ADDRESS, True, {"from": admin})
    address_provider.freezeAddress(KEY, {"from": admin})
    assert address_provider.getAddressMeta(KEY) == (True, True)


def test_freeze_unfreezable_address(address_provider, admin):
    address_provider.initializeAddress(KEY, ADDRESS, {"from": admin})
    with reverts("invalid argument"):
        address_provider.freezeAddress(KEY, {"from": admin})


def test_freeze_frozen_address(address_provider, admin):
    address_provider.initializeAndFreezeAddress(KEY, ADDRESS, {"from": admin})
    with reverts("address is frozen"):
        address_provider.freezeAddress(KEY, {"from": admin})
