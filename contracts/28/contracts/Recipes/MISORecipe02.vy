# @version 0.2.8

# MVP for preparing a MISO set menu

interface IMISOTokenFactory:
    def deployToken(
        templateId: uint256,        
        intergratorFee: address,
    ) -> address: payable
    def minimumFee() -> uint256: nonpayable

interface ISushiToken:
    def mint(owner: address, amount: uint256) : nonpayable
    def approve(spender: address, amount: uint256) -> bool: nonpayable
    def transfer(to: address, amount: uint256) -> bool: nonpayable
    def balanceOf(owner: address) -> uint256: nonpayable
    def initToken(
        name: String[64],
        symbol: String[32],
        admin: address,
        initialSupply: uint256
    ) : nonpayable

interface IMISOMarket:
    def deployMarket(
        templateId: uint256,
        intergratorFee: address
    ) -> address: payable
    def minimumFee() -> uint256: nonpayable

interface IMISOCrowdsale:
    def initCrowdsale(
        funder: address,
        token: address, 
        paymentCurrency: address,
        tokenSupply: uint256,
        startDate: uint256, 
        endDate: uint256, 
        rate: uint256, 
        goal: uint256, 
        operator: address,
        pointList: address,
        wallet: address
    ) : nonpayable

interface IMISOLauncher:
    def createLiquidityLauncher( 
        templateId: uint256
    ) -> address: nonpayable

interface IPoolLiquidity:
    def initPoolLiquidity(
        accessControls: address,
        token: address,
        WETH: address,
        factory: address,
        owner: address,
        wallet: address,
        deadline: uint256,
        launchwindow: uint256,
        locktime: uint256
    ) : nonpayable
    def getLPTokenAddress() -> address: view

interface IMISOFarmFactory:
    def deployFarm(
        templateId: uint256,
        intergratorFeeAcct: address
    ) -> address: payable
    def minimumFee() -> uint256: nonpayable

interface IMasterChef:
    def initFarm(
        rewards: address,
        rewardsPerBlock: uint256,
        startBlock: uint256,
        devaddr: address,
        accessControls: address
    ) : nonpayable
    def addToken(allocPoint: uint256, lpToken: address, withUpdate: bool) : nonpayable

interface IAdminAccess:
    def hasAdminRole(user: address) -> bool: nonpayable
    def addAdminRole(user: address) : nonpayable
    def removeAdminRole(user: address) : nonpayable


tokenFactory: public(IMISOTokenFactory)
misoMarket: public(IMISOMarket)
weth: public(address)
misoLauncher: public(IMISOLauncher)
farmFactory: public(IMISOFarmFactory)
sushiswapFactory: public(address)


@external
def __init__(
    tokenFactory: address,
    weth: address,
    misoMarket: address,
    misoLauncher: address,
    sushiswapFactory: address, 
    farmFactory: address
):
    """
    @notice Recipe Number 01
    @param tokenFactory - Token Factory that produced fresh new tokens
    @param weth - Wrapped Ethers contract address
    @param misoMarket - Factory that produces a market / auction to sell your tokens
    @param misoLauncher - MISOLauncher is a vault that collects tokens and sends them to SushiSwap
    @param sushiswapFactory - The SushiSwap factory to create new pools
    @param farmFactory - A factory that makes farms that can stake and reward your new tokens
    """

    self.tokenFactory = IMISOTokenFactory(tokenFactory)
    self.weth = weth
    self.misoMarket = IMISOMarket(misoMarket)
    self.misoLauncher = IMISOLauncher(misoLauncher)
    self.sushiswapFactory = sushiswapFactory
    self.farmFactory = IMISOFarmFactory(farmFactory)

@payable 
@external
def prepareMiso(
    name: String[64],
    symbol: String[32],
    accessControl: address,
    tokensToMint: uint256,
    tokensToMarket: uint256,
    paymentCurrency: address, # TODO: hardcode payment currency to ETH?

    startTime: uint256, 
    endTime: uint256,
    marketRate: uint256,
    marketGoal: uint256,
    wallet: address,
    operator: address,

    deadline: uint256,
    launchwindow: uint256, 
    locktime: uint256, 
    tokensToLiquidity: uint256,

    rewardsPerBlock: uint256, 
    startBlock: uint256,
    devAddr: address, 
    tokensToFarm: uint256,
    allocPoint: uint256,
    integratorFeeAccount: address
) -> (address, address, address, address, address):

    assert startTime < endTime  # dev: Start time later then end time
    assert tokensToMint >= tokensToMarket + tokensToLiquidity + tokensToFarm

    tokenFee: uint256 = self.tokenFactory.minimumFee()
    crowdsaleFee: uint256 = self.misoMarket.minimumFee()
    farmFee: uint256 = self.farmFactory.minimumFee()

    assert msg.value >= crowdsaleFee + tokenFee + farmFee

    token: address = self.tokenFactory.deployToken(1, integratorFeeAccount,  value=tokenFee)
    ISushiToken(token).initToken(name, symbol, msg.sender, tokensToMint)

    # GP: create access control

    poolLiquidity: address = self.misoLauncher.createLiquidityLauncher(1)

    IPoolLiquidity(poolLiquidity).initPoolLiquidity(accessControl,
        token,
        self.weth,
        self.sushiswapFactory,
        operator,
        wallet,
        deadline,
        launchwindow,
        locktime
    ) 
    
    ISushiToken(token).transfer(poolLiquidity, tokensToLiquidity)

    crowdsale: address = self.misoMarket.deployMarket(2, integratorFeeAccount, value=crowdsaleFee)

    ISushiToken(token).approve(crowdsale, tokensToMarket)

    IMISOCrowdsale(crowdsale).initCrowdsale(
        self,
        token,
        paymentCurrency, 
        tokensToMarket,
        startTime,
        endTime,
        marketRate,
        marketGoal,
        poolLiquidity,
        ZERO_ADDRESS,
        poolLiquidity
    )

    farm: address = self.farmFactory.deployFarm(1, integratorFeeAccount, value=farmFee)

    IMasterChef(farm).initFarm(
                token,
                rewardsPerBlock,
                startBlock,
                devAddr,
                self)
    
    ISushiToken(token).transfer(farm,tokensToFarm)
    lpToken: address = IPoolLiquidity(poolLiquidity).getLPTokenAddress()
    IMasterChef(farm).addToken(allocPoint, lpToken, False)
    IAdminAccess(farm).addAdminRole(msg.sender)
    assert IAdminAccess(farm).hasAdminRole(msg.sender)
    IAdminAccess(farm).removeAdminRole(self)

    tokensRemaining: uint256 = ISushiToken(token).balanceOf(self)
    if tokensRemaining > 0:
        ISushiToken(token).transfer(wallet, tokensRemaining)

    return (token, crowdsale, lpToken, poolLiquidity, farm)

