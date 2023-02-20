from decimal import Decimal

import pytest
from brownie import ZERO_ADDRESS, MockErc20
from support.contract_utils import update_topup_handler
from support.types import TopUpRecord  # type: ignore
from support.utils import encode_account, scale

PROTOCOL_1_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"


pytestmark = pytest.mark.usefixtures("registerSetUp")


@pytest.fixture
def registerSetUp(address_provider, topUpAction, chain, admin, pool, mockTopUpHandler):
    address_provider.addPool(pool, {"from": admin})
    update_topup_handler(
        topUpAction, PROTOCOL_1_ADDRESS, mockTopUpHandler, chain, admin
    )


def scale(value, decimals=18):
    return Decimal(value) * 10**decimals


class ScaledDecimalWrapper:
    def __init__(self, underlying):
        if not isinstance(underlying, Decimal):
            underlying = Decimal(underlying)
        self._underlying = underlying

    def __eq__(self, value):
        if isinstance(value, str):
            # value = scale(value)
            value = Decimal(value)
        # Limiting precision here to avoid having to enter very many decimal places
        if self._underlying <= value + Decimal(
            "0.00001"
        ) and self._underlying >= value - Decimal("0.00001"):
            return True
        return False

    def __getattr__(self, key):
        return getattr(self._underlying, key)

    def __repr__(self):
        return repr(self._underlying)

    def to_float(self):
        return float(self._underlying)


class WithdrawalFeesTestHelper:
    def __init__(self, chain, account, pool, lp_token, decimals):
        self.chain = chain
        self.account = account
        self.pool = pool
        self.lp_token = lp_token
        self.decimals = decimals
        self.underlying = pool.getUnderlying()
        self.tx_args = {"from": account}
        self._last_time = chain.time()

    def initialize_pool(self, min_fee, max_fee, withdrawal_fee_period):
        current_time = self.chain.time()
        self.pool.setTime(current_time)
        self._last_time = current_time
        self.pool.setMaxWithdrawalFee(max_fee)
        self.pool.setMinWithdrawalFee(min_fee)
        self.pool.setWithdrawalFeeDecreasePeriod(withdrawal_fee_period)

        max_amount = 1000 * 10**self.decimals
        self.lp_token.approve(self.pool, max_amount)
        if self.underlying != ZERO_ADDRESS:
            token = MockErc20.at(self.underlying)
            token.mint(max_amount, self.tx_args)
            token.approve(self.pool, max_amount, self.tx_args)

    def deposit(self, amount):
        """For convenience, amount should be a non-scaled
        number of LP tokens that we want to get out of the deposit
        as this is what is used when computing the fees to pay
        """
        args = self.tx_args.copy()
        amount = scale(
            Decimal(amount) * self.pool.exchangeRate() / 10**18, self.decimals
        )
        if self.underlying == ZERO_ADDRESS:
            args["value"] = amount
        return self.pool.deposit(amount, args)

    def redeem(self, amount):
        amount = scale(amount, self.decimals)
        return self.pool.redeem(amount, self.tx_args)

    def advance(self, timedelta):
        self.chain.mine(timedelta=timedelta)
        new_time = self._last_time + timedelta
        self.set_time(new_time)

    def set_time(self, timestamp):
        self.pool.setTime(timestamp)
        self._last_time = timestamp

    def scale_amount(self, amount):
        return scale(amount, self.decimals)

    def get_fees(self, amount=None, account=None):
        if account is None:
            account = self.account
        if amount is not None:
            amount = amount * 10**self.decimals
        else:
            amount = self.lp_token.balanceOf(account)
        # Get the fee that would be paid on the entire balance
        fee = self.pool.getWithdrawalFee(account, amount)
        return ScaledDecimalWrapper(Decimal(fee) / 10**self.decimals)

    def get_calc_redeem(self, amount):
        lp_amount = self.pool.calcRedeem(self.account, amount * 10**self.decimals)
        return ScaledDecimalWrapper(Decimal(lp_amount) / 10**self.decimals)


@pytest.fixture
def th(chain, alice, pool, lpToken, decimals):
    return WithdrawalFeesTestHelper(chain, alice, pool, lpToken, decimals)


