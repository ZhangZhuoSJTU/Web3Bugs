from re import I
import requests
from pytest import approx
import json
import os
from os import environ
from pathlib import Path  # Python 3.6+ only
from brownie.convert import to_address
from dotenv import load_dotenv

subgraph = "http://localhost:8000/subgraphs/name/overlay-market/overlay-v1"

load_dotenv(".subgraph.test.env")

def ENV(key): 
    value = environ.get(key)
    if "0x" in value: return to_address(value)
    else: return value

def get_balances_for_position_in_accounts_dot_balances(accounts, pos):

    return { 
        to_address(balance['account']['address']):balance['shares'] 
        for sublist in [ x['balances'] for x in accounts if 0 < len(x['balances'])]
        for balance in sublist 
        if balance['position'] == str(pos)
    }

def query(gql):

    return json.loads(requests.post(subgraph, json={'query': gql}).text)['data']

def test_alice_and_bob_exist():

    gql = """
        query {
            accounts {
                id
            }
        }
    """

    result = query(gql)

    accounts = [ to_address(x['id']) for x in result['accounts'] ]

    assert ENV("ALICE") in accounts, "Alice is not in returned accounts"
    assert ENV("BOB") in accounts, "Bob is not in returned accounts"


def test_alice_and_bob_have_zero_position_1_shares():

    gql = """
        query {
            accounts {
                id
                balances {
                    id
                    account {
                        id
                        address
                    }
                    position
                    shares
                }
            }
        }
    """

    result = query(gql)

    accounts = result['accounts']

    position_1 = get_balances_for_position_in_accounts_dot_balances(accounts, 1)

    assert position_1[ENV('BOB')] == ENV('BOB_POSITION_1'), 'bobs position one shares are not zero'
    assert position_1[ENV('ALICE')] == ENV('ALICE_POSITION_1'), 'alices position one shares are not zero'

    position_2 = get_balances_for_position_in_accounts_dot_balances(accounts, 2)

    assert ENV('BOB') not in position_2, 'bob is in position 2'
    assert ENV('ALICE_POSITION_2') == position_2[ENV('ALICE')], 'alice has unexpected position 2 shares'

def test_batch_transfer_positions_3_to_5():

    gql = """
        query {
            accounts {
                id
                balances {
                    id
                    account {
                        id
                        address
                    }
                    position
                    shares
                }
            }
        }
    """

    result = query(gql)

    accounts = result['accounts']

    position_3 = get_balances_for_position_in_accounts_dot_balances(accounts, 3)

    assert position_3[ENV('ALICE')] == ENV('ALICE_POSITION_3'), 'alice has unexpected position 3 shares'
    assert position_3[ENV('BOB')] == ENV('BOB_POSITION_3'), 'bob has unexpected position 3 shares'

    position_4 = get_balances_for_position_in_accounts_dot_balances(accounts, 4)

    assert position_4[ENV('ALICE')] == ENV('ALICE_POSITION_4'), 'alice has unexpected position 4 shares'
    assert position_4[ENV('BOB')] == ENV('BOB_POSITION_4'), 'bob has unexpected position 4 shares'

    position_5 = get_balances_for_position_in_accounts_dot_balances(accounts, 5)

    assert position_5[ENV('ALICE')] == ENV('ALICE_POSITION_5'), 'alice has unexpected position 5 shares'
    assert position_5[ENV('BOB')] == ENV('BOB_POSITION_5'), 'bob has unexpected position 5 shares'


if __name__ == "__main__":

    test_alice_and_bob_exist()

    test_alice_and_bob_have_zero_position_1_shares()

    test_batch_transfer_positions_3_to_5()

    print("end")
