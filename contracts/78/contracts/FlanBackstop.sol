// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./facades/FlanLike.sol";
import "./facades/PyroTokenLike.sol";
import "./DAO/Governable.sol";
import "./ERC677/ERC20Burnable.sol";
import "./facades/UniPairLike.sol";
import "hardhat/console.sol";

///@title FlanBackstop (placeholder name)
///@author Justin Goro
/**
 * @notice Initially Flan's liquidity may be fairly low, limiting Limbo's ability to reward souls. Flan backstop accepts stablecoins in return for minting Pyroflan.
 *Under the hood a smaller quantity of Flan is minted and paired with the stablecoin in Uniswap in order to tilt the price of Flan higher while incresaing liquidity.
 * The same operation is performed with PyroFlan
 * The calling user then receives PyroFlan equal in value to the intial amount sent in but at the new price. A small premium is added.
 * The incentives facing the user: mint $X of PyroFlan with <$X of stablecoin, stake PyroFlan in Limbo for high APY, do not immediately dump because PyroFlan increases in value and because of 2% exit fee.
 * The incentives should be enough to encourage a gradual increase in pooled Flan and stablecoins, creating some minting runway for Limbo to accelerate.
 * In the future when Flan and Limbo are thriving and Flan is listed on Curve, we can create a version of this for Curve and Uniswap V3 in order to concentrate Flan liquidity and further cement stablecoin status.
 * Note: in this version, LP tokens generated are cast into the void. The argument of keeping them for fee revenue is negated by the impact on Flan. It would just be taking from Peter to give to Paul. 
 */
///@dev This contract uses Pyrotokens3. At the time of authoring, Pyrotokens3 implementation is incomplete and not fully tested but the interface (ABI) is locked.
contract FlanBackstop is Governable {
  /**
   *@param dao LimboDAO
   *@param flan Flan address
   *@param pyroFlan PyroFlan address
   */
  constructor(
    address dao,
    address flan,
    address pyroFlan
  ) Governable(dao) {
    config.pyroFlan = pyroFlan;
    config.flan = flan;
    IERC20(flan).approve(pyroFlan, 2**256 - 1);
  }

  struct ConfigVars {
    address flan;
    address pyroFlan;
    mapping(address => address) flanLPs;
    mapping(address => address) pyroFlanLPs;
    mapping(address => uint256) acceptableHighestPrice; //Highest tolerated Flan per stable
    mapping(address => uint8) decimalPlaces; //USDC and USDT have 6 decimal places because large stablecoin transfers are exactly where you'd like to find accidental bugs
  }

  ConfigVars public config;

  /**
   *@param stablecoin One of the popular stablecoins such as USDC, USDT, MIM, OUSD etc.
   *@param flanLP Uniswap V2 (or a fork such as Sushi) flan/Stablecoin LP
   *@param pyroFlanLP Uniswap V2 (or a fork such as Sushi) pyroFlan/Stablecoin LP
   *@param acceptableHighestPrice Since the prices are being read from balances, not oracles, the opportunity for price manipulation through flash loans exists. The community can put a circuit breaker in place to prevent such an exploit.
   *@param decimalPlaces USDT and USDC do not conform to common ERC20 practice. 
   */
  function setBacker(
    address stablecoin,
    address flanLP,
    address pyroFlanLP,
    uint256 acceptableHighestPrice,
    uint8 decimalPlaces
  ) external onlySuccessfulProposal {
    config.flanLPs[stablecoin] = flanLP;
    config.pyroFlanLPs[stablecoin] = pyroFlanLP;
    config.acceptableHighestPrice[stablecoin] = acceptableHighestPrice;
    config.decimalPlaces[stablecoin] = decimalPlaces;
  }

  /**
  *@notice takes in a stablecoin, mints flan and pyroFlan and pairs with stablecoin in a Uniswap Pair to generate liquidity
   *@param stablecoin Stablecoin with which to purchase
   *@param amount amount in stablecoin wei units.
   */
  function purchasePyroFlan(address stablecoin, uint256 amount) external {
    uint normalizedAmount = normalize(stablecoin, amount);
    address flanLP = config.flanLPs[stablecoin];
    address pyroFlanLP = config.pyroFlanLPs[stablecoin];
    require(flanLP != address(0) && pyroFlanLP != address(0), "BACKSTOP: configure stablecoin");

    uint256 balanceOfFlanBefore = IERC20(config.flan).balanceOf(flanLP);
    uint256 balanceOfStableBefore = IERC20(stablecoin).balanceOf(flanLP);
    uint256 priceBefore = (balanceOfFlanBefore * getMagnitude(stablecoin)) / balanceOfStableBefore;

    //Price tilt pairs and mint liquidity
    FlanLike(config.flan).mint(address(this), normalizedAmount / 2);
    IERC20(config.flan).transfer(flanLP, normalizedAmount / 4);
    IERC20(stablecoin).transferFrom(msg.sender, flanLP, amount / 2);

    UniPairLike(flanLP).mint(address(this));
    uint256 redeemRate = PyroTokenLike(config.pyroFlan).redeemRate();
    PyroTokenLike(config.pyroFlan).mint(pyroFlanLP, normalizedAmount / 4);
    redeemRate = PyroTokenLike(config.pyroFlan).redeemRate();
    redeemRate = PyroTokenLike(config.pyroFlan).redeemRate();
    IERC20(stablecoin).transferFrom(msg.sender, pyroFlanLP, amount / 2);
    UniPairLike(pyroFlanLP).mint(address(this));

    uint256 balanceOfFlan = IERC20(config.flan).balanceOf(flanLP);
    uint256 balanceOfStable = IERC20(stablecoin).balanceOf(flanLP);

    uint256 tiltedPrice = (balanceOfFlan * getMagnitude(stablecoin)) / balanceOfStable;
    require(tiltedPrice < config.acceptableHighestPrice[stablecoin], "BACKSTOP: potential price manipulation");
    uint256 growth = ((priceBefore - tiltedPrice) * 100) / priceBefore;

    uint256 flanToMint = (tiltedPrice * normalizedAmount) / (1 ether);

    //share some price tilting with the user to incentivize minting: The larger the purchase, the better the return
    uint256 premium = (flanToMint * (growth / 2)) / 100;

    FlanLike(config.flan).mint(address(this), flanToMint + premium);
    redeemRate = PyroTokenLike(config.pyroFlan).redeemRate();
    PyroTokenLike(config.pyroFlan).mint(msg.sender, flanToMint + premium);
    redeemRate = PyroTokenLike(config.pyroFlan).redeemRate();
  }

  function getMagnitude(address token) internal view returns (uint256) {
    uint256 places = config.decimalPlaces[token];
    return 10**places;
  }

  function normalize(address token, uint256 amount) internal view returns (uint256) {
    uint256 places = config.decimalPlaces[token];
    uint256 bump = 10**(18 - places);
    return amount * bump;
  }
}
