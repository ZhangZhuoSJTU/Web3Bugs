import pytest
from brownie import accounts, reverts
from settings import *

# reset the chain after every test case
@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass

def test_point_list(point_list):
    points = 10
    tx = point_list.setPoints([accounts[3]], [points], {"from": accounts[0]})
    assert "PointsUpdated" in tx.events
    assert point_list.hasPoints(accounts[3], points) == True

    assert point_list.isInList(accounts[3]) == True
    assert point_list.points(accounts[3]) == points


def test_point_list_remove(point_list):
    points = 10
    tx = point_list.setPoints([accounts[3]], [points], {"from": accounts[0]})
    assert point_list.points(accounts[3]) == points
    points = 10
    tx = point_list.setPoints([accounts[3]], [points], {"from": accounts[0]})
    assert "PointsUpdated" not in tx.events
    with reverts():
        tx = point_list.setPoints([], [], {"from": accounts[0]})
    with reverts():
        tx = point_list.setPoints([], [points], {"from": accounts[0]})
    with reverts():
        tx = point_list.setPoints([accounts[3]], [], {"from": accounts[0]})
    with reverts():
        tx = point_list.setPoints([accounts[3]], [points], {"from": accounts[1]})

    points = 5
    tx = point_list.setPoints([accounts[3]], [points], {"from": accounts[0]})
    assert point_list.points(accounts[3]) == points
    assert point_list.totalPoints() == points
    points = 0
    tx = point_list.setPoints([accounts[3]], [points], {"from": accounts[0]})
    assert "PointsUpdated" in tx.events
    assert point_list.totalPoints() == 0
    assert point_list.points(accounts[3]) == 0
    assert point_list.isInList(accounts[3]) == False
    assert point_list.hasPoints(accounts[3], 1) == False


# Test cannot initPointList twice
# Test not allowed operator, cannot change
# Test setPoints to an empty account array, and empty amount, and both empty
# Test an array with multiple users, some duplicates accounts different amounts
# Test changing amount, higher, lower, higher and check still correct, and totalPoints correct

def test_init_twice(point_list):
    with reverts("Already initialised"):
        point_list.initPointList(accounts[0], {"from": accounts[0]})

def test_set_points_not_operator(point_list):
    points = 10
    with reverts("PointList.setPoints: Sender must be operator"):
        point_list.setPoints([accounts[3]], [points], {"from": accounts[5]})

def test_multiple_accounts_changing_amount(point_list):
    points = [5,10]
    account = [accounts[5], accounts[6]]

    tx = point_list.setPoints(account, points, {"from": accounts[0]})
    assert "PointsUpdated" in tx.events
    totalPoints = 5 + 10
    assert point_list.totalPoints() == totalPoints
    assert point_list.points(accounts[5]) == 5
    assert point_list.points(accounts[6]) == 10


    points = [15,20]
    account = [accounts[7], accounts[8]]
    tx = point_list.setPoints(account, points, {"from": accounts[0]})
    assert "PointsUpdated" in tx.events
    totalPoints = 5 + 10 + 15 + 20
    assert point_list.totalPoints() == totalPoints
    assert point_list.points(accounts[7]) == 15
    assert point_list.points(accounts[8]) == 20

    points = [10,15]
    account = [accounts[5], accounts[6]]
    
    tx = point_list.setPoints(account, points, {"from": accounts[0]})
    assert "PointsUpdated" in tx.events
    totalPoints = totalPoints - 5 - 10 + 10 + 15
    assert point_list.totalPoints() == totalPoints
    assert point_list.points(accounts[5]) == 10
    assert point_list.points(accounts[6]) == 15
