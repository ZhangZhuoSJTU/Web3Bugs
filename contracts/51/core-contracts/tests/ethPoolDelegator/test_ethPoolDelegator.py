#!/usr/bin/python3
import brownie
import json

data = json.load(open('config/pooldata.json', 'r'))
lp_token_address = data.get('lp_token_address')
swap_constructor = data.get('swap_constructor')
coins = data.get('coins')


def test_coins(ethPoolD):
    assert ethPoolD.coins(0) == coins[0] and ethPoolD.coins(1) == coins[1]

def test_initial_balances(ethPoolD):
    assert ethPoolD.balances(0) == 0 and ethPoolD.balances(1) == 0
