import brownie
import pytest
import scripts.deploy_v1
from brownie.convert.datatypes import Wei
from brownie.network import web3
from brownie.network.contract import Contract
from brownie.network.state import Chain
from brownie.project import ContractsVProject
from tests.helpers import get_balance_trade_action, initialize_environment

chain = Chain()


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    v2env = initialize_environment(accounts)
    v1env = scripts.deploy_v1.deploy_v1(v2env)

    blockTime = chain.time()
    cashMarketABI = ContractsVProject._build.get("CashMarketInterface")["abi"]
    cashMarket = Contract.from_abi(
        "CashMarket",
        v1env["Portfolios"].functions.cashGroups(1).call()[3],
        abi=cashMarketABI,
        owner=accounts[0],
    )
    daiMaturities = cashMarket.getActiveMaturities()

    # borrow dai w/ eth
    erc1155 = Contract.from_abi(
        "ERC1155Trade", address=v1env["ERC1155Trade"].address, abi=v1env["ERC1155Trade"].abi
    )

    erc1155.batchOperationWithdraw(
        accounts[1].address,
        blockTime + 100000,
        [],  # deposit 10 eth
        [(0, 1, daiMaturities[0], Wei(100e18), bytes())],  # borrow 100 dai
        [(accounts[1].address, 1, 0)],  # withdraw all
        {"from": accounts[1], "value": Wei(10e18)},
    )

    # borrow dai w/ wbtc
    v2env.token["WBTC"].transfer(accounts[2], 100e8, {"from": accounts[0]})
    v2env.token["WBTC"].approve(v1env["Escrow"].address, 2 ** 255, {"from": accounts[2]})
    erc1155.batchOperationWithdraw(
        accounts[2].address,
        blockTime + 100000,
        [(3, 10e8)],  # deposit 10 btc
        [(0, 1, daiMaturities[0], Wei(100e18), bytes())],  # borrow 100 dai
        [(accounts[2].address, 1, 0)],  # withdraw all
        {"from": accounts[2]},
    )
    # borrow usdc w/ eth
    erc1155.batchOperationWithdraw(
        accounts[3].address,
        blockTime + 100000,
        [],  # deposit eth
        [(0, 2, daiMaturities[0], 100e6, bytes())],  # borrow 100 usdc
        [(accounts[3].address, 2, 0)],  # withdraw all
        {"from": accounts[3], "value": 10e18},
    )
    # borrow usdc w/ wbtc
    v2env.token["WBTC"].transfer(accounts[4], 100e8, {"from": accounts[0]})
    v2env.token["WBTC"].approve(v1env["Escrow"].address, 2 ** 255, {"from": accounts[4]})
    erc1155.batchOperationWithdraw(
        accounts[4].address,
        blockTime + 100000,
        [(3, 10e8)],  # deposit btc
        [(0, 2, daiMaturities[0], 100e6, bytes())],  # borrow 100 usdc
        [(accounts[4].address, 2, 0)],  # withdraw all
        {"from": accounts[4]},
    )

    v2env.notional.updateAuthorizedCallbackContract(v1env["Migrator"].address, True)

    return (v1env, v2env)


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def test_migrate_v1_to_comp(
    environment, accounts, NotionalV1ToCompound, nTransparentUpgradeableProxy
):
    account = accounts[3]
    (v1env, v2env) = environment
    v1ToCompImpl = NotionalV1ToCompound.deploy(
        v1env["Escrow"].address,
        v1env["ERC1155Trade"].address,
        v1env["uniswapFactory"].getPair(v1env["WETH"].address, v2env.token["WBTC"]),
        v1env["WETH"].address,
        v2env.token["WBTC"],
        v2env.comptroller.address,
        v2env.cToken["ETH"],
        v2env.cToken["DAI"],
        v2env.cToken["USDC"],
        v2env.cToken["WBTC"],
        {"from": account},
    )

    initializeData = web3.eth.contract(abi=NotionalV1ToCompound.abi).encodeABI(
        fn_name="initialize", args=[]
    )

    proxy = nTransparentUpgradeableProxy.deploy(
        v1ToCompImpl.address,
        v2env.proxyAdmin.address,
        initializeData,  # Deployer is set to owner
        {"from": account},
    )

    v1ToComp = Contract.from_abi(
        "v1ToComp", proxy.address, abi=NotionalV1ToCompound.abi, owner=account
    )

    # USDC w/ ETH
    erc1155 = Contract.from_abi(
        "ERC1155Trade", address=v1env["ERC1155Trade"].address, abi=v1env["ERC1155Trade"].abi
    )
    erc1155.setApprovalForAll(v1ToComp.address, True, {"from": account})
    v2env.token["USDC"].approve(v1env["Escrow"].address, 2 ** 255, {"from": account})
    v1ToComp.migrateUSDCEther(100e6)
    balances = v1env["Escrow"].functions.getBalances(account.address).call()
    assert balances[0] == 0
    assert balances[1] == 0
    assert balances[2] == 100e6
    assert balances[3] == 0
    assert v2env.cToken["USDC"].borrowBalanceStored(v1ToComp.address) > 0

    with brownie.reverts():
        v1ToComp.approveAllowance(v2env.cToken["ETH"], accounts[1], 100e8, {"from": accounts[1]})

    v1ToComp.approveAllowance(v2env.cToken["ETH"], accounts[3], 2 ** 255, {"from": accounts[3]})
    balanceBefore = v2env.cToken["ETH"].balanceOf(accounts[3])
    v2env.cToken["ETH"].transferFrom(v1ToComp.address, accounts[3], 10, {"from": accounts[3]})
    balanceAfter = v2env.cToken["ETH"].balanceOf(accounts[3])
    assert balanceBefore + 10 == balanceAfter

    # Cannot transfer if not approved
    balanceBefore = v2env.cToken["ETH"].balanceOf(accounts[1])
    # This does not revert outright...
    v2env.cToken["ETH"].transferFrom(v1ToComp.address, accounts[1], 10, {"from": accounts[1]})
    balanceAfter = v2env.cToken["ETH"].balanceOf(accounts[1])
    assert balanceBefore == balanceAfter

    # Assert we can repay and withdraw collateral
    v2env.cToken["USDC"].repayBorrowBehalf(v1ToComp.address, 100e6, {"from": accounts[0]})
    v2env.cToken["ETH"].transferFrom(
        v1ToComp.address,
        accounts[3],
        v2env.cToken["ETH"].balanceOf(v1ToComp.address),
        {"from": accounts[3]},
    )
    assert v2env.cToken["ETH"].balanceOf(v1ToComp.address) == 0


