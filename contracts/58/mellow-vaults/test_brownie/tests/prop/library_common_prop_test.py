from typing import List

from brownie import accounts
from brownie.test import given, strategy
from brownie.typing import AccountsType


def _address_to_int(address: AccountsType) -> int:
    return int(address.address.lower(), 16)


def _addresses_to_int(addresses: List[AccountsType]) -> List[int]:
    return [_address_to_int(address) for address in addresses]


def _is_unique(seq: list) -> bool:
    return len(seq) == len(set(seq))


@given(addresses=strategy("address[]", min_length=0, max_length=15, unique=False))
def test_sorted_and_unique(addresses, a, CommonTest):
    common_test = CommonTest.deploy({"from": a[0]})
    int_addresses = _addresses_to_int(addresses)
    int_addresses_sorted = sorted(int_addresses)
    assert common_test.isSortedAndUnique(addresses) == (
        int_addresses == int_addresses_sorted and
        _is_unique(int_addresses)
    )


@given(addresses=strategy("address[]", min_length=0, max_length=15, unique=False))
def test_bubble_sort(addresses, a, CommonTest):
    common_test = CommonTest.deploy({"from": a[0]})
    addresses_sorted = list(sorted(addresses, key=lambda address: _address_to_int(address)))
    assert common_test.bubbleSort(addresses) == addresses_sorted
