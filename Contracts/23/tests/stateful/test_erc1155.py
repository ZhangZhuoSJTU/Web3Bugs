import brownie
import pytest
from brownie.convert import to_bytes
from brownie.convert.datatypes import Wei
from brownie.network import web3
from brownie.network.state import Chain
from tests.constants import RATE_PRECISION, SECONDS_IN_DAY
from tests.helpers import get_balance_action, get_balance_trade_action, initialize_environment
from tests.stateful.invariants import check_system_invariants

chain = Chain()


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    env = initialize_environment(accounts)
    env.notional.enableBitmapCurrency(2, {"from": accounts[2]})

    return env


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def test_transfer_authentication_failures(environment, accounts):
    addressZero = to_bytes(0, "bytes20")
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1], 1)

    with brownie.reverts("Invalid address"):
        environment.notional.safeTransferFrom(accounts[0], addressZero, erc1155id, 100e8, "")
        environment.notional.safeBatchTransferFrom(
            accounts[0], addressZero, [erc1155id], [100e8], ""
        )

    with brownie.reverts("Invalid address"):
        environment.notional.safeTransferFrom(accounts[0], accounts[0], erc1155id, 100e8, "")
        environment.notional.safeBatchTransferFrom(
            accounts[0], accounts[0], [erc1155id], [100e8], ""
        )

    with brownie.reverts("Unauthorized"):
        environment.notional.safeTransferFrom(addressZero, accounts[1], erc1155id, 100e8, "")
        environment.notional.safeBatchTransferFrom(
            addressZero, accounts[1], [erc1155id], [100e8], ""
        )

    with brownie.reverts("Unauthorized"):
        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, "", {"from": accounts[0]}
        )
        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], "", {"from": accounts[0]}
        )

    with brownie.reverts("Invalid maturity"):
        # Does not fall on a valid utc0 date
        erc1155id = environment.notional.encodeToId(2, markets[0][1] + 10, 1)

        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, "", {"from": accounts[1]}
        )
        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], "", {"from": accounts[1]}
        )


def test_transfer_invalid_maturity(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)

    with brownie.reverts("Invalid maturity"):
        # Does not fall on a valid utc0 date
        erc1155id = environment.notional.encodeToId(2, markets[0][1] + 10, 1)

        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, "", {"from": accounts[1]}
        )
        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], "", {"from": accounts[1]}
        )

    with brownie.reverts("Invalid maturity"):
        # Is past max market date
        erc1155id = environment.notional.encodeToId(2, markets[-1][1] + SECONDS_IN_DAY, 1)

        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, "", {"from": accounts[1]}
        )
        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], "", {"from": accounts[1]}
        )

    with brownie.reverts("Invalid maturity"):
        # Is in the past
        blockTime = chain.time()
        blockTime = blockTime - blockTime % SECONDS_IN_DAY - SECONDS_IN_DAY
        erc1155id = environment.notional.encodeToId(2, blockTime, 1)

        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, "", {"from": accounts[1]}
        )
        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], "", {"from": accounts[1]}
        )


def test_calldata_encoding_failure(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1], 1)

    with brownie.reverts("Insufficient free collateral"):
        # This should fall through the sig check and fail
        data = web3.eth.contract(abi=environment.notional.abi).encodeABI(
            fn_name="transferOwnership", args=[accounts[0].address]
        )

        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, data, {"from": accounts[1]}
        )

        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], data, {"from": accounts[1]}
        )

    with brownie.reverts("Unauthorized call"):
        data = web3.eth.contract(abi=environment.notional.abi).encodeABI(
            fn_name="batchBalanceAction",
            args=[
                accounts[0].address,
                [get_balance_action(2, "DepositAsset", depositActionAmount=100e8)],
            ],
        )

        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, data, {"from": accounts[1]}
        )

        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], data, {"from": accounts[1]}
        )


