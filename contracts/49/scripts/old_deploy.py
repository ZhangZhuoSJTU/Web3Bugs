from brownie import *
from brownie import interface
from brownie import\
    OverlayV1UniswapV3Deployer,\
    OverlayV1UniswapV3Factory,\
    OverlayV1UniswapV3Market,\
    OverlayToken,\
    UniswapV3FactoryMock,\
    UniswapV3OracleMock
import brownie
import os 
import json

testers = {
    'jonah': '0x089A180a1fDf7bEF50D1BA45b5456E14f6E44255',
    'jack': '0x8Fac841807E21807F511dAf3C04a34cd78661F4c',
    'mikey': '0x8C959E3536Ce22783bB3E83D96CA2851F442f8af',
    'wesley': '0x860067B16bF47ab580ba90ce3ae3DC03dF124BF7',
    'adam': '0xFde3b96AD8d5F8116c4e646909AFBED4a6104004'
}

deployments = {
    'ovl': '0x754deD0a3518F087D4f1D69FFe57423C5e4794ea',
    'ovl_univ3_deployer': '0xFb7a3449547D97e7518ab68cF003A0De8c4DdEB1',
    'univ3_factory_mock': '0xfD087bF0d465A02935C609109F2d3Fb5B23C7074',
    'univ3_pool_oracle_mock': '0xddf60439641d1fdfeb4d179156abd84f4a725f11',
    'ovl_v1_uni_v3_factory': '0x9b642848aaEeeFFc1caecCD5CC29F394A876a599',
    'ovl_v1_uni_v3_pool': '0x018184e4f0d1760778f53e7675c578ee3fe2e778'
}

def get_mock_data():
    base = os.path.dirname(os.path.abspath(__file__))
    path = 'univ3_mock_feeds_1.json'
    with open(os.path.join(base, path)) as f:
        feeds = json.load(f)
    return feeds

def seed_ovl(ovl_address, people):
    account = accounts.load('tester')
    _from = {'from':account}
    ovl = interface.IOverlayToken(ovl_address);
    supply = 8000000e18
    ovl.mint(account, supply, _from)
    for k, v in people.items():
        ovl.transfer(v, 80000e18, _from)

def add_observations (address: str):

    mock_data = get_mock_data()
    obs = mock_data['UniswapV3: WETH / DAI .3%']['tick_cumulatives']
    chunks = [obs[i:i + 200] for i in range(0, len(obs), 200)]

    uv3_mock = interface.IUniswapV3OracleMock(address)
    total_obs = uv3_mock.observationsLength()
    i = int(total_obs / 200)

    account = accounts.load('tester')

    while i < len(chunks):
        uv3_mock.addObservations(chunks[i], { 'from': account })
        total_obs = uv3_mock.observationsLength()
        i += 1

def deploy_market_from_factory (factory, uv3mock):

    tester = accounts.load('tester')

    factory = Contract(factory)

    market = factory.createMarket(
        uv3mock,
        150,
        5,
        100,
        1e40,
        3293944666953,
        9007199254740992,
        True,
        600,
        1e18,
        { 'from': tester }
    )


def deploy_all ():

    account = accounts.load('tester')
    _from = { 'from': account }

    mock_data = get_mock_data()
    obs = mock_data['UniswapV3: WETH / DAI .3%']['tick_cumulatives']
    chunks = [obs[i:i + 200] for i in range(0, len(obs), 200)]

    ovl = OverlayToken.deploy(_from)
    print("deployed ovl")
    deployer = OverlayV1UniswapV3Deployer.deploy(_from)
    print("deployed univ3 market deployer")

    uv3_factory_mock = UniswapV3FactoryMock.deploy(_from)
    print("deployed univ3 mock factory")

    uv3_factory_mock.createPool(
        "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        600
    );

    print("created mock univ3 pool")

    uv3_mock_addr = uv3_factory_mock.allPools(0)
    uv3_mock = interface.IUniswapV3OracleMock(uv3_mock_addr)
    uv3_mock.addObservations(chunks[0],_from)

    print("seeded mock pool with observations")

    factory = OverlayV1UniswapV3Factory.deploy(
        ovl.address,
        deployer.address,
        uv3_factory_mock.address,
        15,
        5000,
        100,
        account.address,
        60,
        50,
        25,
        _from
    )

    print("deployed overlay v1 uniswap factory")
    ovl.grantRole(ovl.ADMIN_ROLE(), factory.address, _from)

    market = factory.createMarket(
        uv3_mock.address,
        150,
        5,
        100,
        1e40,
        3293944666953,
        9007199254740992,
        True,
        600,
        1e18,
        _from
    )

    print("deployed overlay v1 uniswap market")


def main():
    # seed_ovl_to_people("0x754deD0a3518F087D4f1D69FFe57423C5e4794ea", testers)
    # add_observations(deployments['univ3_pool_oracle_mock'])

    deploy_market_from_factory(
        deployments['ovl_v1_uni_v3_factory'], 
        deployments['univ3_pool_oracle_mock'] 
    )
