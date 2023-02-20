def test_withdraw_eth(vaultReserve, coin, admin, decimals, pool):
    # work around to give the `vault` permission to `admin`
    pool.setVault(admin, {"from": admin})
    vaultReserve.deposit(coin, 10**decimals, {"value": 10**decimals, "from": admin})
    assert vaultReserve.balance() == 10**decimals
    assert vaultReserve.getBalance(admin, coin) == 10**decimals
    previous_balance = admin.balance()
    tx = vaultReserve.withdraw(coin, 10**decimals, {"from": admin})
    assert vaultReserve.balance() == 0
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert admin.balance() == previous_balance + 10**decimals - wei_used_for_gas
    assert vaultReserve.getBalance(admin, coin) == 0