def test_migrate_comp_to_v2(environment, accounts, CompoundToNotionalV2):
    account = accounts[5]
    (v1env, v2env) = environment
    compToV2 = CompoundToNotionalV2.deploy(v2env.notional.address, {"from": accounts[0]})
    v2env.notional.updateAuthorizedCallbackContract(compToV2.address, True)

    # NOTE: these approvals allow deposit of collateral
    compToV2.enableToken(v2env.cToken["USDC"].address, v2env.notional.address)
    compToV2.enableToken(v2env.cToken["ETH"].address, v2env.notional.address)

    # NOTE: these approvals allow repayBorrowBehalf
    compToV2.enableToken(v2env.token["USDC"].address, v2env.cToken["USDC"].address)

    v2env.comptroller.enterMarkets(
        [v2env.cToken["USDC"].address, v2env.cToken["ETH"].address], {"from": account}
    )
    v2env.cToken["ETH"].mint({"from": account, "value": 10e18})
    v2env.cToken["USDC"].borrow(100e6, {"from": account})

    # NOTE: these approvals need to be set by the user
    v2env.token["USDC"].approve(compToV2.address, 2 ** 255, {"from": account})
    v2env.cToken["ETH"].approve(compToV2.address, 2 ** 255, {"from": account})

    borrowAction = get_balance_trade_action(
        3,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 120e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )

    assert v2env.cToken["ETH"].balanceOf(account) > 0
    assert v2env.cToken["USDC"].borrowBalanceStored(account) > 0

    # Assert that the FC check will fail on insufficient collateral
    with brownie.reverts("Insufficient free collateral"):
        compToV2.migrateBorrowFromCompound(
            v2env.cToken["USDC"].address, 0, [1], [100], [borrowAction], {"from": account}
        )

    compToV2.migrateBorrowFromCompound(
        v2env.cToken["USDC"].address,
        0,
        [1],
        [v2env.cToken["ETH"].balanceOf(account)],
        [borrowAction],
        {"from": account},
    )

    assert v2env.cToken["ETH"].balanceOf(account) == 0
    assert v2env.cToken["USDC"].borrowBalanceStored(account) == 0

    assert v2env.notional.getAccountBalance(1, account)[0] > 0
    portfolio = v2env.notional.getAccountPortfolio(account)
    assert len(portfolio) == 1
    assert portfolio[0][3] == -120e8


