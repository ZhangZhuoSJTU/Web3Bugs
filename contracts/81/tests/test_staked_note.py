import pytest
import brownie
import eth_abi
from brownie import accounts, sNOTE
from brownie.convert.datatypes import Wei
from brownie.network.state import Chain
from scripts.environment import TestAccounts, Environment, create_environment, ETH_ADDRESS

chain = Chain()
@pytest.fixture(autouse=True)
def run_around_tests():
    chain.snapshot()
    yield
    chain.revert()

def test_name_and_symbol():
    env = create_environment()
    assert env.sNOTE.name() == "Staked NOTE"
    assert env.sNOTE.symbol() == "sNOTE"

# Governance methods
def test_upgrade_snote():
    env = create_environment()
    testAccounts = TestAccounts()

    sNOTEImpl = sNOTE.deploy(
        env.balancerVault.address,
        env.poolId,
        env.note.address,
        env.weth.address,
        {"from": env.deployer}
    )

    with brownie.reverts("Ownable: caller is not the owner"):
        env.sNOTE.upgradeTo(sNOTEImpl.address, {"from": testAccounts.ETHWhale})

    env.sNOTE.upgradeTo(sNOTEImpl.address, {"from": env.deployer})
    
def test_set_cooldown_time():
    env = create_environment()
    testAccounts = TestAccounts()

    with brownie.reverts("Ownable: caller is not the owner"):
        env.sNOTE.setCoolDownTime(200, {"from": testAccounts.ETHWhale})

    env.sNOTE.setCoolDownTime(200, {"from": env.deployer})
    assert env.sNOTE.coolDownTimeInSeconds() == 200

def test_extract_tokens_for_shortfall():
    env = create_environment()
    testAccounts = TestAccounts()

    with brownie.reverts("Ownable: caller is not the owner"):
        env.sNOTE.extractTokensForCollateralShortfall(1, {"from": testAccounts.ETHWhale})

    noteBefore = env.note.balanceOf(env.deployer)
    bptBefore = env.balancerPool.balanceOf(env.sNOTE.address)
    env.sNOTE.extractTokensForCollateralShortfall(bptBefore * 0.3, {"from": env.deployer})
    bptAfter = env.balancerPool.balanceOf(env.sNOTE.address)
    noteAfter = env.note.balanceOf(env.deployer)

    assert pytest.approx(bptAfter / bptBefore) == 0.70

    assert env.balancerPool.balanceOf(env.deployer) == 0
    assert pytest.approx(env.weth.balanceOf(env.deployer)) == 6e18
    assert pytest.approx(noteAfter - noteBefore, abs=1) == 30e8

def test_extract_tokens_for_shortfall_cap():
    env = create_environment()
    testAccounts = TestAccounts()

    bptBefore = env.balancerPool.balanceOf(env.sNOTE.address)
    env.sNOTE.extractTokensForCollateralShortfall(bptBefore, {"from": env.deployer})
    bptAfter = env.balancerPool.balanceOf(env.sNOTE.address)
    assert pytest.approx(bptAfter / bptBefore, rel=1e-9) == 0.7

def test_set_swap_fee_percentage():
    env = create_environment()
    testAccounts = TestAccounts()

    with brownie.reverts("Ownable: caller is not the owner"):
        env.sNOTE.setSwapFeePercentage(0.03e18, {"from": testAccounts.ETHWhale})

    env.sNOTE.setSwapFeePercentage(0.03e18, {"from": env.deployer})
    assert env.balancerPool.getSwapFeePercentage() == 0.03e18

# User methods
def test_mint_from_bpt():
    env = create_environment()
    testAccounts = TestAccounts()
    env.note.transfer(testAccounts.ETHWhale, 100e8, {"from": env.deployer})
    env.note.approve(env.balancerVault.address, 2**256-1, {"from": testAccounts.ETHWhale})

    # [EXACT_TOKENS_IN_FOR_BPT_OUT, [ETH, NOTE], minBPTOut]
    userData = eth_abi.encode_abi(
        ['uint256', 'uint256[]', 'uint256'],
        [1, [0, Wei(1e8)], 0]
    )

    env.balancerVault.joinPool(
        env.poolId,
        testAccounts.ETHWhale,
        testAccounts.ETHWhale,
        (
            [ETH_ADDRESS, env.note.address],
            [0, 1e8],
            userData,
            False
        ),
        { "from": testAccounts.ETHWhale }
    )

    bptBalance = env.balancerPool.balanceOf(testAccounts.ETHWhale)
    env.balancerPool.approve(env.sNOTE.address, 2**255-1, {"from": testAccounts.ETHWhale})
    env.sNOTE.mintFromBPT(bptBalance, {"from": testAccounts.ETHWhale})

    assert env.balancerPool.balanceOf(testAccounts.ETHWhale) == 0
    assert env.sNOTE.balanceOf(testAccounts.ETHWhale) == bptBalance

