from itertools import product

import brownie
import pytest
from scripts.config import CurrencyDefaults
from scripts.deployment import TestEnvironment, TokenType


@pytest.mark.balances
class TestTokenHandler:
    @pytest.fixture(scope="module", autouse=True)
    def tokenHandler(self, MockTokenHandler, accounts):
        return MockTokenHandler.deploy({"from": accounts[0]})

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @pytest.mark.parametrize("decimals,fee", list(product([6, 8, 18], [0, 0.01e18])))
    def test_token_transfers(self, tokenHandler, MockERC20, accounts, decimals, fee):
        erc20 = MockERC20.deploy("test", "TEST", decimals, fee, {"from": accounts[0]})
        tokenHandler.setMaxCurrencyId(1)
        tokenHandler.setCurrencyMapping(
            1, True, (erc20.address, fee != 0, TokenType["UnderlyingToken"])
        )

        amount = 10 ** decimals
        feePaid = amount * fee / 1e18
        erc20.approve(tokenHandler.address, 1000e18, {"from": accounts[0]})

        # This is a deposit
        txn = tokenHandler.transfer(1, accounts[0].address, True, amount)

        # Fees are paid by the sender
        assert erc20.balanceOf(tokenHandler.address) == amount - feePaid
        assert txn.return_value == (amount - feePaid)

        # This is a withdraw
        withdrawAmt = amount / 2
        balanceBefore = erc20.balanceOf(tokenHandler.address)
        txn = tokenHandler.transfer(1, accounts[0].address, True, -withdrawAmt)

        assert erc20.balanceOf(tokenHandler.address) == balanceBefore - withdrawAmt
        assert txn.return_value == -int(withdrawAmt)

    @pytest.mark.parametrize("decimals,fee", list(product([6, 8, 18], [0, 0.01e18])))
    def test_transfer_failures(self, tokenHandler, MockERC20, accounts, decimals, fee):
        erc20 = MockERC20.deploy("test", "TEST", decimals, fee, {"from": accounts[0]})
        tokenHandler.setMaxCurrencyId(1)
        tokenHandler.setCurrencyMapping(
            1, True, (erc20.address, fee != 0, TokenType["UnderlyingToken"])
        )

        amount = 10 ** decimals
        with brownie.reverts():
            # Reverts when account has no balance
            tokenHandler.transfer(1, accounts[1], True, amount)

        with brownie.reverts():
            # Reverts when contract has no balance
            tokenHandler.transfer(1, accounts[0], True, -amount)

    def test_ctoken_mint_redeem(self, tokenHandler, accounts):
        env = TestEnvironment(accounts[0])
        env.enableCurrency("DAI", CurrencyDefaults)

        tokenHandler.setCurrencyMapping(
            1, False, (env.cToken["ETH"].address, False, TokenType["cETH"])
        )
        tokenHandler.setCurrencyMapping(
            2, True, (env.token["DAI"].address, False, TokenType["UnderlyingToken"])
        )
        tokenHandler.setCurrencyMapping(
            2, False, (env.cToken["DAI"].address, False, TokenType["cToken"])
        )

        # Test minting of cDai, first transfer some balance to the tokenHandler
        depositedDai = 1000e18
        cDaiBalanceBefore = env.cToken["DAI"].balanceOf(tokenHandler.address)
        env.token["DAI"].transfer(tokenHandler.address, depositedDai)
        txn = tokenHandler.mint(2, 1000e18)
        mintedcTokens = txn.return_value
        cDaiBalanceAfter = env.cToken["DAI"].balanceOf(tokenHandler.address)
        assert cDaiBalanceAfter - cDaiBalanceBefore == mintedcTokens

        txn = tokenHandler.redeem(2, mintedcTokens)
        redeemedDai = txn.return_value
        assert redeemedDai >= depositedDai
        assert env.cToken["DAI"].balanceOf(tokenHandler.address) == 0

        # TODO: test minting / redeeming of cETH
