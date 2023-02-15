from brownie import MockERC20, accounts
from brownie.project import ContractsVProject

proxy = ContractsVProject.nTransparentUpgradeableProxy[0]


def get_ctoken_contract(name):
    if name == "cETH":
        return ContractsVProject.nCEther[0]
    else:
        for cToken in ContractsVProject.nCErc20:
            if cToken.symbol() == name:
                return cToken

    raise Exception(name, "not found")


def approve_ctoken(account, name):
    cToken = get_ctoken_contract(name)
    cToken.approve(proxy.address, 2 ** 255, {"from": account})


def mint_ctoken(account, name, amount):
    cToken = get_ctoken_contract(name)
    if name == "cETH":
        cToken.mint({"from": account, "value": amount})
    else:
        underlying = MockERC20.at(cToken.underlying(), owner=accounts[0])

        if underlying.balanceOf(account.address) == 0:
            # Transfer from initial deployer
            underlying.transfer(account.address, amount, {"from": accounts[0]})

        if underlying.allowance(account.address, cToken.address) == 0:
            underlying.approve(cToken.address, 2 ** 255, {"from": account})

        cToken.mint(amount, {"from": account})