def test_fail_on_non_acceptance(environment, accounts, MockTransferOperator):
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1], 1)
    transferOp = MockTransferOperator.deploy(environment.notional.address, {"from": accounts[0]})
    transferOp.setShouldReject(True)

    with brownie.reverts("Not accepted"):
        environment.notional.safeTransferFrom(
            accounts[1], transferOp.address, erc1155id, 100e8, bytes(), {"from": accounts[1]}
        )

        environment.notional.safeBatchTransferFrom(
            accounts[1], transferOp.address, [erc1155id], [100e8], bytes(), {"from": accounts[1]}
        )

    with brownie.reverts("Not accepted"):
        # nTokens will reject ERC1155 transfers
        environment.notional.safeTransferFrom(
            accounts[0], environment.nToken[1], erc1155id, 100e8, ""
        )
        environment.notional.safeBatchTransferFrom(
            accounts[0], environment.nToken[1], [erc1155id], [100e8], ""
        )


def test_set_account_approval(environment, accounts):
    assert not environment.notional.isApprovedForAll(accounts[0], accounts[1])
    environment.notional.setApprovalForAll(accounts[1], True, {"from": accounts[0]})
    assert environment.notional.isApprovedForAll(accounts[0], accounts[1])
    environment.notional.setApprovalForAll(accounts[1], False, {"from": accounts[0]})
    assert not environment.notional.isApprovedForAll(accounts[0], accounts[1])


def test_set_global_approval(environment, accounts, MockTransferOperator):
    transferOp = MockTransferOperator.deploy(environment.notional.address, {"from": accounts[0]})
    assert not environment.notional.isApprovedForAll(accounts[0], transferOp.address)

    txn = environment.notional.updateGlobalTransferOperator(
        transferOp.address, True, {"from": accounts[0]}
    )

    assert txn.events["UpdateGlobalTransferOperator"]["operator"] == transferOp.address
    assert txn.events["UpdateGlobalTransferOperator"]["approved"]
    assert environment.notional.isApprovedForAll(accounts[0], transferOp.address)

    txn = environment.notional.updateGlobalTransferOperator(
        transferOp.address, False, {"from": accounts[0]}
    )
    assert txn.events["UpdateGlobalTransferOperator"]["operator"] == transferOp.address
    assert not txn.events["UpdateGlobalTransferOperator"]["approved"]
    assert not environment.notional.isApprovedForAll(accounts[0], transferOp.address)


