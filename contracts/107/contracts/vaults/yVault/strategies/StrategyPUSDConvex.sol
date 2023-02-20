// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../interfaces/ISwapRouter.sol";
import "../../../interfaces/IUniswapV2Router.sol";
import "../../../interfaces/ICurve.sol";
import "../../../interfaces/IBooster.sol";
import "../../../interfaces/IBaseRewardPool.sol";

import "../../../interfaces/IController.sol";
import "../../../interfaces/IFungibleAssetVaultForDAO.sol";

/// @title JPEG'd PUSD Convex autocompounding strategy
/// @notice This strategy autocompounds Convex rewards from the PUSD/USDC/USDT/MIM Curve pool.
/// @dev The strategy deposits either USDC or PUSD in the Curve pool depending on which one has lower liquidity.
/// The strategy sells reward tokens for USDC. If the pool has less PUSD than USDC, this contract uses the
/// USDC {FungibleAssetVaultForDAO} to mint PUSD using USDC as collateral
contract StrategyPUSDConvex is AccessControl {
    using SafeERC20 for IERC20;

    event Harvested(uint256 wantEarned);

    struct Rate {
        uint128 numerator;
        uint128 denominator;
    }

    /// @param booster Convex Booster's address
    /// @param baseRewardPool Convex BaseRewardPool's address
    /// @param pid The Convex pool id for PUSD/USDC/USDT/MIM LP tokens
    struct ConvexConfig {
        IBooster booster;
        IBaseRewardPool baseRewardPool;
        uint256 pid;
    }

    /// @param curve Curve's PUSD/USDC/USDT/MIM pool address
    /// @param usdcIndex The USDC token index in curve's pool
    /// @param pusdIndex The PUSD token index in curve's pool
    struct CurveConfig {
        ICurve curve;
        uint256 usdcIndex;
        uint256 pusdIndex;
    }

    /// @param uniswapV2 The UniswapV2 (or Sushiswap) router address
    /// @param uniswapV3 The UniswapV3 router address
    struct DexConfig {
        IUniswapV2Router uniswapV2;
        ISwapRouter uniswapV3;
    }

    /// @param rewardTokens The Convex reward tokens
    /// @param controller The strategy controller
    /// @param usdcVault The JPEG'd USDC {FungibleAssetVaultForDAO} address
    struct StrategyConfig {
        IERC20[] rewardTokens;
        IController controller;
        IFungibleAssetVaultForDAO usdcVault;
    }

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");

    /// @notice The PUSD/USDC/USDT/MIM Curve LP token
    IERC20 public immutable want;
    IERC20 public immutable jpeg;
    IERC20 public immutable pusd;
    IERC20 public immutable weth;
    IERC20 public immutable usdc;

    DexConfig public dexConfig;
    CurveConfig public curveConfig;
    ConvexConfig public convexConfig;
    StrategyConfig public strategyConfig;

    /// @notice The performance fee to be sent to the DAO/strategists
    Rate public performanceFee;

    /// @notice lifetime strategy earnings denominated in `want` token
    uint256 public earned;

    /// @param _want The PUSD/USDC/USDT/MIM Curve LP token
    /// @param _jpeg The JPEG token address
    /// @param _pusd The PUSD token address
    /// @param _weth The WETH token address
    /// @param _usdc The USDC token address
    /// @param _dexConfig See {DexConfig} struct
    /// @param _curveConfig See {CurveConfig} struct
    /// @param _convexConfig See {ConvexConfig} struct
    /// @param _strategyConfig See {StrategyConfig} struct
    /// @param _performanceFee The rate of USDC to be sent to the DAO/strategists
    constructor(
        address _want,
        address _jpeg,
        address _pusd,
        address _weth,
        address _usdc,
        DexConfig memory _dexConfig,
        CurveConfig memory _curveConfig,
        ConvexConfig memory _convexConfig,
        StrategyConfig memory _strategyConfig,
        Rate memory _performanceFee
    ) {
        require(_want != address(0), "INVALID_WANT");
        require(_jpeg != address(0), "INVALID_JPEG");
        require(_pusd != address(0), "INVALID_PUSD");
        require(_weth != address(0), "INVALID_WETH");
        require(_usdc != address(0), "INVALID_USDC");
        require(
            address(_dexConfig.uniswapV2) != address(0),
            "INVALID_UNISWAP_V2"
        );
        require(
            address(_dexConfig.uniswapV3) != address(0),
            "INVALID_UNISWAP_V3"
        );
        require(address(_curveConfig.curve) != address(0), "INVALID_CURVE");
        require(
            _curveConfig.pusdIndex != _curveConfig.usdcIndex,
            "INVALID_CURVE_INDEXES"
        );
        require(_curveConfig.pusdIndex < 4, "INVALID_PUSD_CURVE_INDEX");
        require(_curveConfig.usdcIndex < 4, "INVALID_USDC_CURVE_INDEX");
        require(
            address(_convexConfig.booster) != address(0),
            "INVALID_CONVEX_BOOSTER"
        );
        require(
            address(_convexConfig.baseRewardPool) != address(0),
            "INVALID_CONVEX_BASE_REWARD_POOL"
        );
        require(
            address(_strategyConfig.controller) != address(0),
            "INVALID_CONTROLLER"
        );
        require(
            address(_strategyConfig.usdcVault) != address(0),
            "INVALID_USDC_VAULT"
        );

        for (uint256 i = 0; i < _strategyConfig.rewardTokens.length; i++) {
            require(
                address(_strategyConfig.rewardTokens[i]) != address(0),
                "INVALID_REWARD_TOKEN"
            );
        }

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        setPerformanceFee(_performanceFee);

        want = IERC20(_want);
        jpeg = IERC20(_jpeg);
        pusd = IERC20(_pusd);
        weth = IERC20(_weth);
        usdc = IERC20(_usdc);

        dexConfig = _dexConfig;
        curveConfig = _curveConfig;
        convexConfig = _convexConfig;
        strategyConfig = _strategyConfig;
    }

    modifier onlyController() {
        require(
            msg.sender == address(strategyConfig.controller),
            "NOT_CONTROLLER"
        );
        _;
    }

    /// @notice Allows the DAO to set the performance fee
    /// @param _performanceFee The new performance fee
    function setPerformanceFee(Rate memory _performanceFee)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _performanceFee.denominator > 0 &&
                _performanceFee.denominator >= _performanceFee.numerator,
            "INVALID_RATE"
        );
        performanceFee = _performanceFee;
    }

    /// @notice Allows the DAO to set the strategy controller
    /// @param _controller The new strategy controller
    function setController(address _controller)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_controller != address(0), "INVALID_CONTROLLER");
        strategyConfig.controller = IController(_controller);
    }

    /// @notice Allows the DAO to set the USDC vault
    /// @param _vault The new USDC vault
    function setUSDCVault(address _vault)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_vault != address(0), "INVALID_USDC_VAULT");
        strategyConfig.usdcVault = IFungibleAssetVaultForDAO(_vault);
    }

    /// @return The strategy's name
    function getName() external pure returns (string memory) {
        return "StrategyPUSDConvex";
    }

    /// @return The amount of `want` tokens held by this contract
    function balanceOfWant() public view returns (uint256) {
        return want.balanceOf(address(this));
    }

    /// @return The amount of `want` tokens deposited in the Convex pool by this contract
    function balanceOfPool() public view returns (uint256) {
        return convexConfig.baseRewardPool.balanceOf(address(this));
    }

    /// @return The amount of JPEG currently held by this contract and the amount of JPEG
    /// rewards available from Convex
    function balanceOfJPEG() external view returns (uint256) {
        uint256 availableBalance = jpeg.balanceOf(address(this));

        IBaseRewardPool baseRewardPool = convexConfig.baseRewardPool;
        uint256 length = baseRewardPool.extraRewardsLength();
        for (uint256 i = 0; i < length; i++) {
            IBaseRewardPool extraReward = IBaseRewardPool(baseRewardPool.extraRewards(i));
            if (address(jpeg) == extraReward.rewardToken()) {
                availableBalance += extraReward.earned();
                //we found jpeg, no need to continue the loop
                break;
            }
        }

        return availableBalance;
    }

    /// @return The total amount of `want` tokens this contract manages (held + deposited)
    function balanceOf() external view returns (uint256) {
        return balanceOfWant() + balanceOfPool();
    }

    /// @notice Allows anyone to deposit the total amount of `want` tokens in this contract into Convex
    function deposit() public {
        uint256 balance = want.balanceOf(address(this));
        ConvexConfig memory convex = convexConfig;
        want.safeIncreaseAllowance(address(convex.booster), balance);
        convex.booster.depositAll(convex.pid, true);
    }

    /// @notice Controller only function that allows to withdraw non-strategy tokens (e.g tokens sent accidentally)
    function withdraw(IERC20 _asset)
        external
        onlyController
        returns (uint256 balance)
    {
        require(want != _asset, "want");
        require(pusd != _asset, "pusd");
        require(usdc != _asset, "usdc");
        require(weth != _asset, "weth");
        require(jpeg != _asset, "jpeg");
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(address(strategyConfig.controller), balance);
    }

    /// @notice Allows the controller to withdraw `want` tokens. Normally used with a vault withdrawal
    /// @param _amount The amount of `want` tokens to withdraw
    function withdraw(uint256 _amount) external onlyController {
        address vault = strategyConfig.controller.vaults(address(want));
        require(vault != address(0), "ZERO_VAULT"); // additional protection so we don't burn the funds

        uint256 balance = want.balanceOf(address(this));
        //if the contract doesn't have enough want, withdraw from Convex
        if (balance < _amount)
            convexConfig.baseRewardPool.withdrawAndUnwrap(
                _amount - balance,
                false
            );

        want.safeTransfer(vault, _amount);
    }

    /// @notice Allows the controller to withdraw all `want` tokens. Normally used when migrating strategies
    /// @return balance The total amount of funds that have been withdrawn
    function withdrawAll() external onlyController returns (uint256 balance) {
        address vault = strategyConfig.controller.vaults(address(want));
        require(vault != address(0), "ZERO_VAULT"); // additional protection so we don't burn the funds

        convexConfig.baseRewardPool.withdrawAllAndUnwrap(false);

        balance = want.balanceOf(address(this));
        want.safeTransfer(vault, balance);
    }

    /// @notice Allows the controller to claim JPEG rewards from Convex
    /// and withdraw JPEG to the `_to` address
    /// @param _to The address to send JPEG to
    function withdrawJPEG(address _to) external onlyController {
        // claim from convex rewards pool
        convexConfig.baseRewardPool.getReward(address(this), true);
        jpeg.safeTransfer(_to, jpeg.balanceOf(address(this)));
    }

    /// @notice Allows members of the `STRATEGIST_ROLE` to compound Convex rewards into Curve
    /// @param minOutCurve The minimum amount of `want` tokens to receive
    function harvest(uint256 minOutCurve) external onlyRole(STRATEGIST_ROLE) {
        convexConfig.baseRewardPool.getReward(address(this), true);

        //Prevent `Stack too deep` errors
        {
            DexConfig memory dex = dexConfig;
            IERC20[] memory rewardTokens = strategyConfig.rewardTokens;
            IERC20 _weth = weth;
            for (uint256 i = 0; i < rewardTokens.length; i++) {
                uint256 balance = rewardTokens[i].balanceOf(address(this));

                if (balance > 0)
                    //minOut is not needed here, we already have it on the Curve deposit
                    _swapUniswapV2(
                        dex.uniswapV2,
                        rewardTokens[i],
                        _weth,
                        balance,
                        0
                    );
            }

            uint256 wethBalance = _weth.balanceOf(address(this));
            require(wethBalance > 0, "NOOP");

            //handle sending jpeg here

            _weth.safeIncreaseAllowance(address(dex.uniswapV3), wethBalance);

            //minOut is not needed here, we already have it on the Curve deposit
            ISwapRouter.ExactInputParams memory params = ISwapRouter
                .ExactInputParams(
                    abi.encodePacked(weth, uint24(500), usdc),
                    address(this),
                    block.timestamp,
                    wethBalance,
                    0
                );

            dex.uniswapV3.exactInput(params);
        }

        StrategyConfig memory strategy = strategyConfig;
        CurveConfig memory curve = curveConfig;

        uint256 usdcBalance = usdc.balanceOf(address(this));

        //take the performance fee
        uint256 fee = (usdcBalance * performanceFee.numerator) /
            performanceFee.denominator;
        usdc.safeTransfer(strategy.controller.feeAddress(), fee);
        usdcBalance -= fee;

        uint256 pusdCurveBalance = curve.curve.balances(curve.pusdIndex);
        //USDC has 6 decimals while PUSD has 18. We need to convert the USDC
        //balance to 18 decimals to compare it with the PUSD balance
        uint256 usdcCurveBalance = curve.curve.balances(curve.usdcIndex) *
            10**12;

        //The curve pool has 4 tokens, we are doing a single asset deposit with either USDC or PUSD
        uint256[4] memory liquidityAmounts = [uint256(0), 0, 0, 0];
        if (usdcCurveBalance > pusdCurveBalance) {
            //if there's more USDC than PUSD in the pool, use USDC as collateral to mint PUSD
            //and deposit it into the Curve pool
            usdc.safeIncreaseAllowance(
                address(strategy.usdcVault),
                usdcBalance
            );
            strategy.usdcVault.deposit(usdcBalance);

            //check the vault's credit limit, it should be 1:1 for USDC
            uint256 toBorrow = strategy.usdcVault.getCreditLimit(usdcBalance);

            strategy.usdcVault.borrow(toBorrow);
            liquidityAmounts[curve.pusdIndex] = toBorrow;

            pusd.safeIncreaseAllowance(address(curve.curve), toBorrow);
        } else {
            //if there's more PUSD than USDC in the pool, deposit USDC
            liquidityAmounts[curve.usdcIndex] = usdcBalance;
            usdc.safeIncreaseAllowance(address(curve.curve), usdcBalance);
        }

        curve.curve.add_liquidity(liquidityAmounts, minOutCurve);

        uint256 wantBalance = balanceOfWant();

        deposit();

        earned += wantBalance;
        emit Harvested(wantBalance);
    }

    /// @dev Swaps `tokenIn` for `tokenOut` on UniswapV2 (or Sushiswap)
    /// @param router The UniswapV2 (or Sushiswap) router
    /// @param tokenIn The input token for the swap
    /// @param tokenOut The output token for the swap
    /// @param amountIn The amount of `tokenIn` to swap
    /// @param minOut The minimum amount of `tokenOut` to receive for the TX not to revert
    function _swapUniswapV2(
        IUniswapV2Router router,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) internal {
        tokenIn.safeIncreaseAllowance(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = address(tokenIn);
        path[1] = address(tokenOut);

        router.swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            address(this),
            block.timestamp
        );
    }
}
