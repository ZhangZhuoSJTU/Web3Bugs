import pytest
import brownie
import eth_abi
from tests.helpers import get_balance_trade_action, get_lend_action
from brownie import Contract, wfCashERC4626, network, nUpgradeableBeacon
from brownie.project import WrappedFcashProject
from brownie.convert.datatypes import Wei
from brownie.convert import to_bytes
from brownie.network import Chain
from scripts.EnvironmentConfig import getEnvironment

chain = Chain()

@pytest.fixture(autouse=True)
def run_around_tests():
    chain.snapshot()
    yield
    chain.revert()

@pytest.fixture()
def env():
    name = network.show_active()
    if name == 'mainnet-fork':
        return getEnvironment('mainnet')
    elif name == 'kovan-fork':
        return getEnvironment('kovan')

@pytest.fixture() 
def beacon(wfCashERC4626, nUpgradeableBeacon, env):
    impl = wfCashERC4626.deploy(env.notional.address, env.tokens['WETH'], {"from": env.deployer})
    return nUpgradeableBeacon.deploy(impl.address, {"from": env.deployer})

@pytest.fixture() 
def factory(WrappedfCashFactory, beacon, env):
    return WrappedfCashFactory.deploy(beacon.address, {"from": env.deployer})

@pytest.fixture() 
def wrapper(factory, env):
    markets = env.notional.getActiveMarkets(2)
    txn = factory.deployWrapper(2, markets[0][1])
    return Contract.from_abi("Wrapper", txn.events['WrapperDeployed']['wrapper'], wfCashERC4626.abi)

@pytest.fixture() 
def lender(env, accounts):
    acct = accounts[4]
    env.tokens["DAI"].transfer(acct, 1_000_000e18, {'from': env.whales["DAI_EOA"]})
    
    env.tokens["DAI"].approve(env.notional.address, 2**255-1, {'from': acct})
    env.notional.batchBalanceAndTradeAction(
        acct,
        [ 
            get_balance_trade_action(
                2,
                "DepositUnderlying",
                [{
                    "tradeActionType": "Lend",
                    "marketIndex": 1,
                    "notional": 100_000e8,
                    "minSlippage": 0
                }],
                depositActionAmount=100_000e18,
                withdrawEntireCashBalance=True,
                redeemToUnderlying=True,
            )
        ], { "from": acct }
    )

    return acct

@pytest.fixture() 
def lender_contract(env):
    env.tokens["DAI"].approve(env.notional.address, 2**255-1, {'from': env.whales["DAI_CONTRACT"]})
    env.notional.batchBalanceAndTradeAction(
        env.whales["DAI_CONTRACT"],
        [ 
            get_balance_trade_action(
                2,
                "DepositUnderlying",
                [{
                    "tradeActionType": "Lend",
                    "marketIndex": 1,
                    "notional": 100_000e8,
                    "minSlippage": 0
                }],
                depositActionAmount=100_000e18,
                withdrawEntireCashBalance=True,
                redeemToUnderlying=True,
            )
        ], { "from": env.whales["DAI_CONTRACT"] }
    )

    return env.whales["DAI_CONTRACT"]

# Deploy and Upgrade
def test_deploy_wrapped_fcash(factory, env):
    markets = env.notional.getActiveMarkets(2)
    computedAddress = factory.computeAddress(2, markets[0][1])
    txn = factory.deployWrapper(2, markets[0][1], {"from": env.deployer})
    assert txn.events['WrapperDeployed']['wrapper'] == computedAddress

    wrapper = Contract.from_abi("Wrapper", computedAddress, wfCashERC4626.abi)
    assert wrapper.getCurrencyId() == 2
    assert wrapper.getMaturity() == markets[0][1]
    assert wrapper.name() == "Wrapped fDAI @ {}".format(markets[0][1])
    assert wrapper.symbol() == "wfDAI:{}".format(markets[0][1])