def test_mint_from_note():
    env = create_environment()
    testAccounts = TestAccounts()
    env.note.transfer(testAccounts.ETHWhale, 100e8, {"from": env.deployer})
    env.note.approve(env.sNOTE.address, 2**256-1, {"from": testAccounts.ETHWhale})
 
    env.sNOTE.mintFromNOTE(1e8, {"from": testAccounts.ETHWhale})
    # This should be the same as adding 1e8 NOTE above
    assert env.sNOTE.balanceOf(testAccounts.ETHWhale) == 1157335084531851455

def test_pool_share_ratio():
    env = create_environment()
    testAccounts = TestAccounts()
    env.note.transfer(testAccounts.ETHWhale, 150e8, {"from": env.deployer})
    env.note.transfer(testAccounts.DAIWhale, 100e8, {"from": env.deployer})
    env.note.approve(env.sNOTE.address, 2**256-1, {"from": testAccounts.ETHWhale})
    env.note.approve(env.sNOTE.address, 2**256-1, {"from": testAccounts.DAIWhale})

    # [EXACT_TOKENS_IN_FOR_BPT_OUT, [ETH, NOTE], minBPTOut]
    env.note.approve(env.balancerVault.address, 2**256-1, {"from": testAccounts.ETHWhale})
    userData = eth_abi.encode_abi(
        ['uint256', 'uint256[]', 'uint256'],
        [1, [0, Wei(1e8)], 0]
    )

    env.balancerVault.joinPool(
        env.poolId,
        testAccounts.ETHWhale,
        testAccounts.ETHWhale,
        (
            [ETH_ADDRESS, env.note.address],
            [0, 50e8],
            userData,
            False
        ),
        { "from": testAccounts.ETHWhale }
    )

    assert env.sNOTE.totalSupply() == 0
    initialBPTBalance = env.balancerPool.balanceOf(env.sNOTE.address)

    txn1 = env.sNOTE.mintFromNOTE(100e8, {"from": testAccounts.ETHWhale})
    bptFrom1 = txn1.events['Transfer'][1]['value']
    bptAdded = env.balancerPool.balanceOf(testAccounts.ETHWhale) / 2

    env.balancerPool.transfer(env.sNOTE.address, bptAdded, {"from": testAccounts.ETHWhale})
    txn2 = env.sNOTE.mintFromNOTE(100e8, {"from": testAccounts.DAIWhale})
    bptFrom2 = txn2.events['Transfer'][1]['value']

    # Test that the pool share of the second minter does not accrue balances of those from the first
    poolTokenShare1 = env.sNOTE.poolTokenShareOf(testAccounts.ETHWhale)
    poolTokenShare2 = env.sNOTE.poolTokenShareOf(testAccounts.DAIWhale)

    assert pytest.approx(poolTokenShare1, abs=1) == bptFrom1 + bptAdded + initialBPTBalance
    assert pytest.approx(poolTokenShare2, abs=1) == bptFrom2

    bptAdded2 = env.balancerPool.balanceOf(testAccounts.ETHWhale)

    # Test that additional tokens are split between the two holders proportionally
    env.balancerPool.transfer(env.sNOTE.address, bptAdded2, {"from": testAccounts.ETHWhale})
    sNOTEBalance1 = env.sNOTE.balanceOf(testAccounts.ETHWhale)
    sNOTEBalance2 = env.sNOTE.balanceOf(testAccounts.DAIWhale)
    totalSupply = env.sNOTE.totalSupply()
    poolTokenShare3 = env.sNOTE.poolTokenShareOf(testAccounts.ETHWhale)
    poolTokenShare4 = env.sNOTE.poolTokenShareOf(testAccounts.DAIWhale)
    assert pytest.approx(poolTokenShare3, abs=1000) == bptFrom1 + bptAdded + initialBPTBalance + (bptAdded2 * sNOTEBalance1 / totalSupply)
    assert pytest.approx(poolTokenShare4, abs=1000) == bptFrom2 + (bptAdded2 * sNOTEBalance2 / totalSupply)

def test_mint_from_eth():
    env = create_environment()
    testAccounts = TestAccounts()
    env.sNOTE.mintFromETH({"from": testAccounts.ETHWhale, "value": 1e18})
    assert env.sNOTE.balanceOf(testAccounts.ETHWhale) > 0

