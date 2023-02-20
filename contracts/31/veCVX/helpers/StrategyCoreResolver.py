from brownie import *
from decimal import Decimal

from helpers.utils import (
    approx,
)
from helpers.constants import *
from helpers.multicall import Call, as_wei, func
from rich.console import Console

console = Console()


class StrategyCoreResolver:
    def __init__(self, manager):
        self.manager = manager

    # ===== Read strategy data =====

    def add_entity_shares_for_tokens(self, calls, tokenKey, token, entities):
        for entityKey, entity in entities.items():
            calls.append(
                Call(
                    token.address,
                    [func.digg.sharesOf, entity],
                    [["shares." + tokenKey + "." + entityKey, as_wei]],
                )
            )

        return calls

    def add_entity_balances_for_tokens(self, calls, tokenKey, token, entities):
        for entityKey, entity in entities.items():
            calls.append(
                Call(
                    token.address,
                    [func.erc20.balanceOf, entity],
                    [["balances." + tokenKey + "." + entityKey, as_wei]],
                )
            )

        return calls

    def add_balances_snap(self, calls, entities):
        want = self.manager.want
        sett = self.manager.sett

        calls = self.add_entity_balances_for_tokens(calls, "want", want, entities)
        calls = self.add_entity_balances_for_tokens(calls, "sett", sett, entities)
        return calls

    def add_sett_snap(self, calls):
        sett = self.manager.sett

        calls.append(
            Call(sett.address, [func.sett.balance], [["sett.balance", as_wei]])
        )
        calls.append(
            Call(sett.address, [func.sett.available], [["sett.available", as_wei]])
        )
        calls.append(
            Call(
                sett.address,
                [func.sett.getPricePerFullShare],
                [["sett.pricePerFullShare", as_wei]],
            )
        )
        calls.append(
            Call(sett.address, [func.erc20.totalSupply], [["sett.totalSupply", as_wei]])
        )

        return calls

    def add_strategy_snap(self, calls, entities=None):
        strategy = self.manager.strategy

        calls.append(
            Call(
                strategy.address,
                [func.strategy.balanceOfPool],
                [["strategy.balanceOfPool", as_wei]],
            )
        )
        calls.append(
            Call(
                strategy.address,
                [func.strategy.balanceOfWant],
                [["strategy.balanceOfWant", as_wei]],
            )
        )
        calls.append(
            Call(
                strategy.address,
                [func.strategy.balanceOf],
                [["strategy.balanceOf", as_wei]],
            )
        )
        calls.append(
            Call(
                strategy.address,
                [func.strategy.withdrawalFee],
                [["strategy.withdrawalFee", as_wei]],
            )
        )
        calls.append(
            Call(
                strategy.address,
                [func.strategy.performanceFeeGovernance],
                [["strategy.performanceFeeGovernance", as_wei]],
            )
        )
        calls.append(
            Call(
                strategy.address,
                [func.strategy.performanceFeeStrategist],
                [["strategy.performanceFeeStrategist", as_wei]],
            )
        )

        return calls

    # ===== Verify strategy action results =====

    def confirm_harvest_state(self, before, after, tx):
        """
        Confirm the events from the harvest match with actual recorded change
        Must be implemented on a per-strategy basis
        """
        self.printHarvestState({}, [])
        return True

    def printHarvestState(self, event, keys):
        return True

    def confirm_earn(self, before, after, params):
        """
        Earn Should:
        - Decrease the balanceOf() want in the Sett
        - Increase the balanceOf() want in the Strategy
        - Increase the balanceOfPool() in the Strategy
        - Reduce the balanceOfWant() in the Strategy to zero
        - Users balanceOf() want should not change
        """

        console.print("=== Compare Earn ===")
        self.manager.printCompare(before, after)

        # Do nothing if there is not enough available want in sett to transfer.
        # NB: Since we calculate available want by taking a percentage when
        # balance is 1 it gets rounded down to 1.
        if before.balances("want", "sett") <= 1:
            return

        assert after.balances("want", "sett") <= before.balances("want", "sett")

        # All want should be in pool OR sitting in strategy, not a mix
        assert (
            after.get("strategy.balanceOfWant") == 0
            and after.get("strategy.balanceOfPool")
            > before.get("strategy.balanceOfPool")
        ) or (
            after.get("strategy.balanceOfWant") > before.get("strategy.balanceOfWant")
            and after.get("strategy.balanceOfPool") == 0
        )

        assert after.get("strategy.balanceOf") > before.get("strategy.balanceOf")
        assert after.balances("want", "user") == before.balances("want", "user")

        self.hook_after_earn(before, after, params)

    def confirm_withdraw(self, before, after, params, tx):
        """
        Withdraw Should;
        - Decrease the totalSupply() of Sett tokens
        - Decrease the balanceOf() Sett tokens for the user based on withdrawAmount and pricePerFullShare
        - Decrease the balanceOf() want in the Strategy
        - Decrease the balance() tracked for want in the Strategy
        - Decrease the available() if it is not zero
        """
        ppfs = before.get("sett.pricePerFullShare")

        console.print("=== Compare Withdraw ===")
        self.manager.printCompare(before, after)

        if params["amount"] == 0:
            assert after.get("sett.totalSupply") == before.get("sett.totalSupply")
            # Decrease the Sett tokens for the user based on withdrawAmount and pricePerFullShare
            assert after.balances("sett", "user") == before.balances("sett", "user")
            return

        # Decrease the totalSupply of Sett tokens
        assert after.get("sett.totalSupply") < before.get("sett.totalSupply")

        # Decrease the Sett tokens for the user based on withdrawAmount and pricePerFullShare
        assert after.balances("sett", "user") < before.balances("sett", "user")

        # Decrease the want in the Sett, if there was idle want
        if before.balances("want", "sett") > 0:
            assert after.balances("want", "sett") < before.balances("want", "sett")

            # Available in the sett should decrease if want decreased
            assert after.get("sett.available") <= before.get("sett.available")

        # Want in the strategy should be decreased, if idle in sett is insufficient to cover withdrawal
        if params["amount"] > before.balances("want", "sett"):
            # Adjust amount based on total balance x total supply
            # Division in python is not accurate, use Decimal package to ensure division is consistent w/ division inside of EVM
            expectedWithdraw = Decimal(
                params["amount"] * before.get("sett.balance")
            ) / Decimal(before.get("sett.totalSupply"))
            # Withdraw from idle in sett first
            expectedWithdraw -= before.balances("want", "sett")
            # First we attempt to withdraw from idle want in strategy
            if expectedWithdraw > before.balances("want", "strategy"):
                # If insufficient, we then attempt to withdraw from activities (balance of pool)
                # Just ensure that we have enough in the pool balance to satisfy the request
                expectedWithdraw -= before.balances("want", "strategy")
                assert expectedWithdraw <= before.get("strategy.balanceOfPool")

                assert approx(
                    before.get("strategy.balanceOfPool"),
                    after.get("strategy.balanceOfPool") + expectedWithdraw,
                    1,
                )

        # The total want between the strategy and sett should be less after than before
        # if there was previous want in strategy or sett (sometimes we withdraw entire
        # balance from the strategy pool) which we check above.
        if (
            before.balances("want", "strategy") > 0
            or before.balances("want", "sett") > 0
        ):
            assert after.balances("want", "strategy") + after.balances(
                "want", "sett"
            ) < before.balances("want", "strategy") + before.balances("want", "sett")

        # Controller rewards should earn
        if (
            before.get("strategy.withdrawalFee") > 0
            and
            # Fees are only processed when withdrawing from the strategy.
            before.balances("want", "strategy") > after.balances("want", "strategy")
        ):
            assert after.balances("want", "governanceRewards") > before.balances(
                "want", "governanceRewards"
            )
        self.hook_after_confirm_withdraw(before, after, params)

    def confirm_deposit(self, before, after, params):
        """
        Deposit Should;
        - Increase the totalSupply() of Sett tokens
        - Increase the balanceOf() Sett tokens for the user based on depositAmount / pricePerFullShare
        - Increase the balanceOf() want in the Sett by depositAmount
        - Decrease the balanceOf() want of the user by depositAmount
        """

        ppfs = before.get("sett.pricePerFullShare")
        console.print("=== Compare Deposit ===")
        self.manager.printCompare(before, after)

        expected_shares = Decimal(params["amount"] * Wei("1 ether")) / Decimal(ppfs)
        if params.get("expected_shares") is not None:
            expected_shares = params["expected_shares"]

        # Increase the totalSupply() of Sett tokens
        assert approx(
            after.get("sett.totalSupply"),
            before.get("sett.totalSupply") + expected_shares,
            1,
        )

        # Increase the balanceOf() want in the Sett by depositAmount
        assert approx(
            after.balances("want", "sett"),
            before.balances("want", "sett") + params["amount"],
            1,
        )

        # Decrease the balanceOf() want of the user by depositAmount
        assert approx(
            after.balances("want", "user"),
            before.balances("want", "user") - params["amount"],
            1,
        )

        # Increase the balanceOf() Sett tokens for the user based on depositAmount / pricePerFullShare
        assert approx(
            after.balances("sett", "user"),
            before.balances("sett", "user") + expected_shares,
            1,
        )
        self.hook_after_confirm_deposit(before, after, params)

    # ===== Strategies must implement =====
    def hook_after_confirm_withdraw(self, before, after, params):
        """
        Specifies extra check for ordinary operation on withdrawal
        Use this to verify that balances in the get_strategy_destinations are properly set
        """
        assert False

    def hook_after_confirm_deposit(self, before, after, params):
        """
        Specifies extra check for ordinary operation on deposit
        Use this to verify that balances in the get_strategy_destinations are properly set
        """
        assert False

    def hook_after_earn(self, before, after, params):
        """
        Specifies extra check for ordinary operation on earn
        Use this to verify that balances in the get_strategy_destinations are properly set
        """
        assert False

    def confirm_harvest(self, before, after, tx):
        """
        Verfies that the Harvest produced yield and fees
        """
        console.print("=== Compare Harvest ===")
        self.manager.printCompare(before, after)
        self.confirm_harvest_state(before, after, tx)

        valueGained = after.get("sett.pricePerFullShare") > before.get(
            "sett.pricePerFullShare"
        )

        # # Strategist should earn if fee is enabled and value was generated
        # if before.get("strategy.performanceFeeStrategist") > 0 and valueGained:
        #     assert after.balances("want", "strategist") > before.balances(
        #         "want", "strategist"
        #     )

        # # Strategist should earn if fee is enabled and value was generated
        # if before.get("strategy.performanceFeeGovernance") > 0 and valueGained:
        #     assert after.balances("want", "governanceRewards") > before.balances(
        #         "want", "governanceRewards"
        #     )

    def confirm_tend(self, before, after, tx):
        """
        Tend Should;
        - Increase the number of staked tended tokens in the strategy-specific mechanism
        - Reduce the number of tended tokens in the Strategy to zero

        (Strategy Must Implement)
        """
        assert False

    def get_strategy_destinations(self):
        """
        Track balances for all strategy implementations
        (Strategy Must Implement)
        """
        assert False