def test_deposit_same_amounts(th: WithdrawalFeesTestHelper):
    th.initialize_pool(scale("0"), scale("0.05"), 100)

    th.deposit(100)

    # assert th.pool.withdrawalFeeMetas(th.account)[1] == "100"

    # # 100 * 0.05 = 5.0
    assert th.get_fees() == "5.0"

    th.advance(50)
    # 100 * 0.05 / 2 = 2.5
    assert th.get_fees() == "2.5"

    th.deposit(100)
    # 100 * 0.05 / 2 + 100 * 0.05 = 7.5
    assert th.get_fees() == "7.5"

    th.advance(25)
    # (100 * 0.05 / 2 + 100 * 0.05) * 3/4 = 5.625
    assert th.get_fees() == "5.625"


def test_deposit_different_amounts(th: WithdrawalFeesTestHelper):
    th.initialize_pool(scale("0"), scale("0.05"), 100)

    # nothing to declare
    assert th.get_fees() == 0

    th.deposit(100)
    # 100 * 0.05 = 5
    assert th.get_fees() == "5.0"

    th.advance(50)
    # 100 * 0.05 / 2 = 2.5
    assert th.get_fees() == "2.5"

    th.deposit(25)
    # 100 * 0.05 / 2 + 25 * 0.05 = 3.75
    assert th.get_fees() == "3.75"

    th.advance(25)
    # (100 * 0.05 / 2 + 25 * 0.05) * 3/4 = 2.8125
    assert th.get_fees() == "2.8125"

    th.advance(25)
    # (100 * 0.05 / 2 + 25 * 0.05) * 2/4 = 1.875
    assert th.get_fees() == "1.875"


def test_simple_deposit_then_withdraw(th: WithdrawalFeesTestHelper):
    th.initialize_pool(scale("0"), scale("0.05"), 100)

    th.deposit(100)
    th.advance(50)

    th.deposit(50)
    th.advance(50)

    # (100 * 0.05 / 2 + 50 * 0.05) / 2 = 2.5
    assert th.get_fees() == "2.5"

    th.redeem(75)

    # (100 * 0.05 / 2 + 50 * 0.05) / 2 / 2 = 1.25
    assert th.get_fees() == "1.25"

    th.advance(80)

    assert th.get_fees() == 0


def test_simple_deposit_withdraw_different_amounts(th: WithdrawalFeesTestHelper):
    th.initialize_pool(scale("0"), scale("0.05"), 100)

    th.deposit(100)
    th.redeem(10)
    th.advance(50)
    # 100 * 0.05 * 0.9 / 2 = 2.25
    assert th.get_fees() == "2.25"


def test_deposit_withdraw_alternate(th: WithdrawalFeesTestHelper):
    th.initialize_pool(scale("0"), scale("0.05"), 100)

    th.deposit(100)
    th.advance(10)
    # fees = 0.05 * 100 * 0.9 = 4.5
    assert th.get_fees() == "4.5"
    th.redeem(50)

    # fees = 0.05 * 100 * 0.9 / 2 = 2.25
    assert th.get_fees() == "2.25"

    th.advance(20)

    # fees = 0.05 * 50 * 0.7 = 1.75
    assert th.get_fees() == "1.75"

    th.deposit(100)
    # fees = 0.05 * 50 * 0.7 + 100 * 0.05 = 6.75
    assert th.get_fees() == "6.75"


def test_deposit_withdraw_alternate_large(th: WithdrawalFeesTestHelper):
    th.initialize_pool(scale("0"), scale("0.05"), 100)

    th.deposit(100)
    th.advance(10)

    # t = 10, fees = 0.05 * 100 * 0.9 = 4.5
    assert th.get_fees() == "4.5"

    th.redeem(50)

    # fees = 0.05 * 50 * 90% = 2.25
    assert th.get_fees() == "2.25"

    th.advance(20)

    # t = 30, fees = 0.05 * 50 * 70% = 1.75
    assert th.get_fees() == "1.75"

    th.deposit(100)
    # fees = 0.05 * 50 * 70% + 100 * 0.05 = 6.75
    assert th.get_fees() == "6.75"

    th.advance(20)

    # t = 50, fees = (0.05 * 50 * 0.7 + 100 * 0.05) * 0.8 = 5.4
    assert th.get_fees() == "5.4"

    th.advance(40)

    # t = 90, fees = (0.05 * 50 * 0.7 + 100 * 0.05) * 0.4 = 2.7
    assert th.get_fees() == "2.7"

    th.redeem(75)
    # t = 90, fee paid: 1.35
    # (0.05 * 50 * 0.7 + 100 * 0.05) * 0.4 * 0.5 = 1.35
    assert th.get_fees() == "1.35"

    th.advance(20)

    # (0.05 * 50 * 0.7 + 100 * 0.05) * 0.2 * 0.5 = 0.675
    assert th.get_fees() == "0.675"

    th.advance(10)

    # (0.05 * 50 * 0.7 + 100 * 0.05) * 0.1 * 0.5 = 0.3375
    assert th.get_fees() == "0.3375"

    th.advance(10)

    # t = 130, fees = 0
    assert th.get_fees() == "0"