def test_migrate_dai_eth(environment, accounts):
    account = accounts[1]
    (v1env, v2env) = environment
    erc1155 = Contract.from_abi(
        "ERC1155Trade", address=v1env["ERC1155Trade"].address, abi=v1env["ERC1155Trade"].abi
    )
    erc1155.setApprovalForAll(v1env["Migrator"].address, True, {"from": account})
    v2env.token["DAI"].approve(v1env["Escrow"].address, 2 ** 255, {"from": account})
    borrowAction = get_balance_trade_action(
        2,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 100e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    v1env["Migrator"].migrateDaiEther(100e18, [borrowAction], {"from": account})

    balances = v1env["Escrow"].functions.getBalances(account.address).call()
    assert balances[0] == 0
    assert balances[1] == 100e18
    assert balances[2] == 0
    assert balances[3] == 0

    assert v2env.notional.getAccountBalance(1, account)[0] > 0
    portfolio = v2env.notional.getAccountPortfolio(account)
    assert len(portfolio) == 1
    assert portfolio[0][3] == -100e8


def test_migrate_dai_wbtc(environment, accounts):
    account = accounts[2]
    (v1env, v2env) = environment
    erc1155 = Contract.from_abi(
        "ERC1155Trade", address=v1env["ERC1155Trade"].address, abi=v1env["ERC1155Trade"].abi
    )
    erc1155.setApprovalForAll(v1env["Migrator"].address, True, {"from": account})
    v2env.token["DAI"].approve(v1env["Escrow"].address, 2 ** 255, {"from": account})
    borrowAction = get_balance_trade_action(
        2,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 100e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    v1env["Migrator"].migrateDaiWBTC(100e18, [borrowAction], {"from": account})

    balances = v1env["Escrow"].functions.getBalances(account.address).call()
    assert balances[0] == 0
    assert balances[1] == 100e18
    assert balances[2] == 0
    assert balances[3] == 0

    assert v2env.notional.getAccountBalance(4, account)[0] > 0
    portfolio = v2env.notional.getAccountPortfolio(account)
    assert len(portfolio) == 1
    assert portfolio[0][3] == -100e8


def test_migrate_usdc_eth(environment, accounts):
    account = accounts[3]
    (v1env, v2env) = environment
    erc1155 = Contract.from_abi(
        "ERC1155Trade", address=v1env["ERC1155Trade"].address, abi=v1env["ERC1155Trade"].abi
    )
    erc1155.setApprovalForAll(v1env["Migrator"].address, True, {"from": account})
    v2env.token["USDC"].approve(v1env["Escrow"].address, 2 ** 255, {"from": account})
    borrowAction = get_balance_trade_action(
        3,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 100e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    v1env["Migrator"].migrateUSDCEther(100e6, [borrowAction], {"from": account})

    balances = v1env["Escrow"].functions.getBalances(account.address).call()
    assert balances[0] == 0
    assert balances[1] == 0
    assert balances[2] == 100e6
    assert balances[3] == 0

    assert v2env.notional.getAccountBalance(1, account)[0] > 0
    portfolio = v2env.notional.getAccountPortfolio(account)
    assert len(portfolio) == 1
    assert portfolio[0][3] == -100e8


def test_migrate_usdc_wbtc(environment, accounts):
    account = accounts[4]
    (v1env, v2env) = environment
    erc1155 = Contract.from_abi(
        "ERC1155Trade", address=v1env["ERC1155Trade"].address, abi=v1env["ERC1155Trade"].abi
    )
    erc1155.setApprovalForAll(v1env["Migrator"].address, True, {"from": account})
    v2env.token["USDC"].approve(v1env["Escrow"].address, 2 ** 255, {"from": account})
    borrowAction = get_balance_trade_action(
        3,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 100e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    v1env["Migrator"].migrateUSDCWBTC(100e6, [borrowAction], {"from": account})

    balances = v1env["Escrow"].functions.getBalances(account.address).call()
    assert balances[0] == 0
    assert balances[1] == 0
    assert balances[2] == 100e6
    assert balances[3] == 0

    assert v2env.notional.getAccountBalance(4, account)[0] > 0
    portfolio = v2env.notional.getAccountPortfolio(account)
    assert len(portfolio) == 1
    assert portfolio[0][3] == -100e8