def test_mint_from_weth():
    env = create_environment()
    testAccounts = TestAccounts()
    env.weth.approve(env.sNOTE.address, 2**255 - 1, {"from": testAccounts.WETHWhale})
    env.sNOTE.mintFromWETH(1e18, {"from": testAccounts.WETHWhale})
    assert env.sNOTE.balanceOf(testAccounts.WETHWhale) > 0

def test_redeem():
    env = create_environment()
    testAccounts = TestAccounts()
    env.note.transfer(testAccounts.ETHWhale, 1e8, {"from": env.deployer})
    env.note.approve(env.sNOTE.address, 2**256-1, {"from": testAccounts.ETHWhale})

    env.sNOTE.mintFromNOTE(1e8, {"from": testAccounts.ETHWhale})

    # Cannot redeem without cooldown
    with brownie.reverts("Not in Redemption Window"):
        env.sNOTE.redeem(env.sNOTE.balanceOf(testAccounts.ETHWhale), {"from": testAccounts.ETHWhale})

    env.sNOTE.startCoolDown({"from": testAccounts.ETHWhale})
    chain.mine(timestamp=(chain.time() + 5))

    # Cannot redeem before window begins
    with brownie.reverts("Not in Redemption Window"):
        env.sNOTE.redeem(env.sNOTE.balanceOf(testAccounts.ETHWhale), {"from": testAccounts.ETHWhale})

    chain.mine(timestamp=(chain.time() + 100))
    # Successful redeem after window begins
    env.sNOTE.redeem(env.sNOTE.balanceOf(testAccounts.ETHWhale) / 2, {"from": testAccounts.ETHWhale})

    # Successful redeem again within window
    env.sNOTE.redeem(env.sNOTE.balanceOf(testAccounts.ETHWhale) / 2, {"from": testAccounts.ETHWhale})

    # Leave redemption window
    chain.mine(timestamp=(chain.time() + 86400 * 3))

    # Once a redemption occurs the cool down is reset
    with brownie.reverts("Not in Redemption Window"):
        env.sNOTE.redeem(env.sNOTE.balanceOf(testAccounts.ETHWhale), {"from": testAccounts.ETHWhale})

def test_transfer():
    env = create_environment()
    testAccounts = TestAccounts()
    env.note.transfer(testAccounts.ETHWhale, 1e8, {"from": env.deployer})
    env.note.approve(env.sNOTE.address, 2**256-1, {"from": testAccounts.ETHWhale})

    env.sNOTE.mintFromNOTE(1e8, {"from": testAccounts.ETHWhale})
    env.sNOTE.transfer(env.deployer, 1e8, {"from": testAccounts.ETHWhale})
    assert env.sNOTE.balanceOf(env.deployer) == 1e8

def test_no_transfer_during_cooldown():
    env = create_environment()
    testAccounts = TestAccounts()
    env.note.transfer(testAccounts.ETHWhale, 1e8, {"from": env.deployer})
    env.note.approve(env.sNOTE.address, 2**256-1, {"from": testAccounts.ETHWhale})

    env.sNOTE.mintFromNOTE(1e8, {"from": testAccounts.ETHWhale})
    env.sNOTE.startCoolDown({"from": testAccounts.ETHWhale})

    with brownie.reverts("Account in Cool Down"):
        env.sNOTE.transfer(env.deployer, 1e8, {"from": testAccounts.ETHWhale})

    # Transfer works after cooldown is stopped
    env.sNOTE.stopCoolDown({"from": testAccounts.ETHWhale})
    env.sNOTE.transfer(env.deployer, 1e8, {"from": testAccounts.ETHWhale})
    assert env.sNOTE.balanceOf(env.deployer) == 1e8

def test_transfer_with_delegates():
    env = create_environment()
    testAccounts = TestAccounts()
    env.note.transfer(testAccounts.ETHWhale, 1e8, {"from": env.deployer})
    env.note.approve(env.sNOTE.address, 2**256-1, {"from": testAccounts.ETHWhale})

    env.sNOTE.mintFromNOTE(1e8, {"from": testAccounts.ETHWhale})
    env.sNOTE.delegate(testAccounts.ETHWhale, {"from": testAccounts.ETHWhale})
    env.sNOTE.delegate(env.deployer, {"from": env.deployer})
    assert env.sNOTE.getVotes(testAccounts.ETHWhale) == env.sNOTE.balanceOf(testAccounts.ETHWhale)
    assert env.sNOTE.getVotes(env.deployer) == 0

    env.sNOTE.transfer(env.deployer, 1e8, {"from": testAccounts.ETHWhale})

    assert env.sNOTE.getVotes(testAccounts.ETHWhale) == env.sNOTE.balanceOf(testAccounts.ETHWhale)
    assert env.sNOTE.getVotes(env.deployer) == 1e8

