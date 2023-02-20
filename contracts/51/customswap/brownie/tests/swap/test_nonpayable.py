import brownie


def test_fallback_reverts(swap, bob):
    with brownie.reverts():
        bob.transfer(swap, "1 ether")
