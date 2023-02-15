import brownie
import pytest
from brownie import Contract, NoteERC20
from brownie.convert.datatypes import HexString
from brownie.network import web3
from brownie.network.state import Chain
from scripts.config import GovernanceConfig
from scripts.deployment import TestEnvironment, deployNoteERC20

chain = Chain()


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    env = TestEnvironment(accounts[0], withGovernance=True, multisig=accounts[1])
    return env


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def execute_proposal(environment, targets, values, calldatas):
    txn = environment.governor.propose(targets, values, calldatas, {"from": environment.multisig})
    proposalId = txn.events["ProposalCreated"]["id"]
    chain.mine(1)
    environment.governor.castVote(proposalId, True, {"from": environment.multisig})
    chain.mine(GovernanceConfig["governorConfig"]["votingPeriodBlocks"])

    assert environment.governor.state(proposalId) == 4  # success
    delay = environment.governor.getMinDelay()
    environment.governor.queueProposal(proposalId, targets, values, calldatas)
    chain.mine(1, timestamp=chain.time() + delay)
    txn = environment.governor.executeProposal(proposalId, targets, values, calldatas)
    return txn


def test_note_token_initial_balances(environment, accounts):
    assert environment.noteERC20.balanceOf(environment.deployer.address) == 0
    assert (
        environment.noteERC20.balanceOf(environment.governor.address)
        == GovernanceConfig["initialBalances"]["DAO"]
    )
    assert (
        environment.noteERC20.balanceOf(environment.multisig.address)
        == GovernanceConfig["initialBalances"]["MULTISIG"]
    )

    assert (
        environment.noteERC20.balanceOf(environment.notional.address)
        == GovernanceConfig["initialBalances"]["NOTIONAL"]
    )

    assert (
        GovernanceConfig["initialBalances"]["DAO"]
        + GovernanceConfig["initialBalances"]["MULTISIG"]
        + GovernanceConfig["initialBalances"]["NOTIONAL"]
        == environment.noteERC20.totalSupply()
    )


def test_note_token_cannot_reinitialize(environment, accounts):
    with brownie.reverts():
        environment.noteERC20.initialize(
            [accounts[2].address],
            [100_000_000e8],
            accounts[2].address,
            {"from": environment.deployer},
        )


def test_note_token_cannot_initialize_duplicates(environment, accounts):
    erc20 = NoteERC20.deploy({"from": accounts[0]})
    with brownie.reverts("Duplicate account"):
        erc20.initialize(
            [accounts[2].address, accounts[2].address],
            [50_000_000e8, 50_000_000e8],
            environment.governor.address,
            {"from": environment.deployer},
        )


def test_governor_must_update_parameters_via_governance(environment, accounts):
    with brownie.reverts():
        environment.governor.updateQuorumVotes(0, {"from": environment.deployer})

    with brownie.reverts():
        environment.governor.updateProposalThreshold(0, {"from": environment.deployer})

    with brownie.reverts():
        environment.governor.updateVotingDelayBlocks(0, {"from": environment.deployer})

    with brownie.reverts():
        environment.governor.updateVotingPeriodBlocks(0, {"from": environment.deployer})

    with brownie.reverts():
        environment.governor.updateDelay(0, {"from": environment.deployer})


def test_update_governance_parameters(environment, accounts):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})

    targets = [environment.governor.address] * 5
    values = [0] * 5
    calldatas = [
        web3.eth.contract(abi=environment.governor.abi).encodeABI(
            fn_name="updateQuorumVotes", args=[0]
        ),
        web3.eth.contract(abi=environment.governor.abi).encodeABI(
            fn_name="updateProposalThreshold", args=[0]
        ),
        web3.eth.contract(abi=environment.governor.abi).encodeABI(
            fn_name="updateVotingDelayBlocks", args=[0]
        ),
        web3.eth.contract(abi=environment.governor.abi).encodeABI(
            fn_name="updateVotingPeriodBlocks", args=[6700]
        ),
        web3.eth.contract(abi=environment.governor.abi).encodeABI(fn_name="updateDelay", args=[0]),
    ]

    txn = execute_proposal(environment, targets, values, calldatas)

    assert txn.events["UpdateQuorumVotes"]["newQuorumVotes"] == 0
    assert txn.events["UpdateProposalThreshold"]["newProposalThreshold"] == 0
    assert txn.events["UpdateVotingDelayBlocks"]["newVotingDelayBlocks"] == 0
    assert txn.events["UpdateVotingPeriodBlocks"]["newVotingPeriodBlocks"] == 6700

    assert environment.governor.quorumVotes() == 0
    assert environment.governor.proposalThreshold() == 0
    assert environment.governor.votingDelayBlocks() == 0
    assert environment.governor.votingPeriodBlocks() == 6700
    assert environment.governor.getMinDelay() == 0


