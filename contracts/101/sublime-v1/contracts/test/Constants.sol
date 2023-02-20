// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

library Constants {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address constant wethGateway = 0xcc9a0B7c43DC2a5F023Bb9b738E45B0Ef6B06E04;
    address constant aaveProtocolDataProvider = 0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d;
    address constant aaveLendingPoolAddressesProvider = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;

    // Price feed addresses
    // We'll be creating price feeds for:-
    // 1. WETH / USDC
    // 2. WBTC / WETH
    // 3. WBTC / DAI
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address constant SHIB = 0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE;
    address constant BAT = 0x0D8775F648430679A709E98d2b0Cb6250d2887EF;

    // Chainlink base feeds against USD
    address constant ETH_priceFeedChainlink = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant WBTC_priceFeedChainlink = 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c;
    address constant DAI_priceFeedChainlink = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
    address constant USDC_priceFeedChainlink = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;

    address constant USDC_ETH_priceFeedUniswap = 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640;
    address constant WBTC_WETH_priceFeedUniswap = 0xCBCdF9626bC03E24f779434178A73a0B4bad62eD;
    address constant WBTC_DAI_priceFeedUniswap = 0x391E8501b626C623d39474AfcA6f9e46c2686649; //has low liquidity

    address public constant ethUsdcPool = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;

    IERC20 constant dai = IERC20(DAI);
    IERC20 constant usdc = IERC20(USDC);
    IERC20 constant weth = IERC20(WETH);
    IERC20 constant wbtc = IERC20(WBTC);
    IERC20 constant shib = IERC20(SHIB);

    uint256 constant USD_decimals = 10**6; // USDC precision decimals
    uint256 constant BTC_decimals = 10**8; // WBTC precision decimals
    uint256 constant DAI_decimals = 10**18; // DAI precision decimals
    uint256 constant WETH_decimals = 10**18; // WETH precision decimals
    uint256 constant SHIB_decimals = 10**18; // SHIB precision decimals

    uint256 constant WAD = 10**18;
    uint256 constant RAY = 10**27;

    uint256 constant verificationActivationDelay = 0;
    uint256 public constant maxStrategies = 10;

    address public constant COMPTROLLER = 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B;
    address public constant cETH = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;
    address public constant cUSDC = 0x39AA39c021dfbaE8faC545936693aC917d5E7563;
    address public constant cDAI = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;
    address public constant cWBTC = 0xccF4429DB6322D5C611ee964527D42E5d685DD6a;

    address public constant weth9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant _wethGateway = 0xcc9a0B7c43DC2a5F023Bb9b738E45B0Ef6B06E04;
    address public constant _protocolDataProvider = 0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d;
    address public constant _lendingPoolAddressesProvider = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
    address public constant _treasuryAddress = 0xC055b964a32B8275F41A1521fA9A4AbfE0eC5F09;

    uint128 public constant CHAINLINK_HEARTBEAT = type(uint128).max;
}
