# @version 0.2.8

# 
"""
@title MVP for preparing a MISO set menu
@author chefgonpachi
@notice Use this contract to create a liquidity farm from exisiting tokens
"""

from vyper.interfaces import ERC20

interface IMISOFarmFactory:
    def createFarm(
        rewards: address,
        rewardsPerBlock: uint256,
        startBlock: uint256,
        devaddr: address,
        accessControls: address,
        templateId: uint256
    ) -> address: payable
    def deployFarm(
        templateId: uint256,
        integratorFeeAccount: address
    ) -> address: payable

interface IMasterChef:
    def initFarm(
        rewards: address,
        rewardsPerBlock: uint256,
        startBlock: uint256,
        devaddr: address,
        accessControls: address
    ) : nonpayable
    def addToken(allocPoint: uint256, lpToken: address, withUpdate: bool) : nonpayable

interface ISushiToken:
    def mint(owner: address, amount: uint256) : nonpayable
    def approve(spender: address, amount: uint256) -> bool: nonpayable
    def transfer(to: address, amount: uint256) -> bool: nonpayable

interface Factory:
    def getPair(tokenA: address, tokenB: address) -> address: view
    def createPair(tokenA: address, tokenB: address) -> address: nonpayable

interface IMISOAccess:
    def hasAdminRole(addr: address) -> bool: view
    def addAdminRole(addr: address) : nonpayable
    def removeAdminRole(addr: address) : nonpayable


weth: public(address)
farmFactory: public(IMISOFarmFactory)
sushiswapFactory: public(address)


@external
def __init__(
    weth: address,
    sushiswapFactory: address, 
    farmFactory: address
):
    """
    @notice Recipe Number 03 - Takes an existing token and creates a liquidity farm
    @param weth - Wrapped Ethers contract address
    @param sushiswapFactory - The SushiSwap factory to create new pools
    @param farmFactory - A factory that makes farms that can stake and reward your new tokens
    """

    self.weth = weth
    self.sushiswapFactory = sushiswapFactory
    self.farmFactory = IMISOFarmFactory(farmFactory)

@payable
@external
def createLiquidityFarm(

    rewardToken: address,
    tokensToFarm: uint256,
    rewardsPerBlock: uint256, 
    startBlock: uint256,
    devAddr: address, 
    allocPoint: uint256,
    admin: address

) -> (address): 
    """
    @notice Creates a farm for rewarding liquidity with WETH backed SLP tokens 
    @param rewardToken - Rewards token address 
    @param rewardsPerBlock - Rewards per block for the whole farm
    @param startBlock - Starting block
    @param devAddr - Any donations if set are sent here 
    @param tokensToFarm - Total amount of tokens to be sent to the farm as rewards
    @param allocPoint - Initial weighting of the lp token. Set relative to additional pools
    """

    assert (block.number < startBlock) # dev: Start time later then end time
    assert ERC20(rewardToken).transferFrom(msg.sender, self, tokensToFarm)

    pair: address = Factory(self.sushiswapFactory).getPair(rewardToken, self.weth)
    if pair == ZERO_ADDRESS:
        pair = Factory(self.sushiswapFactory).createPair(rewardToken, self.weth)
    
    farm: address = self.farmFactory.deployFarm(1, msg.sender)

    IMasterChef(farm).initFarm(
                rewardToken,
                rewardsPerBlock,
                startBlock,
                devAddr,
                self)
    

    ISushiToken(rewardToken).transfer(farm,tokensToFarm)
    IMasterChef(farm).addToken(allocPoint, pair, False)
    IMISOAccess(farm).addAdminRole(admin)
    assert IMISOAccess(farm).hasAdminRole(admin) == True
    IMISOAccess(farm).removeAdminRole(self)

    return (farm)



    
@external
def createTokenFarm(

    rewardToken: address,
    tokensToFarm: uint256,
    rewardsPerBlock: uint256, 
    startBlock: uint256,
    devAddr: address, 

    stakedToken: address,
    allocPoint: uint256,

    # to create in recipe
    accessControl: address

) -> (address):
    """
    @notice Creates a farm for rewarding tokens for staking a different token 
    @param rewardToken - Rewards token address 
    @param rewardsPerBlock - Rewards per block for the whole farm
    @param startBlock - Starting block
    @param devAddr - Any donations if set are sent here 
    @param tokensToFarm - Total amount of tokens to be sent to the farm as rewards
    @param allocPoint - Initial weighting of the lp token. Set relative to additional pools
    """

    assert (block.number < startBlock)  # dev: Start time later then end time
    assert ERC20(rewardToken).transferFrom(msg.sender, self, tokensToFarm)

    # create access control
    # transfer ownership to msg.sender
    farm: address = self.farmFactory.deployFarm(1, msg.sender)

    IMasterChef(farm).initFarm(
                rewardToken,
                rewardsPerBlock,
                startBlock,
                devAddr,
                self)

    ISushiToken(rewardToken).transfer(farm,tokensToFarm)
    # IMasterChef(farm).addToken(allocPoint, stakedToken, False)

    return (farm)