def test_note_token_transfer_to_reservoir_and_drip(environment, accounts, Reservoir):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})

    reservoir = Reservoir.deploy(
        1e8,
        environment.noteERC20.address,
        environment.proxy.address,
        {"from": environment.deployer},
    )

    transferToReservoir = web3.eth.contract(abi=environment.noteERC20.abi).encodeABI(
        fn_name="transfer", args=[reservoir.address, int(1_000_000e8)]
    )

    targets = [environment.noteERC20.address]
    values = [0]
    calldatas = [transferToReservoir]

    execute_proposal(environment, targets, values, calldatas)

    assert environment.noteERC20.balanceOf(reservoir.address) == 1_000_000e8

    proxyBalanceBefore = environment.noteERC20.balanceOf(environment.proxy.address)
    txn1 = reservoir.drip()
    proxyBalanceAfter = environment.noteERC20.balanceOf(environment.proxy.address)
    assert proxyBalanceAfter - proxyBalanceBefore == (txn1.timestamp - reservoir.DRIP_START()) * 1e8

    txn2 = reservoir.drip()
    proxyBalanceAfterSecondDrip = environment.noteERC20.balanceOf(environment.proxy.address)
    assert (
        proxyBalanceAfterSecondDrip - proxyBalanceAfter == (txn2.timestamp - txn1.timestamp) * 1e8
    )


def test_reservoir_does_not_receive_eth(environment, accounts, Reservoir):
    reservoir = Reservoir.deploy(
        1e8,
        environment.noteERC20.address,
        environment.proxy.address,
        {"from": environment.deployer},
    )

    with brownie.reverts():
        accounts[0].transfer(reservoir.address, 1e8)


def test_cancel_proposal_non_pending(environment, accounts):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})

    transferTokens = web3.eth.contract(abi=environment.noteERC20.abi).encodeABI(
        fn_name="transfer", args=[accounts[3].address, int(1_000_000e8)]
    )

    targets = [environment.noteERC20.address]
    values = [0]
    calldatas = [transferTokens]

    environment.governor.propose(targets, values, calldatas, {"from": environment.multisig})
    environment.governor.cancelProposal(1, {"from": environment.multisig})
    assert environment.governor.state(1) == 2  # canceled
    assert not environment.governor.isOperation(environment.governor.proposals(1)[-1])

    delay = environment.governor.getMinDelay()
    chain.mine(1, timestamp=chain.time() + delay)

    with brownie.reverts():
        # This cannot occur, proposal cancelled
        environment.governor.executeProposal(1, targets, values, calldatas)


def test_cancel_proposal_pending(environment, accounts):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})

    transferTokens = web3.eth.contract(abi=environment.noteERC20.abi).encodeABI(
        fn_name="transfer", args=[accounts[3].address, int(1_000_000e8)]
    )

    targets = [environment.noteERC20.address]
    values = [0]
    calldatas = [transferTokens]

    environment.governor.propose(targets, values, calldatas, {"from": environment.multisig})
    chain.mine(1)
    environment.governor.castVote(1, True, {"from": environment.multisig})
    chain.mine(GovernanceConfig["governorConfig"]["votingPeriodBlocks"])

    assert environment.governor.state(1) == 4  # success
    environment.governor.queueProposal(1, targets, values, calldatas)
    assert environment.governor.state(1) == 5  # queued
    assert environment.governor.isOperation(environment.governor.proposals(1)[-1])

    environment.governor.cancelProposal(1, {"from": environment.multisig})
    assert environment.governor.state(1) == 2  # canceled
    assert not environment.governor.isOperation(environment.governor.proposals(1)[-1])

    delay = environment.governor.getMinDelay()
    chain.mine(1, timestamp=chain.time() + delay * 2)

    with brownie.reverts():
        # This cannot occur, proposal cancelled
        environment.governor.executeProposal(1, targets, values, calldatas)


def test_abdicate_and_transfer_guardian(environment, accounts):
    with brownie.reverts():
        environment.governor.__abdicate({"from": accounts[2]})

    with brownie.reverts():
        environment.governor.__transferGuardian(accounts[2].address, {"from": accounts[2]})

    with brownie.reverts():
        environment.governor.__transferGuardian(
            brownie.convert.datatypes.HexString(0, "bytes20"), {"from": accounts[1]}
        )

    environment.governor.__transferGuardian(accounts[2].address, {"from": accounts[1]})
    environment.governor.__abdicate({"from": accounts[2]})

    with brownie.reverts():
        # Second abdicate fails, no guardian set
        environment.governor.__abdicate({"from": accounts[2]})