def test_transfer_has_fcash(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [{"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0}],
        depositActionAmount=5100e8,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    assets = environment.notional.getAccountPortfolio(accounts[1])
    erc1155id = environment.notional.encodeToId(assets[0][0], assets[0][1], assets[0][2])

    txn = environment.notional.safeTransferFrom(
        accounts[1], accounts[0], erc1155id, 10e8, bytes(), {"from": accounts[1]}
    )

    assert txn.events["TransferSingle"]["from"] == accounts[1]
    assert txn.events["TransferSingle"]["to"] == accounts[0]
    assert txn.events["TransferSingle"]["id"] == erc1155id
    assert txn.events["TransferSingle"]["value"] == 10e8

    toAssets = environment.notional.getAccountPortfolio(accounts[0])
    assert toAssets[0][0] == assets[0][0]
    assert toAssets[0][1] == assets[0][1]
    assert toAssets[0][2] == assets[0][2]
    assert toAssets[0][3] == 10e8

    # Tests transfer to bitmap account
    environment.notional.safeTransferFrom(
        accounts[1], accounts[2], erc1155id, 10e8, bytes(), {"from": accounts[1]}
    )
    toAssets = environment.notional.getAccountPortfolio(accounts[2])
    assert toAssets[0][0] == assets[0][0]
    assert toAssets[0][1] == assets[0][1]
    assert toAssets[0][2] == assets[0][2]
    assert toAssets[0][3] == 10e8

    check_system_invariants(environment, accounts)


def test_batch_transfer_has_fcash(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 100e8, "minSlippage": 0},
        ],
        depositActionAmount=12000e8,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    assets = environment.notional.getAccountPortfolio(accounts[1])
    erc1155ids = [
        environment.notional.encodeToId(assets[0][0], assets[0][1], assets[0][2]),
        environment.notional.encodeToId(assets[1][0], assets[1][1], assets[1][2]),
    ]
    txn = environment.notional.safeBatchTransferFrom(
        accounts[1], accounts[0], erc1155ids, [10e8, 10e8], bytes(), {"from": accounts[1]}
    )

    assert txn.events["TransferBatch"]["from"] == accounts[1]
    assert txn.events["TransferBatch"]["to"] == accounts[0]
    assert txn.events["TransferBatch"]["ids"] == erc1155ids
    assert txn.events["TransferBatch"]["values"] == [10e8, 10e8]

    toAssets = environment.notional.getAccountPortfolio(accounts[0])
    assert len(toAssets) == 2
    assert toAssets[0][0] == assets[0][0]
    assert toAssets[0][1] == assets[0][1]
    assert toAssets[0][2] == assets[0][2]
    assert toAssets[0][3] == 10e8

    assert toAssets[1][0] == assets[1][0]
    assert toAssets[1][1] == assets[1][1]
    assert toAssets[1][2] == assets[1][2]
    assert toAssets[1][3] == 10e8

    # Tests transfer to bitmap account
    environment.notional.safeBatchTransferFrom(
        accounts[1], accounts[2], erc1155ids, [10e8, 10e8], bytes(), {"from": accounts[1]}
    )
    toAssets = environment.notional.getAccountPortfolio(accounts[2])
    assert toAssets[0][0] == assets[0][0]
    assert toAssets[0][1] == assets[0][1]
    assert toAssets[0][2] == assets[0][2]
    assert toAssets[0][3] == 10e8

    assert toAssets[1][0] == assets[1][0]
    assert toAssets[1][1] == assets[1][1]
    assert toAssets[1][2] == assets[1][2]
    assert toAssets[1][3] == 10e8

    check_system_invariants(environment, accounts)


def test_transfer_has_fcash_failure(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [{"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0}],
        depositActionAmount=5100e8,
        withdrawEntireCashBalance=True,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    assets = environment.notional.getAccountPortfolio(accounts[1])
    erc1155id = environment.notional.encodeToId(assets[0][0], assets[0][1], assets[0][2])

    with brownie.reverts("Insufficient free collateral"):
        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 200e8, bytes(), {"from": accounts[1]}
        )


def test_transfer_has_liquidity_tokens(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            }
        ],
        depositActionAmount=100e8,
    )

    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    assets = environment.notional.getAccountPortfolio(accounts[1])
    erc1155id = environment.notional.encodeToId(assets[1][0], assets[1][1], assets[1][2])
    txn = environment.notional.safeTransferFrom(
        accounts[1], accounts[0], erc1155id, 10e8, bytes(), {"from": accounts[1]}
    )

    assert txn.events["TransferSingle"]["from"] == accounts[1]
    assert txn.events["TransferSingle"]["to"] == accounts[0]
    assert txn.events["TransferSingle"]["id"] == erc1155id
    assert txn.events["TransferSingle"]["value"] == 10e8

    toAssets = environment.notional.getAccountPortfolio(accounts[0])
    assert toAssets[0][0] == assets[1][0]
    assert toAssets[0][1] == assets[1][1]
    assert toAssets[0][2] == assets[1][2]
    assert toAssets[0][3] == 10e8

    check_system_invariants(environment, accounts)


def test_batch_transfer_has_liquidity_tokens(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 2,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
        ],
        depositActionAmount=200e8,
    )

    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    assets = environment.notional.getAccountPortfolio(accounts[1])
    erc1155ids = [
        environment.notional.encodeToId(assets[1][0], assets[1][1], assets[1][2]),
        environment.notional.encodeToId(assets[3][0], assets[3][1], assets[3][2]),
    ]
    txn = environment.notional.safeBatchTransferFrom(
        accounts[1], accounts[0], erc1155ids, [10e8, 10e8], bytes(), {"from": accounts[1]}
    )

    assert txn.events["TransferBatch"]["from"] == accounts[1]
    assert txn.events["TransferBatch"]["to"] == accounts[0]
    assert txn.events["TransferBatch"]["ids"] == erc1155ids
    assert txn.events["TransferBatch"]["values"] == [10e8, 10e8]

    toAssets = environment.notional.getAccountPortfolio(accounts[0])
    assert len(toAssets) == 2
    assert toAssets[0][0] == assets[1][0]
    assert toAssets[0][1] == assets[1][1]
    assert toAssets[0][2] == assets[1][2]
    assert toAssets[0][3] == 10e8

    assert toAssets[1][0] == assets[3][0]
    assert toAssets[1][1] == assets[3][1]
    assert toAssets[1][2] == assets[3][2]
    assert toAssets[1][3] == 10e8

    check_system_invariants(environment, accounts)


def test_transfer_fail_liquidity_tokens(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            }
        ],
        depositActionAmount=100e8,
    )

    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    assets = environment.notional.getAccountPortfolio(accounts[1])
    erc1155id = environment.notional.encodeToId(assets[1][0], assets[1][1], assets[1][2])

    with brownie.reverts("dev: portfolio handler negative liquidity token balance"):
        # Fails balance check
        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 200e8, bytes(), {"from": accounts[1]}
        )

        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [200e8], bytes(), {"from": accounts[1]}
        )

    with brownie.reverts("Insufficient free collateral"):
        # Fails free collateral check
        environment.notional.safeTransferFrom(
            accounts[1], accounts[0], erc1155id, 100e8, bytes(), {"from": accounts[1]}
        )

        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[0], [erc1155id], [100e8], bytes(), {"from": accounts[1]}
        )

    with brownie.reverts("dev: invalid asset in set ifcash assets"):
        # Cannot transfer liquidity tokens to bitmap currency account
        environment.notional.safeTransferFrom(
            accounts[1], accounts[2], erc1155id, 10e8, bytes(), {"from": accounts[1]}
        )

        environment.notional.safeBatchTransferFrom(
            accounts[1], accounts[2], [erc1155id], [10e8], bytes(), {"from": accounts[1]}
        )

    check_system_invariants(environment, accounts)