def test_get_voting_power_single_staker_price_increasing():
    env = create_environment()
    testAccounts = TestAccounts()
    env.weth.approve(env.balancerVault.address, 2 ** 255, {"from": testAccounts.WETHWhale})
    env.note.approve(env.sNOTEProxy.address, 2 ** 255, {"from": testAccounts.WETHWhale})
    env.note.approve(env.balancerVault.address, 2 ** 255, {"from": testAccounts.WETHWhale})
    
    env.buyNOTE(1e8, testAccounts.WETHWhale)
    env.sNOTE.mintFromNOTE(env.note.balanceOf(testAccounts.WETHWhale), {"from": testAccounts.WETHWhale})
    assert env.sNOTE.balanceOf(testAccounts.WETHWhale) == env.sNOTE.totalSupply()
    noteBalance = env.balancerVault.getPoolTokens(env.poolId)[1][1]
    votingPower = env.sNOTE.getVotingPower(env.sNOTE.totalSupply())
    assert votingPower < noteBalance and votingPower == 9980502186

    env.buyNOTE(5e8, testAccounts.WETHWhale)
    env.sNOTE.mintFromNOTE(env.note.balanceOf(testAccounts.WETHWhale), {"from": testAccounts.WETHWhale})
    assert env.sNOTE.balanceOf(testAccounts.WETHWhale) == env.sNOTE.totalSupply()
    noteBalance = env.balancerVault.getPoolTokens(env.poolId)[1][1]
    votingPower = env.sNOTE.getVotingPower(env.sNOTE.totalSupply())
    assert votingPower < noteBalance and votingPower == 9896963994

def test_get_voting_power_single_staker_price_decreasing_fast():
    env = create_environment()
    testAccounts = TestAccounts()
    env.weth.transfer(testAccounts.NOTEWhale.address, 100e18, {"from": testAccounts.WETHWhale})
    env.note.approve(env.balancerVault.address, 2 ** 255, {"from": testAccounts.NOTEWhale})
    env.note.approve(env.sNOTEProxy.address, 2 ** 255, {"from": testAccounts.NOTEWhale})
    env.note.approve(env.balancerVault.address, 2 ** 255, {"from": testAccounts.WETHWhale})

    env.sNOTE.mintFromNOTE(10e8, {"from": testAccounts.NOTEWhale})
    assert env.sNOTE.balanceOf(testAccounts.NOTEWhale) == env.sNOTE.totalSupply()

    env.sellNOTE(5e8, testAccounts.NOTEWhale)

    noteBalance = env.balancerVault.getPoolTokens(env.poolId)[1][1]
    votingPower = env.sNOTE.getVotingPower(env.sNOTE.totalSupply())
    assert votingPower < noteBalance and votingPower == 11000894118

def test_get_voting_power_single_staker_price_decreasing_slow():
    env = create_environment()
    testAccounts = TestAccounts()
    env.weth.transfer(testAccounts.NOTEWhale.address, 100e18, {"from": testAccounts.WETHWhale})
    env.note.approve(env.balancerVault.address, 2 ** 255, {"from": testAccounts.NOTEWhale})
    env.note.approve(env.sNOTEProxy.address, 2 ** 255, {"from": testAccounts.NOTEWhale})
    env.note.approve(env.balancerVault.address, 2 ** 255, {"from": testAccounts.WETHWhale})

    env.sNOTE.mintFromNOTE(10e8, {"from": testAccounts.NOTEWhale})
    assert env.sNOTE.balanceOf(testAccounts.NOTEWhale) == env.sNOTE.totalSupply()

    env.sellNOTE(1e8, testAccounts.NOTEWhale)
    env.sellNOTE(1e8, testAccounts.NOTEWhale)
    env.sellNOTE(1e8, testAccounts.NOTEWhale)
    env.sellNOTE(1e8, testAccounts.NOTEWhale)
    env.sellNOTE(1e8, testAccounts.NOTEWhale)

    noteBalance = env.balancerVault.getPoolTokens(env.poolId)[1][1]
    votingPower = env.sNOTE.getVotingPower(env.sNOTE.totalSupply())
    assert votingPower < noteBalance and votingPower == 11399580460


