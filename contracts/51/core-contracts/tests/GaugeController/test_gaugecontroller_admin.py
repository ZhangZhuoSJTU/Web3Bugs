import brownie


def test_commit_admin_only(gauge_controller, chuck):
    with brownie.reverts("dev: admin only"):
        gauge_controller.commit_transfer_ownership(chuck, {"from": chuck})


def test_apply_admin_only(gauge_controller, chuck):
    with brownie.reverts("dev: admin only"):
        gauge_controller.apply_transfer_ownership({"from": chuck})


def test_commit_transfer_ownership(gauge_controller, admin, alice):
    gauge_controller.commit_transfer_ownership(alice, {"from": admin})

    assert gauge_controller.admin() == admin
    assert gauge_controller.future_admin() == alice


def test_apply_transfer_ownership(gauge_controller, admin, alice):
    gauge_controller.commit_transfer_ownership(alice, {"from": admin})
    gauge_controller.apply_transfer_ownership({"from": admin})

    assert gauge_controller.admin() == alice


def test_apply_without_commit(gauge_controller, admin):
    with brownie.reverts("dev: admin not set"):
        gauge_controller.apply_transfer_ownership({"from": admin})