def test_transfer_borrow_fcash_deposit_collateral(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1], 1)
    data = web3.eth.contract(abi=environment.notional.abi).encodeABI(
        fn_name="batchBalanceAction",
        args=[
            accounts[1].address,
            [get_balance_action(2, "DepositAsset", depositActionAmount=5000e8)],
        ],
    )

    environment.notional.safeTransferFrom(
        accounts[1], accounts[0], erc1155id, 50e8, data, {"from": accounts[1]}
    )

    fromAssets = environment.notional.getAccountPortfolio(accounts[1])
    toAssets = environment.notional.getAccountPortfolio(accounts[0])
    assert len(toAssets) == 1
    assert len(fromAssets) == 1
    assert toAssets[0][0] == fromAssets[0][0]
    assert toAssets[0][1] == fromAssets[0][1]
    assert toAssets[0][2] == fromAssets[0][2]
    assert toAssets[0][3] == -fromAssets[0][3]

    (cashBalance, _, _) = environment.notional.getAccountBalance(2, accounts[1])
    assert cashBalance == 5000e8
    assert environment.notional.getFreeCollateral(accounts[1])[0] > 0

    check_system_invariants(environment, accounts)


def test_transfer_borrow_fcash_borrow_market(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1] + SECONDS_IN_DAY * 6, 1)
    data = web3.eth.contract(abi=environment.notional.abi).encodeABI(
        fn_name="batchBalanceAndTradeAction",
        args=[
            accounts[1].address,
            [
                get_balance_trade_action(
                    2,
                    "DepositAsset",
                    [
                        {
                            "tradeActionType": "Lend",
                            "marketIndex": 1,
                            "notional": 100e8,
                            "minSlippage": 0,
                        }
                    ],
                    depositActionAmount=5000e8,
                    withdrawEntireCashBalance=False,
                    redeemToUnderlying=False,
                )
            ],
        ],
    )

    environment.notional.safeBatchTransferFrom(
        accounts[1], accounts[0], [erc1155id], [50e8], data, {"from": accounts[1]}
    )

    fromAssets = environment.notional.getAccountPortfolio(accounts[1])
    toAssets = environment.notional.getAccountPortfolio(accounts[0])
    assert len(toAssets) == 1
    assert len(fromAssets) == 2
    assert toAssets[0][0] == fromAssets[1][0]
    assert toAssets[0][1] == fromAssets[1][1]
    assert toAssets[0][2] == fromAssets[1][2]
    assert toAssets[0][3] == -fromAssets[1][3]

    assert environment.notional.getFreeCollateral(accounts[1])[0] > 0

    check_system_invariants(environment, accounts)