def test_upgrade_wrapped_fcash(factory, beacon, wrapper, env):
    assert wrapper.getCurrencyId() == 2

    beacon.upgradeTo(factory.address, {"from": env.deployer})

    with brownie.reverts():
        wrapper.getCurrencyId()


def test_cannot_deploy_wrapper_twice(factory, env):
    markets = env.notional.getActiveMarkets(2)
    txn = factory.deployWrapper(2, markets[0][1])
    assert txn.events['WrapperDeployed'] is not None

    txn = factory.deployWrapper(2, markets[0][1])
    assert 'WrapperDeployed' not in txn.events

def test_cannot_deploy_invalid_currency(factory, env):
    markets = env.notional.getActiveMarkets(2)
    with brownie.reverts():
        factory.deployWrapper(99, markets[0][1])

def test_cannot_deploy_invalid_maturity(factory, env):
    markets = env.notional.getActiveMarkets(2)
    with brownie.reverts():
        factory.deployWrapper(2, markets[0][1] + 86400 * 720)

# Test Minting fCash
def test_only_accepts_notional_v2(wrapper, beacon, lender, env):
    impl = wfCashERC4626.deploy(env.deployer.address, env.tokens["WETH"].address, {"from": env.deployer})

    # Change the address of notional on the beacon
    beacon.upgradeTo(impl.address)

    with brownie.reverts("Invalid"):
        env.notional.safeTransferFrom(
            lender.address,
            wrapper.address,
            wrapper.getfCashId(),
            100_000e8,
            "",
            {"from": lender}
        )


def test_cannot_transfer_invalid_fcash(lender, factory, env):
    markets = env.notional.getActiveMarkets(2)
    txn = factory.deployWrapper(2, markets[1][1])
    wrapper = Contract.from_abi("Wrapper", txn.events['WrapperDeployed']['wrapper'], wfCashERC4626.abi)
    fCashId = env.notional.encodeToId(2, markets[0][1], 1)

    with brownie.reverts():
        env.notional.safeTransferFrom(
            lender.address,
            wrapper.address,
            fCashId,
            100_000e8,
            "",
            {"from": lender}
        )

def test_cannot_transfer_batch_fcash(wrapper, lender, env):
    with brownie.reverts():
        env.notional.safeBatchTransferFrom(
            lender.address,
            wrapper.address,
            [wrapper.getfCashId()],
            [100_000e8],
            "",
            {"from": lender}
        )

def test_transfer_fcash(wrapper, lender, env):
    env.notional.safeTransferFrom(
        lender.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender}
    )

    assert wrapper.balanceOf(lender) == 100_000e8

def test_transfer_fcash_to_contract(wrapper, lender_contract, env):
    env.notional.safeTransferFrom(
        lender_contract.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender_contract}
    )

    assert wrapper.balanceOf(lender_contract) == 100_000e8

# Test Redeem fCash

def test_fail_redeem_above_balance(wrapper, lender, env):
    env.notional.safeTransferFrom(
        lender.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender}
    )

    with brownie.reverts():
        wrapper.redeem(105_000e8, (False, False, lender.address, 0), {"from": lender})
        wrapper.redeemToAsset(105_000e8, lender.address, 0, {"from": lender})
        wrapper.redeemToUnderlying(105_000e8, lender.address, 0, {"from": lender})

def test_transfer_fcash(wrapper, lender, env):
    env.notional.safeTransferFrom(
        lender.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender}
    )
    wrapper.redeem(50_000e8, (False, True, lender, 0), {"from": lender})

    assert wrapper.balanceOf(lender.address) == 50_000e8
    assert env.notional.balanceOf(lender.address, wrapper.getfCashId()) == 50_000e8

