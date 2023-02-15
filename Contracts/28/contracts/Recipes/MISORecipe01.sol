pragma solidity 0.6.12;

import "../OpenZeppelin/math/SafeMath.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/IMisoCrowdsale.sol";
import "../interfaces/ISushiToken.sol";
import "../interfaces/IMisoLauncher.sol";

// MVP for preparing a MISO set menu

interface IMISOTokenFactory {
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _templateId, 
        address _admin,
        uint256 _initialSupply
    ) external returns (address token);
}

interface IMISOMarket {
    function createCrowdsale(
        address _token, 
        uint256 _tokenSupply, 
        address _paymentCurrency,
        uint256 _startDate, 
        uint256 _endDate, 
        uint256 _rate, 
        uint256 _goal, 
        address _operator,
        address payable _wallet,
        uint256 _templateId
    ) external returns (address newCrowdsale);
}


interface IPoolLiquidity {
   function initPoolLiquidity(
            address _accessControls,
            address _token,
            address _WETH,
            address _factory,
            address _owner,
            address _wallet,
            uint256 _deadline,
            uint256 _launchwindow,
            uint256 _locktime
    ) external;
    function getLPTokenAddress() external view returns (address);
}

interface IMISOFarmFactory {
    function createFarm(
            address _rewards,
            uint256 _rewardsPerBlock,
            uint256 _startBlock,
            address _devaddr,
            address _accessControls,
            uint256 _templateId
    ) external payable returns (address farm);
}

interface IMasterChef {
    function initFarm(
        address _rewards,
        uint256 _rewardsPerBlock,
        uint256 _startBlock,
        address _devaddr,
        address _accessControls
    ) external; 
    function addToken(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) external;
}

contract MISORecipe01 {

    using SafeMath for uint256;

    IMISOTokenFactory public tokenFactory;
    IMISOMarket public misoMarket;
    IWETH public weth;
    IMisoLauncher public misoLauncher; 
    IMISOFarmFactory public farmFactory;

    address public uniswapFactory;

    /** 
     * @notice Recipe Number 01
     * @param _tokenFactory - Token Factory that produced fresh new tokens
     * @param _weth - Wrapped Ethers contract address
     * @param _misoMarket - Factory that produces a market / auction to sell your tokens
     * @param _misoLauncher - MISOLauncher is a vault that collects tokens and sends them to SushiSwap
     * @param _uniswapFactory - The SushiSwap factory to create new pools
     * @param _farmFactory - A factory that makes farms that can stake and reward your new tokens
    "*/
    constructor(
        address _tokenFactory,
        address _weth,
        address _misoMarket,
        address _misoLauncher,
        address _uniswapFactory,
        address _farmFactory
    ) public {
        tokenFactory = IMISOTokenFactory(_tokenFactory);
        weth = IWETH(_weth);
        misoMarket = IMISOMarket(_misoMarket);
        misoLauncher = IMisoLauncher(_misoLauncher);
        uniswapFactory = _uniswapFactory;
        farmFactory = IMISOFarmFactory(_farmFactory);

    }

    /** 
     * @dev Gateway to prepare a MISO recipe
     *   
    */
    function prepareMiso(
        string calldata _name,
        string calldata _symbol,
        address accessControl
    )
        external payable
    {
        uint256 tokensToMint = 1000;
        uint256 tokensToMarket = 300;
        // Mintable token
        ISushiToken token = ISushiToken(tokenFactory.createToken(_name, _symbol, 1, msg.sender, tokensToMint));

        token.approve(address(misoMarket), tokensToMarket);

        // Scope for adding liquidity
        uint256 templateId = misoLauncher.currentTemplateId(1);
        IPoolLiquidity poolLiquidity = IPoolLiquidity(misoLauncher.createLauncher(templateId,address(token),0,address(0),""));

        {
        address operator = msg.sender;
        address payable wallet = msg.sender;

        uint256 duration = 1000;
        uint256 launchwindow = 100;
        uint256 deadline = 200;
        uint256 locktime = 60;
        uint256 tokensToLiquidity = 1000;

        poolLiquidity.initPoolLiquidity(accessControl,
            address(token),
            address(weth),
            uniswapFactory,
            operator,
            wallet,
            deadline,
            launchwindow,
            locktime); 
        
        token.transfer(address(poolLiquidity),tokensToLiquidity);

        }

        // Scope for creating crowdsale
        {
        uint256 startTime = block.timestamp + 5;
        uint256 endTime = block.timestamp + 100;
        uint256 marketRate = 100;
        uint256 marketGoal = 200;
        address payable wallet = msg.sender;

        IMisoCrowdsale crowdsale = IMisoCrowdsale(misoMarket.createCrowdsale(
            address(token), 
            tokensToMarket, 
            0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE,
            startTime, 
            endTime, 
            marketRate,
            marketGoal, 
            address(poolLiquidity), 
            wallet, 
            2
        ));
        }

        // Scope for creating farm
        {
        address payable devAddr = msg.sender;
        uint256 tokensToFarm = 10;
        IMasterChef farm = IMasterChef(farmFactory.createFarm{value: msg.value}(
                address(token),
                1e18,  // rewardsPerBlock
                block.number + 10, // startBlock
                devAddr,
                accessControl,
                1));

        
        token.transfer(address(farm),tokensToFarm);
        uint256 allocPoint = 10;
        address lpToken = poolLiquidity.getLPTokenAddress();
        farm.addToken(allocPoint, IERC20(lpToken), false);

        }

    }

}