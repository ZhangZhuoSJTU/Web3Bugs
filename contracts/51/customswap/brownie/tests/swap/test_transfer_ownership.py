import brownie


def test_transfer_ownership(admin, bob, swap):
    swap.transferOwnership(bob, {"from": admin})
    assert swap.owner() == bob


def test_only_owner_can_transfer_ownership(bob, swap):
    with brownie.reverts():
        swap.transferOwnership(bob, {"from": bob})


def test_ownership_already_transferred(admin, bob, swap):
    swap.transferOwnership(bob, {"from": admin})

    with brownie.reverts():
        swap.transferOwnership(bob, {"from": admin})