def test_deposit_withdraw_alternate_with_min_fee(th: WithdrawalFeesTestHelper):
    th.initialize_pool(scale("0.001"), scale("0.006"), 100)

    th.deposit(100)
    th.advance(10)

    # t = 10, fees = 100 * ((0.006 - 0.001) * 0.9 + 0.001) = 0.55
    assert th.get_fees() == "0.55"

    th.redeem(50)

    # t = 10, fees = 100 * ((0.006 - 0.001) * 0.9 + 0.001) / 2 = 0.275
    assert th.get_fees() == "0.275"

    th.advance(20)

    # t = 30, fees = 50 * (0.005 * 0.7 + 0.001) = 0.225
    assert th.get_fees() == "0.225"

    th.deposit(100)
    # fees = 100 * ((0.006 - 0.001) * 0.7 + 0.001)/2 + 100*0.006 = 0.825
    assert th.get_fees() == "0.825"

    th.advance(20)

    # t = 50, fees =  0.66
    assert th.get_fees() == "0.69"

    th.advance(40)

    # t = 50, fees  = 0.66
    assert th.get_fees() == "0.42"

    th.redeem(75)
    # fee paid: 1.875
    # current fee: 1.875
    # t = 90, fees = 0.165
    assert th.get_fees() == "0.21"


def test_deposit_withdraw_alternate_with_time_to_wait_expiry(
    th: WithdrawalFeesTestHelper,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    th.advance(50)

    # fees = 100 * (0.04 * 0.5 + 0.01) = 3
    assert th.get_fees() == "3"

    th.redeem(50)

    # fees = 100 * (0.04 * 0.5 + 0.01)*0.5 = 1.5
    assert th.get_fees() == "1.5"

    th.advance(50)

    # fees = 100 * 0.01 * 0.5 = 0.5
    assert th.get_fees() == "0.5"

    th.advance(50)

    # fees = 100 * 0.01 * 0.5 = 0.5
    assert th.get_fees() == "0.5"


def test_calc_redeem_simple(th: WithdrawalFeesTestHelper):

    th.initialize_pool(scale("0.00"), scale("0.05"), 100)

    th.deposit(100)

    # Test that the fee calculation works both ways
    assert th.get_calc_redeem(50) == "52.631578"
    assert th.get_fees(52.631578) == "2.631578"

    th.advance(50)
    assert th.get_calc_redeem(50) == "51.282051"
    assert th.get_fees(51.282051) == "1.282051"

    th.advance(50)
    assert th.get_calc_redeem(50) == "50"
    assert th.get_fees(50) == "0"


def test_calc_redeem_simple_with_min_fee(th: WithdrawalFeesTestHelper):

    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)

    # Test that the fee calculation works both ways
    assert th.get_calc_redeem(50) == "52.631578"
    assert th.get_fees(52.631578) == "2.631578"

    th.advance(50)
    assert th.get_calc_redeem(50) == "51.546391"
    assert th.get_fees(51.546391) == "1.546391"

    th.advance(50)
    assert th.get_calc_redeem(50) == "50.505050"
    assert th.get_fees(50.505050) == "0.505050"


def test_calc_redeem_simple_with_min_fee_alternating(th: WithdrawalFeesTestHelper):

    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)

    th.advance(20)
    assert th.get_calc_redeem(20) == "20.876826"

    th.redeem(25)
    # Redeem also causes an exchange rate change
    assert th.get_calc_redeem(50) == "51.471466"

    tx = th.redeem(51.471466)

    redeemed = ScaledDecimalWrapper(
        Decimal(tx.events["Redeem"][0]["redeemAmount"]) / 10**th.decimals
    )
    assert redeemed == "49.999999"


