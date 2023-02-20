// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./facades/UniPairLike.sol";
import "./facades/BehodlerLike.sol";
import "./DAO/Governable.sol";
// import "hardhat/console.sol";
import "./ERC677/ERC20Burnable.sol";
import "./facades/FlanLike.sol";
import "./testing/realUniswap/interfaces/IUniswapV2Factory.sol";
import "./facades/AMMHelper.sol";

contract BlackHole {}

///@Title Uniswap V2 helper for managing Flan liquidity on Uniswap V2, Sushiswap and any other compatible AMM
///@author Justin Goro
/**@notice Flan liquidity is boosted on Uniswap (or Sushiswap) via open market operations at the point of a token migration.
  * UniswapHelper handles all the mechanics as well managing a just-in-time (Justin Time?) oracle
 */
contract UniswapHelper is Governable, AMMHelper {
  address limbo;

  struct UniVARS {
    UniPairLike Flan_SCX_tokenPair;
    address behodler;
    address blackHole;
    address flan;
    uint256 divergenceTolerance;
    uint256 minQuoteWaitDuration;
    address DAI;
    uint8 precision; // behodler uses a binary search. The higher this number, the more precise
    IUniswapV2Factory factory;
    uint8 priceBoostOvershoot; //percentage (0-100) for which the price must be overcorrected when strengthened to account for other AMMs
  }

  struct FlanQuote {
    uint256 DaiScxSpotPrice;
    uint256 DaiBalanceOnBehodler;
    uint256 blockProduced;
  }

  /**@dev the Dai SCX price and the Dai balance on Behodler are both sampled twice before a migration can occur. 
  * The two samples have to be spaced a minimum duration and have to be the same values (within an error threshold). The objective here is to make price manipulation untenably expensive for an attacker
  * so that the mining power expended (or the opportunity cost of eth staked) far exceeds the benefit to manipulating Limbo.
  * The assumption of price stability isn't a bug because migrations aren't required to happen frequently. Instead if natural price drift occurs for non malicious reasons,
  * the migration can be reattempted until a period of sufficient calm allows for migration. If a malicious actor injects volatility in order to prevent migration, by the principle
  * of antifragility, they're doing the entire Ethereum ecosystem a service at their own expense.
  */
  FlanQuote[2] public latestFlanQuotes; //0 is latest

  UniVARS VARS;

  //not sure why codebases don't use keyword ether but I'm reluctant to entirely part with that tradition for now.
  uint256 constant EXA = 1e18;

  //needs to be updated for future Martian, Lunar and Venusian blockchains although I suspect Lunar colonies will be very Terracentric because of low time lag.
  uint256 constant year = (1 days * 365);

  /*
    instead of relying on oracles, we simply require snapshots of important 
    prices to be taken at intervals far enough apart.
    If an attacker wishes to overstate or understate a price through market manipulation,
    they'd have to keep it out of equilibrium over the span of the two snapshots or they'd
    have to time the manipulation to happen as the snapshots occur. As a miner,
    they could do this through transaction ordering but they'd have to win two blocks at precise moments
    which is statistically highly unlikely. 
    The snapshot enforcement can be hindered by false negatives. Natural price variation, for instance, but the cost
    of this is just having to snapshot again when the market is calmer. Since migration is not not time sensitive,
    this is a cost worth bearing.
    */
  modifier ensurePriceStability() {
    _ensurePriceStability();
    _;
  }

  modifier onlyLimbo() {
    require(msg.sender == limbo);
    _;
  }

  constructor(address _limbo, address limboDAO) Governable(limboDAO) {
    limbo = _limbo;
    VARS.blackHole = address(new BlackHole());
    VARS.factory = IUniswapV2Factory(address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f));
    VARS.DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
  }

  ///@notice LP tokens minted during migration are discarded.
  function blackHole() public view returns (address) {
    return VARS.blackHole;
  }

  ///@notice Uniswap factory contract
  function setFactory(address factory) public {
    require(block.chainid != 1, "Uniswap factory hardcoded on mainnet");
    VARS.factory = IUniswapV2Factory(factory);
  }

  ///@dev Only for testing: On mainnet Dai has a fixed address.
  function setDAI(address dai) public {
    require(block.chainid != 1, "DAI hardcoded on mainnet");
    VARS.DAI = dai;
  }

  ///@notice main configuration function.
  ///@dev We prefer to use configuration functions rather than a constructor for a number of reasons.
  ///@param _limbo Limbo contract
  ///@param FlanSCXPair The Uniswap flan/SCX pair
  ///@param behodler Behodler AMM
  ///@param flan The flan token
  ///@param divergenceTolerance The amount of price difference between the two quotes that is tolerated before a migration is attempted 
  ///@param minQuoteWaitDuration The minimum duration between the sampling of oracle data used for migration
  ///@param precision In order to query the tokens redeemed by a quantity of SCX, Behodler performs a binary search. Precision refers to the max iterations of the search.
  ///@param priceBoostOvershoot Flan targets parity with Dai. If we set Flan to equal Dai then between migrations, it will always be below Dai. Overshoot gives us some runway by intentionally "overshooting" the price
  function configure(
    address _limbo,
    address FlanSCXPair,
    address behodler,
    address flan,
    uint256 divergenceTolerance,
    uint256 minQuoteWaitDuration,
    uint8 precision,
    uint8 priceBoostOvershoot
  ) public onlySuccessfulProposal {
    limbo = _limbo;
    VARS.Flan_SCX_tokenPair = UniPairLike(FlanSCXPair);
    VARS.behodler = behodler;
    VARS.flan = flan;
    require(divergenceTolerance >= 100, "Divergence of 100 is parity");
    VARS.divergenceTolerance = divergenceTolerance;
    VARS.minQuoteWaitDuration = minQuoteWaitDuration;
    VARS.DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    VARS.precision = precision == 0 ? precision : precision;
    require(priceBoostOvershoot < 100, "Set overshoot to number between 1 and 100.");
    VARS.priceBoostOvershoot = priceBoostOvershoot;
  }

  ///@notice Samples the two values required for migration. Must be called twice before migration can occur.
  function generateFLNQuote() public override {
    latestFlanQuotes[1] = latestFlanQuotes[0];
    (
      latestFlanQuotes[0].DaiScxSpotPrice,
      latestFlanQuotes[0].DaiBalanceOnBehodler
    ) = getLatestFLNQuote();
    latestFlanQuotes[0].blockProduced = block.number;
  }

  function getLatestFLNQuote() internal view returns (uint256 dai_scx, uint256 daiBalanceOnBehodler) {
    uint256 daiToRelease = BehodlerLike(VARS.behodler).withdrawLiquidityFindSCX(
      VARS.DAI,
      10000,
      1 ether,
      VARS.precision
    );
    dai_scx = (daiToRelease * EXA) / (1 ether);

    daiBalanceOnBehodler = IERC20(VARS.DAI).balanceOf(VARS.behodler);
  }

  ///@notice When tokens are migrated to Behodler, SCX is generated. This SCX is used to boost Flan liquidity and nudge the price of Flan back to parity with Dai
  ///@param rectangleOfFairness refers to the quantity of SCX held back to be used for open market Flan stabilizing operations
  ///@dev makes use of price tilting. Be sure to understand the concept of price tilting before trying to understand the final if statement.
  function stabilizeFlan(uint256 rectangleOfFairness) public override onlyLimbo ensurePriceStability returns (uint256 lpMinted) {
    uint256 localSCXBalance = IERC20(VARS.behodler).balanceOf(address(this));

    //SCX transfers incur a 2% fee. Checking that SCX balance === rectangleOfFairness must take this into account.
    //Note that for hardcoded values, this contract can be upgraded through governance so we're not ignoring potential Behodler configuration changes
    require((localSCXBalance * 100) / rectangleOfFairness == 98, "EM");
    rectangleOfFairness = localSCXBalance;

    //get DAI per scx
    uint256 existingSCXBalanceOnLP = IERC20(VARS.behodler).balanceOf(address(VARS.Flan_SCX_tokenPair));
    uint256 finalSCXBalanceOnLP = existingSCXBalanceOnLP + rectangleOfFairness;

    //the DAI value of SCX is the final quantity of Flan because we want Flan to hit parity with Dai.
    uint256 DesiredFinalFlanOnLP = ((finalSCXBalanceOnLP * latestFlanQuotes[0].DaiScxSpotPrice) / EXA);
    address pair = address(VARS.Flan_SCX_tokenPair);
    uint256 existingFlanOnLP = IERC20(VARS.flan).balanceOf(pair);

    if (existingFlanOnLP < DesiredFinalFlanOnLP) {
      uint256 flanToMint = ((DesiredFinalFlanOnLP - existingFlanOnLP) * (100 - VARS.priceBoostOvershoot)) / 100;

      flanToMint = flanToMint == 0 ? DesiredFinalFlanOnLP - existingFlanOnLP : flanToMint;
      FlanLike(VARS.flan).mint(pair, flanToMint);
      IERC20(VARS.behodler).transfer(pair, rectangleOfFairness);
      {
        lpMinted = VARS.Flan_SCX_tokenPair.mint(VARS.blackHole);
      }
    } else {
      uint256 minFlan = existingFlanOnLP / VARS.Flan_SCX_tokenPair.totalSupply();

      FlanLike(VARS.flan).mint(pair, minFlan + 2);
      IERC20(VARS.behodler).transfer(pair, rectangleOfFairness);
      lpMinted = VARS.Flan_SCX_tokenPair.mint(VARS.blackHole);
    }
    //Don't allow future migrations to piggy back off the data collected by recent migrations. Forces attackers to face the same cryptoeconomic barriers each time.
    _zeroOutQuotes();
  }

  ///@notice helper function for converting a desired APY into a flan per second (FPS) statistic
  ///@param minAPY Here APY refers to the dollar value of flan relative to the dollar value of the threshold
  ///@param daiThreshold The DAI value of the target threshold to list on Behodler. Threshold is an approximation of the AVB on Behodler
  function minAPY_to_FPS(
    uint256 minAPY, //divide by 10000 to get percentage
    uint256 daiThreshold
  ) public override view ensurePriceStability returns (uint256 fps) {
    daiThreshold = daiThreshold == 0 ? latestFlanQuotes[0].DaiBalanceOnBehodler : daiThreshold;
    // console.log("DAI threshold %s", daiThreshold);
    uint256 returnOnThreshold = (minAPY * daiThreshold) / 1e4;
    fps = returnOnThreshold / (year);
  }

  ///@notice Buys Flan with a specified token, apportions 1% of the purchased Flan to the caller and burns the rest.
  ///@param inputToken The token used to buy Flan
  ///@param amount amount of input token used to buy Flan
  ///@param recipient receives 1% of Flan purchased as an incentive to call this function regularly
  ///@dev Assumes a pair for Flan/InputToken exists on Uniswap
  function buyFlanAndBurn(
    address inputToken,
    uint256 amount,
    address recipient
  ) public override {
    address pair = VARS.factory.getPair(inputToken, VARS.flan);

    uint256 flanBalance = IERC20(VARS.flan).balanceOf(pair);
    uint256 inputBalance = IERC20(inputToken).balanceOf(pair);

    uint256 amountOut = getAmountOut(amount, inputBalance, flanBalance);
    uint256 amount0Out = inputToken < VARS.flan ? 0 : amountOut;
    uint256 amount1Out = inputToken < VARS.flan ? amountOut : 0;
    IERC20(inputToken).transfer(pair, amount);
    UniPairLike(pair).swap(amount0Out, amount1Out, address(this), "");
    uint256 reward = (amountOut / 100);
    ERC20Burnable(VARS.flan).transfer(recipient, reward);
    ERC20Burnable(VARS.flan).burn(amountOut - reward);
  }

  function getAmountOut(
    uint256 amountIn,
    uint256 reserveIn,
    uint256 reserveOut
  ) internal pure returns (uint256 amountOut) {
    uint256 amountInWithFee = amountIn * 997;
    uint256 numerator = amountInWithFee * reserveOut;
    uint256 denominator = reserveIn * 1000 + amountInWithFee;
    amountOut = numerator / denominator;
  }

  function getAmountIn(
    uint256 amountOut,
    uint256 reserveIn,
    uint256 reserveOut
  ) internal pure returns (uint256 amountIn) {
    uint256 numerator = reserveIn * amountOut * 1000;
    uint256 denominator = (reserveOut - amountOut) * 997;
    amountIn = (numerator / denominator) + 1;
  }

  function _zeroOutQuotes() internal {
    delete latestFlanQuotes[0];
    delete latestFlanQuotes[1];
  }

  //the purpose of the divergence code is to bring the robustness of a good oracle without requiring an oracle
  function _ensurePriceStability() internal view {
    FlanQuote[2] memory localFlanQuotes; //save gas
    localFlanQuotes[0] = latestFlanQuotes[0];
    localFlanQuotes[1] = latestFlanQuotes[1];

    uint256 daiSCXSpotPriceDivergence = localFlanQuotes[0].DaiScxSpotPrice > localFlanQuotes[1].DaiScxSpotPrice
      ? (localFlanQuotes[0].DaiScxSpotPrice * 100) / localFlanQuotes[1].DaiScxSpotPrice
      : (localFlanQuotes[1].DaiScxSpotPrice * 100) / localFlanQuotes[0].DaiScxSpotPrice;

    uint256 daiBalanceDivergence = localFlanQuotes[0].DaiBalanceOnBehodler > localFlanQuotes[1].DaiBalanceOnBehodler
      ? (localFlanQuotes[0].DaiBalanceOnBehodler * 100) / localFlanQuotes[1].DaiBalanceOnBehodler
      : (localFlanQuotes[1].DaiBalanceOnBehodler * 100) / localFlanQuotes[0].DaiBalanceOnBehodler;

    // console.log("dai balance divergence %s", daiBalanceDivergence);
    require(
      daiSCXSpotPriceDivergence < VARS.divergenceTolerance && daiBalanceDivergence < VARS.divergenceTolerance,
      "EG"
    );

    require(
      localFlanQuotes[0].blockProduced - localFlanQuotes[1].blockProduced > VARS.minQuoteWaitDuration &&
        localFlanQuotes[1].blockProduced > 0,
      "EH"
    );
  }
}
