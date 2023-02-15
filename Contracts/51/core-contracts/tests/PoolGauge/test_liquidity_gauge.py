from random import random, randrange
import pytest

from tests.conftest import WEEK, YEAR, approx


def test_gauge_integral(accounts, chain, mock_lp_token, token, pool_gauge, gauge_controller):
    alice, bob = accounts[:2]

    # Wire up Gauge to the controller to have proper rates and stuff
    gauge_controller.add_type(b"Liquidity", {"from": alice})
    gauge_controller.change_type_weight(0, 10 ** 18, {"from": alice})
    gauge_controller.add_gauge(pool_gauge.address, 0, 10 ** 18, {"from": alice})

    alice_staked = 0
    bob_staked = 0
    integral = 0  # ∫(balance * rate(t) / totalSupply(t) dt)
    checkpoint = chain[-1].timestamp
    checkpoint_rate = token.rate()
    checkpoint_supply = 0
    checkpoint_balance = 0

    # Let Alice and Bob have about the same token amount
    mock_lp_token.transfer(bob, mock_lp_token.balanceOf(alice) // 2, {"from": alice})

    def update_integral():
        nonlocal checkpoint, checkpoint_rate, integral, checkpoint_balance, checkpoint_supply

        t1 = chain[-1].timestamp
        rate1 = token.rate()
        t_epoch = token.start_epoch_time()
        if checkpoint >= t_epoch:
            rate_x_time = (t1 - checkpoint) * rate1
        else:
            rate_x_time = (t_epoch - checkpoint) * checkpoint_rate + (t1 - t_epoch) * rate1
        if checkpoint_supply > 0:
            integral += rate_x_time * checkpoint_balance // checkpoint_supply
        checkpoint_rate = rate1
        checkpoint = t1
        checkpoint_supply = pool_gauge.totalSupply()
        checkpoint_balance = pool_gauge.balanceOf(alice)

    # Now let's have a loop where Bob always deposit or withdraws,
    # and Alice does so more rarely
    for i in range(40):
        is_alice = random() < 0.2
        dt = randrange(1, WEEK // 5)
        chain.sleep(dt)
        chain.mine()

        # For Bob
        is_withdraw = (i > 0) * (random() < 0.5)
        print("Bob", "withdraws" if is_withdraw else "deposits")
        if is_withdraw:
            amount = randrange(1, pool_gauge.balanceOf(bob) + 1)
            pool_gauge.withdraw(amount, {"from": bob})
            update_integral()
            bob_staked -= amount
        else:
            amount = randrange(1, mock_lp_token.balanceOf(bob) // 10 + 1)
            mock_lp_token.approve(pool_gauge.address, amount, {"from": bob})
            pool_gauge.deposit(amount, {"from": bob})
            update_integral()
            bob_staked += amount

        if is_alice:
            # For Alice
            is_withdraw_alice = (pool_gauge.balanceOf(alice) > 0) * (random() < 0.5)
            print("Alice", "withdraws" if is_withdraw_alice else "deposits")

            if is_withdraw_alice:
                amount_alice = randrange(1, pool_gauge.balanceOf(alice) // 10 + 1)
                pool_gauge.withdraw(amount_alice, {"from": alice})
                update_integral()
                alice_staked -= amount_alice
            else:
                amount_alice = randrange(1, mock_lp_token.balanceOf(alice) + 1)
                mock_lp_token.approve(pool_gauge.address, amount_alice, {"from": alice})
                pool_gauge.deposit(amount_alice, {"from": alice})
                update_integral()
                alice_staked += amount_alice

        # Checking that updating the checkpoint in the same second does nothing
        # Also everyone can update: that should make no difference, too
        if random() < 0.5:
            pool_gauge.user_checkpoint(alice, {"from": alice})
        if random() < 0.5:
            pool_gauge.user_checkpoint(bob, {"from": bob})

        assert pool_gauge.balanceOf(alice) == alice_staked
        assert pool_gauge.balanceOf(bob) == bob_staked
        assert pool_gauge.totalSupply() == alice_staked + bob_staked

        dt = randrange(1, WEEK // 20)
        chain.sleep(dt)
        chain.mine()

        pool_gauge.user_checkpoint(alice, {"from": alice})
        update_integral()
        print(i, dt / 86400, integral, pool_gauge.integrate_fraction(alice))
        assert approx(pool_gauge.integrate_fraction(alice), integral, 1e-5)