def test_withdrawal_fee_unchanged_on_unstake(
    th: WithdrawalFeesTestHelper, poolSetUp, stakerVault, topUpAction
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})
    assert th.get_fees() == "5"
    stakerVault.stake(th.scale_amount(50), {"from": th.account})
    assert th.get_fees() == "2.5"
    stakerVault.unstake(th.scale_amount(50), {"from": th.account})
    assert th.get_fees() == "5"

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})
    stakerVault.stake(th.scale_amount(50), {"from": th.account})
    th.advance(50)
    assert th.get_fees() == "1.5"
    stakerVault.unstake(th.scale_amount(50), {"from": th.account})
    assert th.get_fees() == "3"


def test_withdrawal_fee_unchanged_on_action_reset(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(topUpAction, th.scale_amount(50), {"from": th.account})
    tx = topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        th.scale_amount(25),
        TopUpRecord(
            threshold=scale("1.2"),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=th.lp_token,
            singleTopUpAmount=th.scale_amount(25),
            totalTopUpAmount=th.scale_amount(25),
        ),
        {"from": th.account, "value": scale(5, 9) * topUpAction.getEstimatedGasUsage()},
    )

    assert th.lp_token.balanceOf(th.account) == th.scale_amount(75)
    assert th.get_fees() == "3.75"
    th.advance(50)
    assert th.get_fees() == "2.25"
    topUpAction.resetPosition(
        encode_account(bob), PROTOCOL_1_ADDRESS, False, {"from": th.account}
    )
    assert th.get_fees() == "2.25"
    stakerVault.unstake(th.scale_amount(25), {"from": th.account})
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)
    assert th.get_fees() == "3"


def test_withdrawal_fee_changed_in_stakervault_transfer_and_unstake(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})
    assert th.get_fees() == "5"
    stakerVault.stake(th.scale_amount(50), {"from": th.account})

    assert th.get_fees() == "2.5"
    assert th.get_fees(account=bob) == "0"

    stakerVault.transfer(bob, th.scale_amount(50), {"from": th.account})
    assert th.get_fees(account=bob) == "0"

    stakerVault.unstake(th.scale_amount(50), {"from": bob})
    assert th.get_fees(account=bob) == "2.5"


def test_withdrawal_fee_changed_in_stakervault_stake_for(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})
    assert th.get_fees() == "5"
    stakerVault.stakeFor(bob, th.scale_amount(50), {"from": th.account})

    assert th.get_fees() == "2.5"
    assert th.get_fees(account=bob) == "0"

    stakerVault.unstake(th.scale_amount(50), {"from": bob})
    assert th.get_fees(account=bob) == "2.5"


def test_withdrawal_fee_unchanged_in_stakervault_stake_for(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    BobHelper = WithdrawalFeesTestHelper(chain, bob, pool, lpToken, decimals)
    BobHelper.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})
    assert th.get_fees() == "5"

    # Staked for bob, which should not change fees if he withdraws less than this
    stakerVault.stakeFor(bob, th.scale_amount(50), {"from": th.account})

    BobHelper.deposit(100)
    BobHelper.lp_token.approve(stakerVault, th.scale_amount(100), {"from": bob})
    stakerVault.stake(th.scale_amount(100), {"from": bob})

    assert th.get_fees() == "2.5"
    assert th.get_fees(account=bob) == "0"
    BobHelper.advance(50)

    # Unstake an amount lower than what was paid in
    stakerVault.unstake(th.scale_amount(50), {"from": bob})
    assert th.get_fees(account=bob) == "1.5"

    # Unstake an amount higher than what was paid in -> fees increase
    stakerVault.unstake(th.scale_amount(100), {"from": bob})
    assert pytest.approx(th.get_fees(account=bob)) == "4.5"