def test_transfer_borrow_fcash_redeem_ntoken(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1] + SECONDS_IN_DAY * 6, 1)
    data = web3.eth.contract(abi=environment.notional.abi).encodeABI(
        fn_name="nTokenRedeem", args=[accounts[0].address, 2, int(10e8), True]
    )

    environment.notional.safeTransferFrom(
        accounts[0], accounts[1], erc1155id, 50e8, data, {"from": accounts[0]}
    )

    check_system_invariants(environment, accounts)


def test_transfer_borrow_fcash_deposit_collateral_via_transfer_operator(
    environment, accounts, MockTransferOperator
):
    transferOp = MockTransferOperator.deploy(environment.notional.address, {"from": accounts[0]})
    environment.notional.updateGlobalTransferOperator(
        transferOp.address, True, {"from": accounts[0]}
    )
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1], 1)
    data = web3.eth.contract(abi=environment.notional.abi).encodeABI(
        fn_name="batchBalanceAction",
        args=[
            accounts[1].address,  # Using "to" address
            [get_balance_action(2, "DepositAsset", depositActionAmount=5000e8)],
        ],
    )

    transferOp.initiateTransfer(
        accounts[0], accounts[1], erc1155id, 50e8, data, {"from": accounts[1]}
    )

    fromAssets = environment.notional.getAccountPortfolio(accounts[1])
    toAssets = environment.notional.getAccountPortfolio(accounts[0])
    assert len(toAssets) == 1
    assert len(fromAssets) == 1
    assert toAssets[0][0] == fromAssets[0][0]
    assert toAssets[0][1] == fromAssets[0][1]
    assert toAssets[0][2] == fromAssets[0][2]
    assert toAssets[0][3] == -fromAssets[0][3]

    (cashBalance, _, _) = environment.notional.getAccountBalance(2, accounts[1])
    assert cashBalance == 5000e8
    assert environment.notional.getFreeCollateral(accounts[1])[0] > 0

    check_system_invariants(environment, accounts)


def test_bidirectional_fcash_transfer_authorization(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1] + SECONDS_IN_DAY * 6, 1)
    amount = (Wei(2) ** 256) - Wei(50e8)

    # Account 0 is not authorized to do the transfer
    with brownie.reverts("Unauthorized"):
        environment.notional.safeBatchTransferFrom(
            accounts[0], accounts[1], [erc1155id], [amount], "", {"from": accounts[0]}
        )