@pytest.mark.skip
def test_transfer_fcash_contract(wrapper, lender_contract, env):
    env.notional.safeTransferFrom(
        lender_contract.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender_contract}
    )

    # This does not work on kovan right now...
    with brownie.reverts():
        wrapper.redeem(
            50_000e8,
            (False, True, lender_contract, 0),
            {"from": lender_contract}
        )

    wrapper.transfer(env.deployer, 50_000e8, {"from": lender_contract})

    assert wrapper.balanceOf(lender_contract.address) == 50_000e8
    assert wrapper.balanceOf(env.deployer) == 50_000e8

def test_redeem_post_maturity_asset(wrapper, lender, env):
    env.notional.safeTransferFrom(
        lender.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender}
    )

    chain.mine(1, timestamp=wrapper.getMaturity())
    wrapper.redeemToAsset(50_000e8, lender.address, 0, {"from": lender})

    assert wrapper.balanceOf(lender.address) == 50_000e8
    expectedAssetTokens = Wei(50_000e8 * 1e10 * 1e18) / env.tokens['cDAI'].exchangeRateStored()
    assert pytest.approx(env.tokens["cDAI"].balanceOf(lender.address), abs=100) == expectedAssetTokens

def test_redeem_post_maturity_underlying(wrapper, lender, env):
    env.notional.safeTransferFrom(
        lender.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender}
    )

    chain.mine(1, timestamp=wrapper.getMaturity())
    wrapper.redeemToUnderlying(50_000e8, lender.address, 0, {"from": lender})

    assert wrapper.balanceOf(lender.address) == 50_000e8
    assert env.tokens["DAI"].balanceOf(lender.address) >= 50_000e18

def test_redeem_failure_slippage(wrapper, lender, env):
    env.notional.safeTransferFrom(
        lender.address,
        wrapper.address,
        wrapper.getfCashId(),
        100_000e8,
        "",
        {"from": lender}
    )

    with brownie.reverts('Trade failed, slippage'):
        wrapper.redeemToUnderlying(50_000e8, lender.address, 0.01e9, {"from": lender})

    wrapper.redeemToUnderlying(50_000e8, lender.address, 0.2e9, {"from": lender})
    assert wrapper.balanceOf(lender.address) == 50_000e8

# Test Direct fCash Trading
def test_mint_failure_slippage(wrapper, lender, env):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    with brownie.reverts():
        wrapper.mintViaUnderlying(
            10_000e18,
            10_000e8,
            lender.address,
            0.2e9,
            {'from': lender}
        )

    wrapper.mintViaUnderlying(
        10_000e18,
        10_000e8,
        lender.address,
        0.01e9,
        {'from': lender}
    )

    assert wrapper.balanceOf(lender.address) == 10_000e8


def test_mint_and_redeem_fcash_via_underlying(wrapper, lender, env):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender.address})
    wrapper.mintViaUnderlying(
        10_000e18,
        10_000e8,
        lender.address,
        0,
        {'from': lender.address}
    )
    assert env.tokens["cDAI"].balanceOf(wrapper.address) == 0
    assert env.tokens["DAI"].balanceOf(wrapper.address) == 0

    assert wrapper.balanceOf(lender.address) == 10_000e8
    portfolio = env.notional.getAccount(wrapper.address)[2]
    assert portfolio[0][0] == wrapper.getCurrencyId()
    assert portfolio[0][1] == wrapper.getMaturity()
    assert portfolio[0][3] == 10_000e8
    assert len(portfolio) == 1

    # Now redeem the fCash
    balanceBefore = env.tokens["DAI"].balanceOf(lender.address)
    wrapper.redeemToUnderlying(
        10_000e8,
        lender.address,
        0,
        {"from": lender.address}
    )
    balanceAfter = env.tokens["DAI"].balanceOf(lender.address)
    balanceChange = balanceAfter - balanceBefore 

    assert 9700e18 <= balanceChange and balanceChange <= 9990e18
    portfolio = env.notional.getAccount(wrapper.address)[2]
    assert len(portfolio) == 0
    assert wrapper.balanceOf(lender.address) == 0

    assert env.tokens["cDAI"].balanceOf(wrapper.address) == 0
    assert env.tokens["DAI"].balanceOf(wrapper.address) == 0