def test_withdrawal_fee_adopted_after_transfer(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    BobHelper = WithdrawalFeesTestHelper(chain, bob, pool, lpToken, decimals)
    BobHelper.initialize_pool(scale("0.01"), scale("0.05"), 100)

    BobHelper.deposit(100)
    BobHelper.advance(50)
    assert BobHelper.get_fees() == "3.0"

    lpToken.transfer(th.account, th.scale_amount("100"), {"from": BobHelper.account})
    assert th.get_fees() == "3.0"


def test_withdrawal_fee_adopted_after_transfer_min_fee(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    BobHelper = WithdrawalFeesTestHelper(chain, bob, pool, lpToken, decimals)
    BobHelper.initialize_pool(scale("0.01"), scale("0.05"), 100)

    BobHelper.deposit(100)
    BobHelper.advance(100)
    assert BobHelper.get_fees() == "1.0"

    lpToken.transfer(th.account, th.scale_amount("100"), {"from": BobHelper.account})
    assert th.get_fees() == "1.0"


def test_withdrawal_fee_adopted_after_transfer_max_fee(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    BobHelper = WithdrawalFeesTestHelper(chain, bob, pool, lpToken, decimals)
    BobHelper.initialize_pool(scale("0.01"), scale("0.05"), 100)

    BobHelper.deposit(100)
    assert BobHelper.get_fees() == "5.0"

    lpToken.transfer(th.account, th.scale_amount("100"), {"from": BobHelper.account})
    assert th.get_fees() == "5.0"


def test_unstake_for_increases_fee_like_transfer(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})

    assert th.get_fees() == "5"
    stakerVault.stake(th.scale_amount(50), {"from": th.account})
    assert th.get_fees() == "2.5"

    assert th.get_fees(account=bob) == "0"

    stakerVault.unstakeFor(th.account, bob, th.scale_amount(50), {"from": th.account})

    assert th.get_fees(account=bob) == "2.5"
    assert th.get_fees() == "2.5"


def test_unstake_for_full_amount_increases_fee_like_transfer(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})

    assert th.get_fees() == "5"
    stakerVault.stake(th.scale_amount(100), {"from": th.account})
    assert th.get_fees() == "0"

    assert th.get_fees(account=bob) == "0"

    stakerVault.unstakeFor(th.account, bob, th.scale_amount(100), {"from": th.account})

    assert th.get_fees(account=bob) == "5"
    assert th.get_fees() == "0"


def test_unstake_for_respects_time_decay_of_fees(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})

    assert th.get_fees() == "5"
    stakerVault.stake(th.scale_amount(100), {"from": th.account})
    th.advance(50)
    assert th.get_fees() == "0"

    assert th.get_fees(account=bob) == "0"

    stakerVault.unstakeFor(th.account, bob, th.scale_amount(100), {"from": th.account})

    assert th.get_fees(account=bob) == "3"
    assert th.get_fees() == "0"


def test_unstake_for_multiple(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)

    th.deposit(100)
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})

    assert th.get_fees() == "5"
    stakerVault.stake(th.scale_amount(100), {"from": th.account})
    th.advance(50)
    assert th.get_fees() == "0"

    assert th.get_fees(account=bob) == "0"

    stakerVault.unstakeFor(th.account, bob, th.scale_amount(50), {"from": th.account})

    assert th.get_fees(account=bob) == "1.5"
    assert th.get_fees() == "0"

    th.advance(30)
    stakerVault.unstakeFor(th.account, bob, th.scale_amount(50), {"from": th.account})

    assert th.get_fees(account=bob) == "1.935"


def test_action_resetting_is_for_free_with_unstake(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)
    th.deposit(100)
    th.lp_token.approve(topUpAction, th.scale_amount(100), {"from": th.account})
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)
    assert th.get_fees() == "5"

    value = scale(25, 9) * topUpAction.getEstimatedGasUsage()
    tx = topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        th.scale_amount(50),
        TopUpRecord(
            threshold=scale("1.2"),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=th.lp_token,
            singleTopUpAmount=th.scale_amount(10),
            totalTopUpAmount=th.scale_amount(50),
        ),
        {"from": th.account, "value": value},
    )

    th.advance(50)
    assert th.get_fees() == "1.5"

    tx = topUpAction.resetPosition(
        encode_account(bob), PROTOCOL_1_ADDRESS, True, {"from": th.account}
    )

    assert th.get_fees() == "3"


def test_action_resetting_is_for_free_without_unstake(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)
    th.deposit(100)
    th.lp_token.approve(topUpAction, th.scale_amount(100), {"from": th.account})
    assert th.lp_token.balanceOf(th.account) == th.scale_amount(100)
    assert th.get_fees() == "5"

    value = scale(25, 9) * topUpAction.getEstimatedGasUsage()
    tx = topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        th.scale_amount(50),
        TopUpRecord(
            threshold=scale("1.2"),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=th.lp_token,
            singleTopUpAmount=th.scale_amount(10),
            totalTopUpAmount=th.scale_amount(50),
        ),
        {"from": th.account, "value": value},
    )

    th.advance(50)
    assert th.get_fees() == "1.5"

    tx = topUpAction.resetPosition(
        encode_account(bob), PROTOCOL_1_ADDRESS, False, {"from": th.account}
    )

    stakerVault.unstake(th.scale_amount(50), {"from": th.account})

    assert th.get_fees() == "3"