def test_note_token_reservoir_fails_on_zero(environment, accounts, Reservoir):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})
    reservoir = Reservoir.deploy(
        10e8,
        environment.noteERC20.address,
        environment.proxy.address,
        {"from": environment.deployer},
    )

    transferToReservoir = web3.eth.contract(abi=environment.noteERC20.abi).encodeABI(
        fn_name="transfer", args=[reservoir.address, int(1e8)]
    )

    targets = [environment.noteERC20.address]
    values = [0]
    calldatas = [transferToReservoir]

    execute_proposal(environment, targets, values, calldatas)

    assert environment.noteERC20.balanceOf(reservoir.address) == 1e8
    reservoir.drip()

    with brownie.reverts("Reservoir empty"):
        reservoir.drip()


def test_non_owners_cannot_upgrade_contracts(environment, accounts):
    zeroAddress = HexString(0, "bytes20")
    with brownie.reverts("Unauthorized upgrade"):
        environment.notional.upgradeTo(zeroAddress, {"from": accounts[0]})
        environment.notional.upgradeToAndCall(zeroAddress, {"from": accounts[0]})

        environment.noteERC20.upgradeTo(zeroAddress, {"from": accounts[0]})
        environment.noteERC20.upgradeToAndCall(zeroAddress, {"from": accounts[0]})


def test_cannot_change_notional_proxy(environment, accounts, NoteERC20):
    with brownie.reverts():
        environment.noteERC20.activateNotional(accounts[1], {"from": accounts[1]})


def test_upgrade_note_token(environment, accounts, NoteERC20):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})
    newToken = NoteERC20.deploy({"from": environment.deployer})
    upgradeToken = web3.eth.contract(abi=environment.noteERC20.abi).encodeABI(
        fn_name="upgradeTo", args=[newToken.address]
    )
    targets = [environment.noteERC20.address]
    values = [0]
    calldatas = [upgradeToken]

    prevImplementation = environment.noteERC20Proxy.getImplementation()
    execute_proposal(environment, targets, values, calldatas)

    assert environment.noteERC20Proxy.getImplementation() == newToken.address
    assert environment.noteERC20Proxy.getImplementation() != prevImplementation


def test_upgrade_router_contract(environment, accounts, Router):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})
    zeroAddress = HexString(0, "bytes20")
    newRouter = Router.deploy(
        environment.router.GOVERNANCE(),
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        {"from": environment.deployer},
    )

    upgradeRouter = web3.eth.contract(abi=environment.notional.abi).encodeABI(
        fn_name="upgradeTo", args=[newRouter.address]
    )

    targets = [environment.notional.address]
    values = [0]
    calldatas = [upgradeRouter]

    prevImplementation = environment.notional.getImplementation()
    execute_proposal(environment, targets, values, calldatas)
    assert environment.notional.getImplementation() == newRouter.address
    assert environment.notional.getImplementation() != prevImplementation


def test_upgrade_governance_contract(environment, accounts, GovernorAlpha):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})
    newGovernor = GovernorAlpha.deploy(
        GovernanceConfig["governorConfig"]["quorumVotes"],
        GovernanceConfig["governorConfig"]["proposalThreshold"],
        GovernanceConfig["governorConfig"]["votingDelayBlocks"],
        GovernanceConfig["governorConfig"]["votingPeriodBlocks"],
        environment.noteERC20.address,
        environment.multisig,
        GovernanceConfig["governorConfig"]["minDelay"],
        {"from": environment.deployer},
    )

    transferOwner = web3.eth.contract(abi=environment.proxyAdmin.abi).encodeABI(
        fn_name="transferOwnership", args=[newGovernor.address]
    )

    targets = [environment.proxyAdmin.address]
    values = [0]
    calldatas = [transferOwner]

    assert environment.proxyAdmin.owner() == environment.governor.address
    execute_proposal(environment, targets, values, calldatas)
    assert environment.proxyAdmin.owner() == newGovernor.address


def test_delegation(environment, accounts):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})
    environment.noteERC20.delegate(accounts[4], {"from": accounts[4]})
    multisigVotes = environment.noteERC20.getCurrentVotes(environment.multisig)

    environment.noteERC20.transfer(accounts[4], 100e8, {"from": environment.multisig})
    assert environment.noteERC20.getCurrentVotes(environment.multisig) == multisigVotes - 100e8
    assert environment.noteERC20.getCurrentVotes(accounts[4]) == 100e8