def test_mint_and_redeem_fusdc_via_underlying(factory, env):
    markets = env.notional.getActiveMarkets(2)
    txn = factory.deployWrapper(3, markets[0][1])
    wrapper = Contract.from_abi("Wrapper", txn.events['WrapperDeployed']['wrapper'], wfCashERC4626.abi)

    env.tokens["USDC"].approve(wrapper.address, 2 ** 255 - 1, {'from': env.whales["USDC"].address})
    wrapper.mintViaUnderlying(
        10_000e6,
        10_000e8,
        env.whales["USDC"].address,
        0,
        {'from': env.whales["USDC"].address}
    )
    assert env.tokens["cUSDC"].balanceOf(wrapper.address) == 0
    assert env.tokens["USDC"].balanceOf(wrapper.address) == 0

    assert wrapper.balanceOf(env.whales["USDC"].address) == 10_000e8
    portfolio = env.notional.getAccount(wrapper.address)[2]
    assert portfolio[0][0] == wrapper.getCurrencyId()
    assert portfolio[0][1] == wrapper.getMaturity()
    assert portfolio[0][3] == 10_000e8
    assert len(portfolio) == 1

    # Now redeem the fCash
    balanceBefore = env.tokens["USDC"].balanceOf(env.whales["USDC"].address)
    wrapper.redeemToUnderlying(
        10_000e8,
        env.whales["USDC"].address,
        0,
        {"from": env.whales["USDC"].address}
    )
    balanceAfter = env.tokens["USDC"].balanceOf(env.whales["USDC"].address)
    balanceChange = balanceAfter - balanceBefore 

    assert 9700e6 <= balanceChange and balanceChange <= 9900e6
    portfolio = env.notional.getAccount(wrapper.address)[2]
    assert len(portfolio) == 0
    assert wrapper.balanceOf(env.whales["USDC"].address) == 0
    assert env.tokens["cUSDC"].balanceOf(wrapper.address) == 0
    assert env.tokens["USDC"].balanceOf(wrapper.address) == 0

def test_mint_and_redeem_fcash_via_asset(wrapper, env, accounts):
    acct = accounts[0]
    env.tokens["DAI"].transfer(acct, 100_000e18, {'from': env.whales["DAI_EOA"]})
    env.tokens["DAI"].approve(env.tokens["cDAI"].address, 2 ** 255 - 1, {'from': acct})
    env.tokens["cDAI"].mint(100_000e18, {'from': acct})
    env.tokens["cDAI"].approve(wrapper.address, 2**255-1, {'from': acct})

    wrapper.mintViaAsset(
        500_000e8,
        10_000e8,
        acct.address,
        0,
        {'from': acct}
    )
    assert env.tokens["cDAI"].balanceOf(wrapper.address) == 0
    assert env.tokens["DAI"].balanceOf(wrapper.address) == 0

    assert wrapper.balanceOf(acct.address) == 10_000e8
    portfolio = env.notional.getAccount(wrapper.address)[2]
    assert portfolio[0][0] == wrapper.getCurrencyId()
    assert portfolio[0][1] == wrapper.getMaturity()
    assert portfolio[0][3] == 10_000e8
    assert len(portfolio) == 1

    # Now redeem the fCash
    balanceBefore = env.tokens["cDAI"].balanceOf(acct.address)
    wrapper.redeemToAsset(10_000e8, acct.address, 0, {"from": acct.address})
    balanceAfter = env.tokens["cDAI"].balanceOf(acct.address)
    balanceChange = balanceAfter - balanceBefore 

    assert 440_000e8 <= balanceChange and balanceChange <= 499_000e8
    portfolio = env.notional.getAccount(wrapper.address)[2]
    assert len(portfolio) == 0
    assert wrapper.balanceOf(acct.address) == 0
    assert env.tokens["cDAI"].balanceOf(wrapper.address) == 0
    assert env.tokens["DAI"].balanceOf(wrapper.address) == 0