def test_withdrawal_fee_cannot_be_avoided_by_position_registration(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
    alice,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)
    BobHelper = WithdrawalFeesTestHelper(chain, bob, pool, lpToken, decimals)
    BobHelper.initialize_pool(scale("0.01"), scale("0.05"), 100)
    # Wallet 1 at minimum withdrawal fee
    th.deposit(0.001)
    chain.sleep(100)

    BobHelper.deposit(100)
    assert lpToken.balanceOf(bob) == th.scale_amount(100)
    assert lpToken.balanceOf(th.account) == th.scale_amount(0.001)

    BobHelper.lp_token.approve(
        topUpAction, th.scale_amount(100), {"from": BobHelper.account}
    )

    value = scale(50, 9) * topUpAction.getEstimatedGasUsage()
    topUpAction.register(
        encode_account(alice),
        PROTOCOL_1_ADDRESS,
        th.scale_amount(100),
        TopUpRecord(
            threshold=scale("5"),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=th.lp_token,
            singleTopUpAmount=th.scale_amount(10),
            totalTopUpAmount=th.scale_amount(100),
        ),
        {"from": bob, "value": value},
    )

    # tx = topUpAction.register(
    #     alice,
    #     PROTOCOL_1_ADDRESS,
    #     scale(5),
    #     th.lp_token,
    #     th.scale_amount(100),
    #     coin,
    #     th.scale_amount(10),
    #     th.scale_amount(100),
    #     5,
    #     False,
    #     {"from": bob},
    # )

    tx = lpToken.transfer(
        BobHelper.account, th.scale_amount("0.001"), {"from": th.account}
    )

    tx = topUpAction.resetPosition(
        encode_account(alice), PROTOCOL_1_ADDRESS, True, {"from": BobHelper.account}
    )
    assert BobHelper.get_fees().to_float() == pytest.approx(5.0, rel=0.1)


def test_withdrawal_fee_cannot_be_avoided_by_staking_and_unstake_for(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
    alice,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)
    BobHelper = WithdrawalFeesTestHelper(chain, bob, pool, lpToken, decimals)
    BobHelper.initialize_pool(scale("0.01"), scale("0.05"), 100)
    th.deposit(100)
    assert lpToken.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})
    stakerVault.stake(th.scale_amount(100), {"from": th.account})
    stakerVault.unstakeFor(
        th.account, BobHelper.account, th.scale_amount(100), {"from": th.account}
    )

    assert pytest.approx(BobHelper.get_fees()) == "5"


def test_position_registration_works_after_transfer_in_staker_vault(
    th: WithdrawalFeesTestHelper,
    poolSetUp,
    stakerVault,
    topUpAction,
    bob,
    coin,
    registerSetUp,
    lpToken,
    pool,
    decimals,
    chain,
    alice,
):
    th.initialize_pool(scale("0.01"), scale("0.05"), 100)
    BobHelper = WithdrawalFeesTestHelper(chain, bob, pool, lpToken, decimals)
    BobHelper.initialize_pool(scale("0.01"), scale("0.05"), 100)
    th.deposit(100)
    assert lpToken.balanceOf(th.account) == th.scale_amount(100)

    th.lp_token.approve(stakerVault, th.scale_amount(100), {"from": th.account})
    stakerVault.stake(th.scale_amount(100), {"from": th.account})

    stakerVault.transfer(BobHelper.account, th.scale_amount(100), {"from": th.account})

    assert stakerVault.balances(BobHelper.account) == th.scale_amount(100)

    stakerVault.approve(topUpAction, th.scale_amount(100), {"from": BobHelper.account})

    value = scale(25, 9) * topUpAction.getEstimatedGasUsage()
    topUpAction.register(
        encode_account(alice),
        PROTOCOL_1_ADDRESS,
        0,
        TopUpRecord(
            threshold=scale("5"),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=th.lp_token,
            singleTopUpAmount=th.scale_amount(10),
            totalTopUpAmount=th.scale_amount(50),
        ),
        {"from": BobHelper.account, "value": value},
    )

    topUpAction.resetPosition(
        encode_account(alice), PROTOCOL_1_ADDRESS, True, {"from": BobHelper.account}
    )

    assert pytest.approx(BobHelper.get_fees()) == "2.5"
