from collections import defaultdict

import pytest
from brownie.convert.datatypes import Wei
from brownie.network.state import Chain
from tests.constants import HAS_ASSET_DEBT, HAS_BOTH_DEBT, HAS_CASH_DEBT
from tests.helpers import active_currencies_to_list, get_settlement_date

chain = Chain()
QUARTER = 86400 * 90


def get_all_markets(env, currencyId):
    block_time = chain.time()
    current_time_ref = env.startTime - (env.startTime % QUARTER)
    markets = []
    while current_time_ref < block_time:
        markets.append(env.notional.getActiveMarketsAtBlockTime(currencyId, current_time_ref))
        current_time_ref = current_time_ref + QUARTER

    return markets


def check_system_invariants(env, accounts):
    check_cash_balance(env, accounts)
    check_ntoken(env, accounts)
    check_portfolio_invariants(env, accounts)
    check_account_context(env, accounts)
    check_token_incentive_balance(env, accounts)


def computed_settled_asset_cash(env, asset, currencyId, symbol):
    blockTime = chain.time()
    settledCash = 0
    settlementDate = get_settlement_date(asset, blockTime)
    if settlementDate > blockTime:
        return 0

    assetRate = env.notional.getSettlementRate(currencyId, asset[1])
    decimals = assetRate[2]
    conversionRate = Wei(1e18) * Wei(decimals) / Wei(assetRate[1] * 1e8)
    if asset[2] == 1:
        settledCash += asset[3] * conversionRate
    else:
        market = list(
            filter(
                lambda x: x[1] == asset[1],
                env.notional.getActiveMarketsAtBlockTime(currencyId, settlementDate - 1),
            )
        )[0]
        settledCash += market[3] * asset[3] / market[4]

        if asset[1] < blockTime:
            settledCash += (market[2] * asset[3] / market[4]) * conversionRate

    return settledCash


def compute_settled_fcash(currencyId, symbol, env, accounts):
    settledCash = 0

    for account in accounts:
        portfolio = env.notional.getAccountPortfolio(account.address)
        for asset in portfolio:
            if asset[0] == currencyId:
                settledCash += computed_settled_asset_cash(env, asset, currencyId, symbol)

    # Check nToken portfolios
    (portfolio, ifCashAssets) = env.notional.getNTokenPortfolio(env.nToken[currencyId].address)

    for asset in portfolio:
        settledCash += computed_settled_asset_cash(env, asset, currencyId, symbol)

    for asset in ifCashAssets:
        settledCash += computed_settled_asset_cash(env, asset, currencyId, symbol)

    return settledCash


def check_cash_balance(env, accounts):
    # For every currency, check that the contract balance matches the account
    # balances and capital deposited trackers
    for (symbol, currencyId) in env.currencyId.items():
        tokenBalance = None
        if symbol == "ETH":
            tokenBalance = env.notional.balance()
        else:
            tokenBalance = env.token[symbol].balanceOf(env.notional.address)

        if symbol != "NOMINT":
            # Should not accumulate underlying balances if mintable
            assert tokenBalance == 0

        contractBalance = 0
        if symbol != "NOMINT":
            contractBalance = env.cToken[symbol].balanceOf(env.notional.address)
        else:
            contractBalance = tokenBalance * 1e8 / 1e18

        accountBalances = 0
        nTokenTotalBalances = 0

        for account in accounts:
            (cashBalance, nTokenBalance, _) = env.notional.getAccountBalance(
                currencyId, account.address
            )
            accountBalances += cashBalance
            nTokenTotalBalances += nTokenBalance

        # Add nToken balances
        (cashBalance, _, _) = env.notional.getAccountBalance(
            currencyId, env.nToken[currencyId].address
        )
        accountBalances += cashBalance

        # Loop markets to check for cashBalances
        markets = env.notional.getActiveMarkets(currencyId)
        for m in markets:
            accountBalances += m[3]

        accountBalances += env.notional.getReserveBalance(currencyId)
        accountBalances += compute_settled_fcash(currencyId, symbol, env, accounts)

        # TODO: this can happen from liquidation when withdrawing liquidity tokens...
        assert pytest.approx(contractBalance, abs=2) == accountBalances
        # Check that total supply equals total balances
        assert nTokenTotalBalances == env.nToken[currencyId].totalSupply()


def check_ntoken(env, accounts):
    # For every nToken, check that it has no other balances and its
    # total outstanding supply matches its supply
    for (currencyId, nToken) in env.nToken.items():
        totalSupply = nToken.totalSupply()
        totalTokensHeld = 0

        for account in accounts:
            (_, tokens, _) = env.notional.getAccountBalance(currencyId, account.address)
            totalTokensHeld += tokens

        # Ensure that total supply equals tokens held
        assert totalTokensHeld == totalSupply

        # Ensure that the nToken never holds other balances
        for (_, testCurrencyId) in env.currencyId.items():
            (cashBalance, tokens, lastMintTime) = env.notional.getAccountBalance(
                testCurrencyId, nToken.address
            )
            assert tokens == 0
            assert lastMintTime == 0

            if testCurrencyId != currencyId:
                assert cashBalance == 0

        # TODO: ensure that the nToken holds enough PV for negative fcash balances

        # Ensure that the FC of the nToken is gte 0
        assert env.notional.getFreeCollateral(nToken.address)[0] >= 0


