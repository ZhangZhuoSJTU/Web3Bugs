def test_deposit_eth(vaultReserve, coin, pool, admin, decimals):
    # work around to give the `vault` permission to `admin`
    pool.setVault(admin, {"from": admin})
    vaultReserve.deposit(coin, 10**decimals, {"value": 10**decimals, "from": admin})
    assert vaultReserve.balance() == 10**decimals
    assert vaultReserve.getBalance(admin, coin) == 10**decimals
