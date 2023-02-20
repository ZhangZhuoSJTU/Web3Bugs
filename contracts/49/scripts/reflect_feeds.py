import math
import os
import json
import brownie
from brownie import \
    chain, \
    interface, \
    accounts

START = chain.time()
ONE_DAY = 86400

def reflect_feed(path):

    base = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.normpath(os.path.join(base, path + '_raw_uni.json'))) as f:
        feed = json.load(f)

    feed.reverse()

    chain.mine(timestamp=START)
    now = chain.time()
    earliest = feed[0]['observation'][0]

    diff = 0
    print("len feed", len(feed))

    print("feed12",feed[311])

    obs = []
    shims = []

    mock_start = now - 3600

    for f in feed:
        ob = f['observation']
        shim = f['shim']
        if earliest + ONE_DAY < ob[0]: break
        time_diff = ob[0] - earliest
        ob[0] = shim[0] = mock_start + time_diff
        obs.append(ob)
        shims.append(shim)

    factory = accounts[6].deploy(getattr(brownie, 'UniswapV3FactoryMock'))

    IUniswapV3OracleMock = getattr(interface, 'IUniswapV3OracleMock')

    zeroth = "0x0000000000000000000000000000000000000000"
    factory.createPool(zeroth, zeroth)

    mock = IUniswapV3OracleMock(factory.allPools(0))

    mock.loadObservations( obs, shims, { 'from': accounts[0] } )

    breadth = obs[-1][0] - obs[0][0] - 3600

    timestamps = []
    ten_mins = []
    one_hrs = []
    spots = []
    bids = []
    asks = []

    for x in range(0, breadth, 60):

        time = START + x

        print("time", time, "x", x, "breadth", breadth)
        
        brownie.chain.mine(timestamp=time)

        pbnj = .00573

        ob = mock.observe([3600, 600, 1, 0])

        ten_min = 1.0001 ** (( ob[0][3] - ob[0][1] ) / 600)
        one_hr = 1.0001 ** (( ob[0][3] - ob[0][0] ) / 3600)
        spot = 1.0001 ** (( ob[0][3] - ob[0][2] ))
        bid = min(ten_min, one_hr) * math.exp(-pbnj)
        ask = max(ten_min, one_hr) * math.exp(pbnj)

        timestamps.append(time)
        ten_mins.append(ten_min)
        one_hrs.append(one_hr)
        spots.append(spot)
        bids.append(bid)
        asks.append(ask)

        
    reflected = {
        'timestamp': timestamps,
        'one_hr': one_hrs,
        'ten_min': ten_mins,
        'spot': spots,
        'bids': bids,
        'asks': asks
    }

    mock = {
        'observations': obs,
        'shims': shims
    }

    with open(os.path.normpath(os.path.join(base, path + '_reflected.json')), 'w+') as f:
        json.dump(reflected, f) 

    with open(os.path.normpath(os.path.join(base, path + '_raw_uni_framed.json')), 'w+') as f:
        json.dump(mock, f) 

def main():

    axs_weth_path = '../feeds/univ3_axs_weth'

    dai_weth_path = '../feeds/univ3_dai_weth'

    reflect_feed(dai_weth_path)

    reflect_feed(axs_weth_path)