def test_lend_via_erc1155_action_asset_token(wrapper, env, accounts):
    acct = accounts[0]
    env.tokens["DAI"].transfer(acct, 100_000e18, {'from': env.whales["DAI_EOA"]})
    env.tokens["DAI"].approve(env.tokens["cDAI"].address, 2 ** 255 - 1, {'from': acct})
    env.tokens["cDAI"].mint(100_000e18, {'from': acct})
    env.tokens["cDAI"].approve(env.notional.address, 2**255-1, {'from': acct})

    # Requires approval on the Notional side...
    action = get_lend_action(
        2,
        [{"tradeActionType": "Lend", "marketIndex": wrapper.getMarketIndex(),
            "notional": 100_000e8, "minSlippage": 0}],
        False,
    )
    lendCallData = env.notional.batchLend.encode_input(acct.address, [action])

    # will msg.sender will lend directly on notional, via erc1155 transfer
    env.notional.safeTransferFrom(
        acct.address, # msg.sender
        wrapper.address, # wrapper will receive fCash
        wrapper.getfCashId(),
        100_000e8,
        lendCallData,
        {"from": acct}
    )

    assert env.tokens["cDAI"].balanceOf(wrapper.address) == 0
    assert env.tokens["DAI"].balanceOf(wrapper.address) == 0

    # test balance on wrapper and in notional fCash
    assert wrapper.balanceOf(acct.address) == 100_000e8
    # assert that the account has no Notional position
    portfolio = env.notional.getAccount(acct.address)[2]
    assert len(portfolio) == 0

def test_lend_via_erc1155_action_underlying_token(wrapper, env, accounts):
    acct = accounts[0]
    env.tokens["DAI"].transfer(acct, 100_000e18, {'from': env.whales["DAI_EOA"]})
    env.tokens["DAI"].approve(env.notional.address, 2 ** 255 - 1, {'from': acct})

    # Requires approval on the Notional side...
    action = get_lend_action(
        2,
        [{"tradeActionType": "Lend", "marketIndex": wrapper.getMarketIndex(),
            "notional": 100_000e8, "minSlippage": 0}],
        True,
    )
    lendCallData = env.notional.batchLend.encode_input(acct.address, [action])

    # will msg.sender will lend directly on notional, via erc1155 transfer
    env.notional.safeTransferFrom(
        acct.address, # msg.sender
        wrapper.address, # wrapper will receive fCash
        wrapper.getfCashId(),
        100_000e8,
        lendCallData,
        {"from": acct}
    )

    assert env.tokens["cDAI"].balanceOf(wrapper.address) == 0
    assert env.tokens["DAI"].balanceOf(wrapper.address) == 0

    # test balance on wrapper and in notional fCash
    assert wrapper.balanceOf(acct.address) == 100_000e8
    # assert that the account has no Notional position
    portfolio = env.notional.getAccount(acct.address)[2]
    assert len(portfolio) == 0

# ERC4626 tests
def test_deposit_4626(wrapper, env, lender):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})

    # There is a little drift between these two calls
    preview = wrapper.previewDeposit(100e18)
    txn = wrapper.deposit(100e18, lender.address, {"from": lender})

    assert pytest.approx(wrapper.balanceOf(lender.address), abs=100) == preview
    assert txn.events['Deposit']['shares'] == wrapper.balanceOf(lender.address)

def test_deposit_receiver_4626(wrapper, env, lender, accounts):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})

    preview = wrapper.previewDeposit(100e18)
    txn = wrapper.deposit(100e18, accounts[0].address, {"from": lender})

    assert pytest.approx(wrapper.balanceOf(accounts[0].address), abs=100) == preview
    assert txn.events['Deposit']['shares'] == wrapper.balanceOf(accounts[0].address)
    assert wrapper.balanceOf(lender.address) == 0