def test_bidirectional_fcash_transfer_free_collateral(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)
    erc1155id = environment.notional.encodeToId(2, markets[0][1] + SECONDS_IN_DAY * 6, 1)
    amount = (Wei(2) ** 256) - Wei(50e8)

    environment.notional.setApprovalForAll(accounts[0], True, {"from": accounts[1]})
    # Account 1 does not have sufficient free collateral to take the debt
    with brownie.reverts("Insufficient free collateral"):
        environment.notional.safeBatchTransferFrom(
            accounts[0], accounts[1], [erc1155id], [amount], "", {"from": accounts[0]}
        )


def test_bidirectional_fcash_transfer(environment, accounts):
    markets = environment.notional.getActiveMarkets(2)
    erc1155ids = [
        environment.notional.encodeToId(2, markets[0][1], 1),
        environment.notional.encodeToId(2, markets[0][1] + SECONDS_IN_DAY * 6, 1),
    ]
    amounts = [50e8, (Wei(2) ** 256) - Wei(50e8)]

    environment.notional.setApprovalForAll(accounts[0], True, {"from": accounts[1]})
    environment.notional.depositUnderlyingToken(
        accounts[1], 1, 1e18, {"from": accounts[1], "value": 1e18}
    )
    environment.notional.safeBatchTransferFrom(
        accounts[0], accounts[1], erc1155ids, amounts, "", {"from": accounts[0]}
    )

    fromAssets = environment.notional.getAccountPortfolio(accounts[0])
    toAssets = environment.notional.getAccountPortfolio(accounts[1])
    assert len(toAssets) == 2
    assert len(fromAssets) == 2
    assert toAssets[0][0] == fromAssets[0][0]
    assert toAssets[0][1] == fromAssets[0][1]
    assert toAssets[0][2] == fromAssets[0][2]
    assert toAssets[0][3] == -fromAssets[0][3]

    assert toAssets[1][0] == fromAssets[1][0]
    assert toAssets[1][1] == fromAssets[1][1]
    assert toAssets[1][2] == fromAssets[1][2]
    assert toAssets[1][3] == -fromAssets[1][3]
    check_system_invariants(environment, accounts)


def test_bidirectional_fcash_transfer_to_account_will_trade(
    environment, accounts, MockTransferOperator
):
    transferOp = MockTransferOperator.deploy(environment.notional.address, {"from": accounts[0]})
    environment.notional.updateGlobalTransferOperator(
        transferOp.address, True, {"from": accounts[0]}
    )
    markets = environment.notional.getActiveMarkets(2)
    erc1155ids = [
        environment.notional.encodeToId(2, markets[0][1], 1),
        environment.notional.encodeToId(2, markets[0][1] + SECONDS_IN_DAY * 6, 1),
    ]
    amounts = [50e8, (Wei(2) ** 256) - Wei(50e8)]
    data = web3.eth.contract(abi=environment.notional.abi).encodeABI(
        fn_name="batchBalanceAction",
        args=[
            accounts[1].address,  # Using "to" address
            [get_balance_action(2, "DepositAsset", depositActionAmount=5000e8)],
        ],
    )

    transferOp.initiateBatchTransfer(
        accounts[0], accounts[1], erc1155ids, amounts, data, {"from": accounts[1]}
    )

    fromAssets = environment.notional.getAccountPortfolio(accounts[0])
    toAssets = environment.notional.getAccountPortfolio(accounts[1])
    assert len(toAssets) == 2
    assert len(fromAssets) == 2
    assert toAssets[0][0] == fromAssets[0][0]
    assert toAssets[0][1] == fromAssets[0][1]
    assert toAssets[0][2] == fromAssets[0][2]
    assert toAssets[0][3] == -fromAssets[0][3]

    assert toAssets[1][0] == fromAssets[1][0]
    assert toAssets[1][1] == fromAssets[1][1]
    assert toAssets[1][2] == fromAssets[1][2]
    assert toAssets[1][3] == -fromAssets[1][3]
    check_system_invariants(environment, accounts)