def check_portfolio_invariants(env, accounts):
    fCash = defaultdict(dict)
    liquidityToken = defaultdict(dict)

    for account in accounts:
        env.notional.settleAccount(account.address)
        portfolio = env.notional.getAccountPortfolio(account.address)
        for asset in portfolio:
            if asset[2] == 1:
                if (asset[0], asset[1]) in fCash:
                    # Is fCash asset type, fCash[currencyId][maturity]
                    fCash[(asset[0], asset[1])] += asset[3]
                else:
                    fCash[(asset[0], asset[1])] = asset[3]
            else:
                if (asset[0], asset[1], asset[2]) in liquidityToken:
                    # Is liquidity token, liquidityToken[currencyId][maturity][assetType]
                    # Each liquidity token is indexed by its type and settlement date
                    liquidityToken[(asset[0], asset[1], asset[2])] += asset[3]
                else:
                    liquidityToken[(asset[0], asset[1], asset[2])] = asset[3]

    # Check nToken portfolios
    for (currencyId, nToken) in env.nToken.items():
        try:
            env.notional.initializeMarkets(currencyId, False)
        except Exception as e:
            print(e)
        (portfolio, ifCashAssets) = env.notional.getNTokenPortfolio(nToken.address)

        for asset in portfolio:
            # nToken cannot have any other currencies or fCash in its portfolio
            assert asset[0] == currencyId
            assert asset[2] != 1
            if (asset[0], asset[1], asset[2]) in liquidityToken:
                # Is liquidity token, liquidityToken[currencyId][maturity][assetType]
                # Each liquidity token is indexed by its type and settlement date
                liquidityToken[(asset[0], asset[1], asset[2])] += asset[3]
            else:
                liquidityToken[(asset[0], asset[1], asset[2])] = asset[3]

        for asset in ifCashAssets:
            assert asset[0] == currencyId
            if (asset[0], asset[1]) in fCash:
                # Is fCash asset type, fCash[currencyId][maturity]
                fCash[(asset[0], asset[1])] += asset[3]
            else:
                fCash[(asset[0], asset[1])] = asset[3]

    # Check fCash in markets
    for (_, currencyId) in env.currencyId.items():
        markets = get_all_markets(env, currencyId)
        for marketGroup in markets:
            for (i, m) in enumerate(marketGroup):
                # Add total fCash in market
                assert m[2] >= 0
                if (currencyId, m[1]) in fCash:
                    # Is fCash asset type, fCash[currencyId][maturity]
                    fCash[(currencyId, m[1])] += m[2]
                else:
                    fCash[(currencyId, m[1])] = m[2]

                # Assert that total liquidity equals the tokens in portfolios
                if m[4] > 0:
                    assert liquidityToken[(currencyId, m[1], 2 + i)] == m[4]
                elif m[4] == 0:
                    assert (currencyId, m[1], 2 + i) not in liquidityToken
                else:
                    # Should never be zero
                    assert False

    for (_, netfCash) in fCash.items():
        # Assert that all fCash balances net off to zero
        assert netfCash == 0


def check_account_context(env, accounts):
    for account in accounts:
        context = env.notional.getAccountContext(account.address)
        activeCurrencies = list(active_currencies_to_list(context[-1]))

        hasCashDebt = False
        for (_, currencyId) in env.currencyId.items():
            # Checks that active currencies is set properly
            (cashBalance, nTokenBalance, _) = env.notional.getAccountBalance(
                currencyId, account.address
            )
            if (cashBalance != 0 or nTokenBalance != 0) and context[3] != currencyId:
                assert (currencyId, True) in [(a[0], a[2]) for a in activeCurrencies]

            if cashBalance < 0:
                hasCashDebt = True

        portfolio = env.notional.getAccountPortfolio(account.address)
        nextSettleTime = 0
        if len(portfolio) > 0:
            nextSettleTime = get_settlement_date(portfolio[0], chain.time())

        hasPortfolioDebt = False
        for asset in portfolio:
            if context[3] == 0:
                # Check that currency id is in the active currencies list
                assert (asset[0], True) in [(a[0], a[1]) for a in activeCurrencies]
            else:
                # Check that assets are set in the bitmap
                assert asset[0] == context[3]

            settleTime = get_settlement_date(asset, chain.time())

            if settleTime < nextSettleTime:
                # Set to the lowest maturity
                nextSettleTime = settleTime

            if asset[3] < 0:
                # Negative fcash
                hasPortfolioDebt = True

        # Check next settle time for portfolio array
        if context[3] == 0:
            assert context[0] == nextSettleTime

        # Check that has debt is set properly.
        if hasPortfolioDebt and hasCashDebt:
            assert context[1] == HAS_BOTH_DEBT
        elif hasPortfolioDebt:
            # It's possible that cash debt is set to true  but out of sync due to not running
            # a free collateral check after settling cash debts
            assert context[1] == HAS_BOTH_DEBT or context[1] == HAS_ASSET_DEBT
        elif hasCashDebt:
            assert context[1] == HAS_CASH_DEBT


def check_token_incentive_balance(env, accounts):
    totalTokenBalance = 0

    for account in accounts:
        totalTokenBalance += env.noteERC20.balanceOf(account)

    totalTokenBalance += env.noteERC20.balanceOf(env.notional.address)

    if hasattr(env, "governor"):
        totalTokenBalance += env.noteERC20.balanceOf(env.governor.address)
        totalTokenBalance += env.noteERC20.balanceOf(env.multisig.address)

    assert totalTokenBalance == 100000000e8