def test_deposit_matured_4626(wrapper, env, lender):
    chain.mine(1, timestamp=wrapper.getMaturity())

    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})

    assert wrapper.previewDeposit(100e18) == 0

    with brownie.reverts("fCash matured"):
        wrapper.deposit(100e18, lender.address, {"from": lender})

def test_mint_4626(wrapper, env, lender):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    daiBalanceBefore = env.tokens["DAI"].balanceOf(lender.address)

    assets = wrapper.previewMint(100e8)
    wrapper.mint(100e8, lender.address, {"from": lender})
    daiBalanceAfter = env.tokens["DAI"].balanceOf(lender.address)

    assert pytest.approx(daiBalanceBefore - daiBalanceAfter, abs=1e11) == assets
    assert wrapper.balanceOf(lender.address) == 100e8

def test_mint_receiver_4626(wrapper, env, lender, accounts):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    daiBalanceBefore = env.tokens["DAI"].balanceOf(lender.address)

    assets = wrapper.previewMint(100e8)
    wrapper.mint(100e8, accounts[0].address, {"from": lender})
    daiBalanceAfter = env.tokens["DAI"].balanceOf(lender.address)

    assert pytest.approx(daiBalanceBefore - daiBalanceAfter, abs=1e11) == assets
    assert wrapper.balanceOf(lender.address) == 0
    assert wrapper.balanceOf(accounts[0].address) == 100e8

def test_mint_deposit_matured_4626(wrapper, env, lender):
    chain.mine(1, timestamp=wrapper.getMaturity())

    with brownie.reverts("fCash matured"):
        wrapper.mint(100e8, lender.address, {"from": lender})
        wrapper.deposit(100e18, lender.address, {"from": lender})

def test_withdraw_4626(wrapper, env, lender, accounts):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})
    balanceBefore = wrapper.balanceOf(lender.address)
    daiBalanceBefore = env.tokens["DAI"].balanceOf(lender.address)

    shares = wrapper.previewWithdraw(50e18)
    wrapper.withdraw(50e18, lender.address, lender.address, {'from': lender.address})
    balanceAfter = wrapper.balanceOf(lender.address)
    daiBalanceAfter = env.tokens["DAI"].balanceOf(lender.address)
    assert balanceBefore - balanceAfter == shares
    assert pytest.approx(daiBalanceAfter - daiBalanceBefore, abs=1e11) == 50e18

def test_withdraw_receiver_4626(wrapper, env, lender, accounts):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})
    balanceBefore = wrapper.balanceOf(lender.address)

    shares = wrapper.previewWithdraw(50e18)
    wrapper.withdraw(50e18, accounts[0].address, lender.address, {'from': lender.address})
    assert wrapper.balanceOf(lender.address) == balanceBefore - shares
    assert pytest.approx(env.tokens['DAI'].balanceOf(accounts[0].address), abs=1e11) == 50e18

def test_withdraw_allowance_4626(wrapper, env, lender, accounts):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})
    balanceBefore = wrapper.balanceOf(lender.address)

    with brownie.reverts("ERC777: insufficient allowance"):
        # No allowance set
        wrapper.withdraw(50e18, accounts[0].address, lender.address, {'from': accounts[0].address})
    wrapper.approve(accounts[0].address, 10e8, {'from': lender})

    with brownie.reverts("ERC777: insufficient allowance"):
        # Insufficient allowance
        wrapper.withdraw(50e18, accounts[0].address, lender.address, {'from': accounts[0].address})
    wrapper.approve(accounts[0].address, 100e8, {'from': lender})

    shares = wrapper.previewWithdraw(50e18)
    txn = wrapper.withdraw(50e18, accounts[0].address, lender.address, {'from': accounts[0].address})
    assert pytest.approx(shares, abs=100) == txn.events["Withdraw"]["shares"]
    assert wrapper.balanceOf(lender.address) == balanceBefore - txn.events["Withdraw"]["shares"]
    assert pytest.approx(env.tokens['DAI'].balanceOf(accounts[0].address), abs=1e11) == 50e18

