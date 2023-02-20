from brownie import *
from .settings import *
from .contracts import *
from .contract_addresses import *
import time


def deploy_gnosis_safe():
    gnosis_safe_address = CONTRACTS[network.show_active()]["gnosis_safe"]
    if gnosis_safe_address == "":
        gnosis_safe_master_copy = GnosisSafe.deploy({"from": accounts[0]})
    else:
        gnosis_safe_master_copy = GnosisSafe.at(gnosis_safe_address)

    return gnosis_safe_master_copy


def deploy_proxy_factory():
    proxy_factory_address = CONTRACTS[network.show_active()]["proxy_factory"]
    if proxy_factory_address == "":
        proxy_factory = ProxyFactory.deploy({"from": accounts[0]})
    else:
        proxy_factory = ProxyFactory.at(proxy_factory_address)
    return proxy_factory


def deploy_gnosis_vault():
    gnosis_vault_address = CONTRACTS[network.show_active()]["gnosis_vault"]
    if gnosis_vault_address == "":
        gnosis_vault = GnosisVault.deploy({"from": accounts[0]})
    else:
        gnosis_vault = GnosisVault.at(gnosis_vault_address)

    return gnosis_vault


def main():
    load_accounts()
    gnosis_safe = CONTRACTS[network.show_active()]["gnosis_safe"]
    proxy_factory = CONTRACTS[network.show_active()]["proxy_factory"]

    gnosis_vault = deploy_gnosis_vault()
    gnosis_vault.initGnosisVault(
        gnosis_safe, proxy_factory, {"from": accounts[0]})

    owners = [accounts[0], accounts[1]]
    threshold = 1
    delegate_to = ZERO_ADDRESS
    data = "0x"
    handle_fallback = ZERO_ADDRESS
    payment_token = ZERO_ADDRESS
    gasPrice = 50
    payment = 5000 * gasPrice
    paymentReceiver = accounts[1]

    proxy = gnosis_vault.createSafe(
        owners,
        threshold,
        delegate_to,
        data,
        handle_fallback,
        payment_token,
        payment,
        paymentReceiver)