def test_pause_and_restart_router(environment, accounts):
    environment.noteERC20.delegate(environment.multisig, {"from": environment.multisig})
    zeroAddress = HexString(0, "bytes20")
    with brownie.reverts("Unauthorized upgrade"):
        # Cannot upgrade to arbitrary implementation
        environment.notional.upgradeTo(zeroAddress, {"from": accounts[8]})

    # Can downgrade to paused router
    environment.notional.upgradeTo(environment.pauseRouter.address, {"from": accounts[8]})

    with brownie.reverts():
        # Ensure that methods are not callable
        environment.notional.settleAccount(accounts[0])

    with brownie.reverts():
        # Still cannot upgrade to arbitrary implementation
        environment.notional.upgradeTo(environment.router.address, {"from": accounts[8]})

    # Can call a view method
    environment.notional.getAccountPortfolio(accounts[0])

    # Can upgrade back to previous router via governance
    upgradeRouter = web3.eth.contract(abi=environment.notional.abi).encodeABI(
        fn_name="upgradeTo", args=[environment.router.address]
    )

    targets = [environment.notional.address]
    values = [0]
    calldatas = [upgradeRouter]

    execute_proposal(environment, targets, values, calldatas)
    assert environment.notional.getImplementation() == environment.router.address

    # Assert that methods are now callable
    environment.notional.settleAccount(accounts[0])


@pytest.mark.only
def test_pause_router_and_enable_liquidations(environment, accounts, PauseRouter):
    # Downgrade to pause router
    environment.notional.upgradeTo(environment.pauseRouter.address, {"from": accounts[8]})

    with brownie.reverts("Method not found"):
        # Ensure that liquidation methods are not callable
        environment.notional.calculateLocalCurrencyLiquidation(accounts[0], 1, 0)
        environment.notional.liquidateLocalCurrency(accounts[0], 1, 0)

        environment.notional.calculateCollateralCurrencyLiquidation(accounts[0], 1, 2, 0, 0)
        environment.notional.liquidateCollateralCurrency(accounts[0], 1, 2, 0, 0, True, True)

        environment.notional.calculatefCashLocalLiquidation(accounts[0], 1, [100], [0])
        environment.notional.fCashLocalLiquidation(accounts[0], 1, [100], [0])

        environment.notional.calculatefCashCrossCurrencyLiquidation(accounts[0], 1, 2, [100], [0])
        environment.notional.liquidatefCashCrossCurrency(accounts[0], 1, 2, [100], [0])

    pr = Contract.from_abi(
        "PauseRouter", environment.notional.address, abi=PauseRouter.abi, owner=accounts[8]
    )
    pr.setLiquidationEnabledState("0x01")

    with brownie.reverts(""):
        environment.notional.calculateLocalCurrencyLiquidation(accounts[0], 1, 0)
        environment.notional.liquidateLocalCurrency(accounts[0], 1, 0)

    with brownie.reverts("Method not found"):
        # Ensure that liquidation methods are not callable
        environment.notional.calculateCollateralCurrencyLiquidation(accounts[0], 1, 2, 0, 0)
        environment.notional.liquidateCollateralCurrency(accounts[0], 1, 2, 0, 0, True, True)

        environment.notional.calculatefCashLocalLiquidation(accounts[0], 1, [100], [0])
        environment.notional.fCashLocalLiquidation(accounts[0], 1, [100], [0])

        environment.notional.calculatefCashCrossCurrencyLiquidation(accounts[0], 1, 2, [100], [0])
        environment.notional.liquidatefCashCrossCurrency(accounts[0], 1, 2, [100], [0])

    pr.setLiquidationEnabledState("0x03")

    with brownie.reverts(""):
        environment.notional.calculateLocalCurrencyLiquidation(accounts[0], 1, 0)
        environment.notional.liquidateLocalCurrency(accounts[0], 1, 0)

        environment.notional.calculateCollateralCurrencyLiquidation(accounts[0], 1, 2, 0, 0)
        environment.notional.liquidateCollateralCurrency(accounts[0], 1, 2, 0, 0, True, True)

    with brownie.reverts("Method not found"):
        environment.notional.calculatefCashLocalLiquidation(accounts[0], 1, [100], [0])
        environment.notional.fCashLocalLiquidation(accounts[0], 1, [100], [0])

        environment.notional.calculatefCashCrossCurrencyLiquidation(accounts[0], 1, 2, [100], [0])
        environment.notional.liquidatefCashCrossCurrency(accounts[0], 1, 2, [100], [0])


def test_can_delegate_if_notional_not_active(accounts):
    (_, noteERC20) = deployNoteERC20(accounts[0])
    noteERC20.initialize(
        [accounts[2].address], [100_000_000e8], accounts[2].address, {"from": accounts[0]}
    )

    noteERC20.delegate(accounts[4], {"from": accounts[2]})
    noteERC20.delegate(accounts[4], {"from": accounts[4]})
    assert noteERC20.notionalProxy() == "0x0000000000000000000000000000000000000000"
    assert noteERC20.getCurrentVotes(accounts[4]) == 100_000_000e8