def test_withdraw_matured_4626(wrapper, env, lender, accounts):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})

    chain.mine(1, timestamp=wrapper.getMaturity())
    balanceBefore = wrapper.balanceOf(lender.address)

    env.notional.settleAccount(wrapper.address, {"from": lender})

    shares = wrapper.previewWithdraw(50e18)
    txn = wrapper.withdraw(50e18, accounts[0].address, lender.address, {'from': lender})
    assert pytest.approx(shares, abs=100) == txn.events["Withdraw"]["shares"]
    assert wrapper.balanceOf(lender.address) == balanceBefore - txn.events["Withdraw"]["shares"]
    assert env.tokens['DAI'].balanceOf(accounts[0].address) > 50e18
    assert env.tokens['DAI'].balanceOf(accounts[0].address) < 50.1e18

def test_redeem_4626(wrapper, env, lender, accounts):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})
    balanceBefore = wrapper.balanceOf(lender.address)
    daiBalanceBefore = env.tokens["DAI"].balanceOf(lender.address)

    assets = wrapper.previewRedeem(50e8)
    wrapper.redeem(50e8, lender.address, lender.address, {'from': lender.address})
    balanceAfter = wrapper.balanceOf(lender.address)
    daiBalanceAfter = env.tokens["DAI"].balanceOf(lender.address)
    assert balanceBefore - balanceAfter == 50e8
    assert pytest.approx(daiBalanceAfter - daiBalanceBefore, abs=1e11) == assets

def test_redeem_receiver_4626(wrapper, env, accounts, lender):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})
    balanceBefore = wrapper.balanceOf(lender.address)

    assets = wrapper.previewRedeem(100e8)
    wrapper.redeem(100e8, accounts[0].address, lender.address, {'from': lender.address})
    assert wrapper.balanceOf(lender.address) == 0
    assert pytest.approx(env.tokens['DAI'].balanceOf(accounts[0].address), abs=1e11) == assets

def test_redeem_allowance_4626(wrapper, env, accounts, lender):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})
    balanceBefore = wrapper.balanceOf(lender.address)

    with brownie.reverts("ERC777: insufficient allowance"):
        # No allowance set
        wrapper.redeem(50e8, accounts[0].address, lender.address, {'from': accounts[0].address})
    wrapper.approve(accounts[0].address, 10e8, {'from': lender})

    with brownie.reverts("ERC777: insufficient allowance"):
        # Insufficient allowance
        wrapper.redeem(50e8, accounts[0].address, lender.address, {'from': accounts[0].address})
    wrapper.approve(accounts[0].address, 100e8, {'from': lender})

    assets = wrapper.previewRedeem(50e8)
    wrapper.redeem(50e8, accounts[0].address, lender.address, {'from': accounts[0].address})
    assert wrapper.balanceOf(lender.address) == balanceBefore - 50e8
    assert pytest.approx(env.tokens['DAI'].balanceOf(accounts[0].address), abs=1.1e11) == assets

def test_redeem_matured_4626(wrapper, env, accounts, lender):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})

    chain.mine(1, timestamp=wrapper.getMaturity())
    balanceBefore = wrapper.balanceOf(lender.address)

    env.notional.settleAccount(wrapper.address, {"from": lender})

    assets = wrapper.previewRedeem(100e8)
    txn = wrapper.redeem(100e8, accounts[0].address, lender.address, {'from': lender})
    assert wrapper.balanceOf(lender.address) == 0
    assert env.tokens['DAI'].balanceOf(accounts[0].address) > 100e18
    assert env.tokens['DAI'].balanceOf(accounts[0].address) < 100.1e18

