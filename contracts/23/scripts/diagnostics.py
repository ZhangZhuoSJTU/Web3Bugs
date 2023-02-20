from datetime import datetime

import humanfriendly
from brownie.network.contract import Contract
from brownie.network.state import Chain
from brownie.project import ContractsVProject
from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table

from brownie import MockERC20, Views  # MockAggregator,; nCErc20,


console = Console(height=16)
chain = Chain()

MARKET_NAMES = ["3 mo", "6 mo", "1 yr", "2 yr", "5 yr", "7 yr", "10 yr", "15 yr", "20 yr"]


def currency_panel(currency, ethRate, currencyId, assetRate, proxy):
    erc20 = Contract.from_abi("erc20", currency[0], abi=MockERC20.abi, owner=None)
    symbol = erc20.symbol()
    totalBalance = erc20.balanceOf(proxy)

    grid = Table.grid(expand=True)
    grid.add_column(style="cyan")
    grid.add_column(justify="right", style="magenta")
    grid.add_row("ID", "{}".format(currencyId))
    grid.add_row("Address", "{}".format(currency[0]))
    grid.add_row("Symbol", symbol)
    grid.add_row("Has Fee", "{}".format(currency[1]))
    grid.add_row("Decimals", "{}".format(currency[2]))
    grid.add_row("ETH Rate", "{}".format(ethRate[1] / ethRate[0]))
    grid.add_row("Buffer", "{}%".format(ethRate[2]))
    grid.add_row("Haircut", "{}%".format(ethRate[3]))
    grid.add_row("Liquidation Discount", "{}%".format(ethRate[4]))
    grid.add_row("Balance", "{}".format(totalBalance / currency[2]))
    grid.add_row(
        "Balance Underlying", "{}".format((totalBalance * assetRate[1]) / (1e18 * currency[2]))
    )

    return Panel(grid, title="Currency: {}".format(symbol))


def cash_group_panel(cashGroup, assetRate):
    grid = Table.grid(expand=True)
    grid.add_column(style="cyan")
    grid.add_column(justify="right", style="magenta")
    grid.add_row("Asset Rate", str(assetRate[1] / 1e18))
    grid.add_row("Max Markets", str(cashGroup[0]))
    grid.add_row("Rate Oracle Time", "{} min".format(cashGroup[1]))
    grid.add_row("Liquidity Fee", "{} bps".format(cashGroup[2]))
    grid.add_row("Token Haircut", "{}%".format(cashGroup[3]))
    grid.add_row("Debt Buffer", "{} bps".format(cashGroup[4]))
    grid.add_row("fCash Haircut", "{} bps".format(cashGroup[5]))
    grid.add_row("Rate Scalar", str(cashGroup[6]))

    return Panel(grid, title="Cash Group")


def markets_panel(markets, assetRate):
    blockTime = chain.time()
    table = Table()
    table.add_column("Name", justify="right", style="cyan", no_wrap=True)
    table.add_column("Maturity", style="magenta")
    table.add_column("Time To Maturity", style="magenta")
    table.add_column("fCash", style="green")
    table.add_column("Asset Cash", style="green")
    table.add_column("Underlying Cash", style="green")
    table.add_column("Liquidity", style="green")
    table.add_column("Last Implied Rate", style="green")
    table.add_column("Oracle Rate", style="green")
    table.add_column("Previous Trade Time", style="green")

    for (i, m) in enumerate(markets):
        table.add_row(
            MARKET_NAMES[i],
            "{0:%Y-%m-%d}".format(datetime.utcfromtimestamp(m[1])),
            humanfriendly.format_timespan(m[1] - blockTime, max_units=2),
            str(m[2] / 1e8),
            str(m[3] / 1e8),
            str((m[3] * assetRate[1]) / (1e8 * 1e18)),  # underlying
            str(m[4] / 1e8),
            "{}%".format(m[5] / 1e7),
            "{}%".format(m[6] / 1e7),
            "{0:%Y-%m-%d %H:%M:%S}".format(datetime.utcfromtimestamp(m[7])),
        )

    return Panel(
        table,
        title="Active Markets on {0:%Y-%m-%d %H:%M:%S}".format(
            datetime.utcfromtimestamp(blockTime)
        ),
    )


def print_cash_group(cashGroup, assetRate, currency, ethRate, markets, currencyId, proxy):
    layout = Layout()
    layout.split(
        Layout(
            currency_panel(currency, ethRate, currencyId, assetRate, proxy),
            ratio=1,
            name="currency",
        ),
        Layout(cash_group_panel(cashGroup, assetRate), ratio=1, name="cash group"),
        Layout(markets_panel(markets, assetRate), ratio=4, name="markets"),
        direction="horizontal",
    )

    return layout


def print_all_cash_groups(
    cashGroupsAndRate, currencyAndRate, activeMarkets, proxy, currencyId=None
):
    for i, (cg, rate) in enumerate(cashGroupsAndRate):
        if currencyId and currencyId != i + 1:
            continue
        (currency, ethRate) = currencyAndRate[i]
        markets = activeMarkets[i]
        layout = print_cash_group(cg, rate, currency, ethRate, markets, i + 1, proxy)
        console.print(layout)


def get_diagnostics(proxyAddress, currencyId=None):
    views = Contract.from_abi("Views", proxyAddress, abi=Views.abi, owner=None)
    maxCurrencyId = views.getMaxCurrencyId()

    currencyAndRate = []
    cashGroupsAndRate = []
    activeMarkets = []
    for i in range(1, maxCurrencyId + 1):
        currencyAndRate.append(views.getCurrencyAndRate(i))
        cashGroupsAndRate.append(views.getCashGroupAndAssetRate(i))
        activeMarkets.append(views.getActiveMarkets(i))

    print_all_cash_groups(
        cashGroupsAndRate, currencyAndRate, activeMarkets, proxyAddress, currencyId
    )


def main(currencyId):
    proxyAddress = ContractsVProject.nTransparentUpgradeableProxy[0].address
    get_diagnostics(proxyAddress, currencyId=currencyId)
