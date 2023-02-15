from brownie import chain, reverts


def test_nft_holder_sale(admin, alice, nft, sale):
    nft.mint(alice, 1, {"from": admin})
    alice.transfer(sale, "1 ether")


def test_non_nft_holder_early_sale_fails(bob, sale):
    with reverts():
        bob.transfer(sale, "1 ether")


def test_receive_eth(admin, alice, nft, sale):
    nft.mint(alice, 1, {"from": admin})
    balance = admin.balance()
    alice.transfer(sale, "1 ether")
    assert admin.balance() == balance + 1_000000000000000000


def test_premature_withdraw(admin, alice, nft, sale, mainToken):
    nft.mint(alice, 1, {"from": admin})
    alice.transfer(sale, "1 ether")
    assert sale.withdrawShare(1, 1, {'from': alice}).return_value == 0
    assert mainToken.balanceOf(alice) == 0


def test_withdraw_winner_take_all(admin, alice, nft, sale, mainToken):
    nft.mint(alice, 1, {"from": admin})

    alice.transfer(sale, "1 ether")
    day_1_emission = sale.getDayEmission()

    next_day(sale)
    assert mainToken.balanceOf(alice) == 0
    assert sale.withdrawShare(1, 1, {'from': alice}).return_value > 0
    assert mainToken.balanceOf(alice) == immediately_vested(day_1_emission)


def test_withdraw_50_50_split(admin, alice, bob, nft, sale, mainToken):
    nft.mint(alice, 1, {"from": admin})
    nft.mint(bob, 1, {"from": admin})

    alice.transfer(sale, "1 ether")
    bob.transfer(sale, "1 ether")
    day_1_emission = sale.getDayEmission()

    next_day(sale)

    half = day_1_emission // 2
    assert sale.withdrawShare(1, 1, {'from': alice}).return_value == half
    assert sale.withdrawShare(1, 1, {'from': bob}).return_value == half
    assert mainToken.balanceOf(alice) == immediately_vested(half)
    assert mainToken.balanceOf(bob) == immediately_vested(half)


def test_withdraw_1_99_split(admin, alice, bob, nft, sale, mainToken):
    nft.mint(alice, 1, {"from": admin})
    nft.mint(bob, 1, {"from": admin})

    alice.transfer(sale, "1 ether")
    bob.transfer(sale, "99 ether")
    day_1_emission = sale.getDayEmission()

    next_day(sale)

    assert sale.withdrawShare(1, 1, {'from': alice}).return_value > 0
    assert sale.withdrawShare(1, 1, {'from': bob}).return_value > 0
    assert mainToken.balanceOf(alice) == immediately_vested(day_1_emission) // 100
    assert mainToken.balanceOf(bob) == 99 * mainToken.balanceOf(alice)


def test_any_sale_on_or_after_first_public_era(bob, sale):
    day = 0
    while day < sale.daysPerEra() * (sale.firstPublicEra() - sale.firstEra()):
        next_day(sale)
        day += 1

    assert sale.currentEra() == sale.firstPublicEra()
    bob.transfer(sale, "1 ether")


def test_final_sale(admin, alice, mainToken, nft, sale):
    nft.mint(alice, 1, {"from": admin})

    total = sale.totalSupply()

    era = 1
    day = 1
    acc = 0
    while sale.getDayEmission() > 0:
        print(f"era {era} day {day} emission {sale.getDayEmission()}")
        alice.transfer(sale, "1 wei")
        next_day(sale)
        tx = sale.withdrawShare(era, day, {'from': alice})
        share = tx.return_value
        acc += share
        percent = int(10000 * acc / total) / 100
        print(f"share {int(share/10**18)} total {int(acc/10**18)}/{int(total/10**18)} {percent}%")
        assert share > 0
        day += 1
        if day > 7:
            day = 1
            era += 1

    assert acc == total
    assert sale.remainingSupply() == 0

    with reverts():
        # should not be able to participate if there is no more 
        alice.transfer(sale, "1 wei")


def test_final_sale_no_withdrawals(admin, alice, mainToken, nft, sale):
    nft.mint(alice, 1, {"from": admin})

    total = sale.totalSupply()

    era = 1
    day = 1
    acc = 0
    while sale.getDayEmission() > 0:
        print(f"era {era} day {day} emission {sale.getDayEmission()}")
        alice.transfer(sale, "1 wei")
        next_day(sale)
        share = sale.getEmissionShare(era, day, alice, {'from': alice})
        acc += share
        percent = int(10000 * acc / total) / 100
        print(f"share {int(share/10**18)} total {int(acc/10**18)}/{int(total/10**18)} {percent}%")
        assert share > 0
        assert percent <= 100
        day += 1
        if day > 7:
            day = 1
            era += 1

    assert acc == total
    assert sale.remainingSupply() == 0

    with reverts():
        # should not be able to participate if there is no more 
        alice.transfer(sale, "1 wei")


def immediately_vested(n):
    return n * 3 // 10

def next_day(sale):
    chain.sleep(sale.secondsPerDay())
    tx = sale.updateEmission()
    assert 'NewDay' in tx.events