def test_mint_and_redeem_via_weth(factory, env, accounts, lender):
    markets = env.notional.getActiveMarkets(1)
    txn = factory.deployWrapper(1, markets[0][1])
    wrapper = Contract.from_abi("Wrapper", txn.events['WrapperDeployed']['wrapper'], wfCashERC4626.abi)
    wethABI = WrappedFcashProject._build.get("WETH9")["abi"]
    weth = Contract.from_abi("WETH", env.tokens["WETH"], wethABI)
    
    account = accounts[1]
    weth.deposit({'from': account, 'value': 1e18})

    env.tokens['WETH'].approve(wrapper.address, 2**255-1, {"from": account})
    balanceBefore = env.tokens["WETH"].balanceOf(account)
    wrapper.mintViaUnderlying(1e18, 1e8, account.address, 0, {"from": account})
    balanceAfter = env.tokens["WETH"].balanceOf(account)

    assert wrapper.balanceOf(account) == 1e8
    # There is some residual WETH left
    assert 0.98e18 <= balanceBefore - balanceAfter and balanceBefore - balanceAfter <= 1e18

    # Redeem to underlying mints WETH
    wrapper.redeemToUnderlying(1e8, accounts[2].address, 0, {'from': account})
    assert wrapper.balanceOf(account.address) == 0
    assert env.tokens['WETH'].balanceOf(accounts[2].address) > 0.98e18
    assert env.tokens['WETH'].balanceOf(accounts[2].address) < 1e18

def test_mint_redeem_eth_4626(factory, env, lender, accounts):
    markets = env.notional.getActiveMarkets(1)
    txn = factory.deployWrapper(1, markets[0][1])
    wrapper = Contract.from_abi("Wrapper", txn.events['WrapperDeployed']['wrapper'], wfCashERC4626.abi)
    wethABI = WrappedFcashProject._build.get("WETH9")["abi"]
    weth = Contract.from_abi("WETH", env.tokens["WETH"], wethABI)
    
    account = accounts[1]
    weth.deposit({'from': account, 'value': 1e18})
    
    env.tokens['WETH'].approve(wrapper.address, 2**255-1, {"from": account})
    wrapper.mint(1e8, account.address, {"from": account})
    assert wrapper.balanceOf(account.address) == 1e8
    assert env.tokens["WETH"].balanceOf(account) < 0.1e18

    wrapper.redeem(1e8, account.address, account.address, {"from": account})
    assert env.tokens["WETH"].balanceOf(account) > 0.95e18
    assert wrapper.balanceOf(account.address) == 0

    wrapper.deposit(0.95e18, account.address, {"from": account})
    assert wrapper.balanceOf(account.address) > 0.95e8
    assert env.tokens["WETH"].balanceOf(account) < 0.05e18

    chain.mine(1, timestamp=wrapper.getMaturity())
    env.notional.settleAccount(wrapper.address, {"from": account})
    wrapper.redeem(wrapper.balanceOf(account), account.address, account.address, {"from": account})
    assert env.tokens["WETH"].balanceOf(account) > 0.95e18

def test_convert_to_and_from_shares_zero_supply(env, wrapper):
    assert wrapper.totalAssets() == 0
    assert 100e8 < wrapper.convertToShares(100e18) and wrapper.convertToShares(100e18) < 105e8
    assert 95e18 < wrapper.convertToAssets(100e8) and wrapper.convertToAssets(100e8) < 100e18


def test_convert_to_and_from_shares(env, wrapper, lender):
    env.tokens["DAI"].approve(wrapper.address, 2 ** 255 - 1, {'from': lender})
    wrapper.mint(100e8, lender.address, {"from": lender})
    assert 95e18 < wrapper.totalAssets() and wrapper.totalAssets() < 100e18
    assert 100e8 < wrapper.convertToShares(100e18) and wrapper.convertToShares(100e18) < 105e8
    assert 95e18 < wrapper.convertToAssets(100e8) and wrapper.convertToAssets(100e8) < 100e18