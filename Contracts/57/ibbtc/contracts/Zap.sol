// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// unused imports; required for a forced contract compilation
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20, SafeMath} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {AccessControlDefendedBase} from "./common/AccessControlDefended.sol";

import {ISett} from "./interfaces/ISett.sol";
import {IBadgerSettPeak, IByvWbtcPeak} from "./interfaces/IPeak.sol";
import {IbBTC} from "./interfaces/IbBTC.sol";
import {IbyvWbtc} from "./interfaces/IbyvWbtc.sol";

contract Zap is Initializable, Pausable, AccessControlDefendedBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    IBadgerSettPeak public constant settPeak = IBadgerSettPeak(0x41671BA1abcbA387b9b2B752c205e22e916BE6e3);
    IByvWbtcPeak public constant byvWbtcPeak = IByvWbtcPeak(0x825218beD8BE0B30be39475755AceE0250C50627);
    IERC20 public constant ibbtc = IERC20(0xc4E15973E6fF2A35cC804c2CF9D2a1b817a8b40F);
    IERC20 public constant ren = IERC20(0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D);
    IERC20 public constant wbtc = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    IController public constant controller = IController(0x63cF44B2548e4493Fd099222A1eC79F3344D9682);

    struct Pool {
        IERC20 lpToken;
        ICurveFi deposit;
        ISett sett;
    }
    Pool[4] public pools;

    address public governance;

    modifier onlyGovernance() {
        require(governance == msg.sender, "NOT_OWNER");
        _;
    }

    function init(address _governance) initializer external {
        _setGovernance(_governance);
        pools[0] = Pool({ // crvRenWBTC [ ren, wbtc ]
            lpToken: IERC20(0x49849C98ae39Fff122806C06791Fa73784FB3675),
            deposit: ICurveFi(0x93054188d876f558f4a66B2EF1d97d16eDf0895B),
            sett: ISett(0x6dEf55d2e18486B9dDfaA075bc4e4EE0B28c1545)
        });
        pools[1] = Pool({ // crvRenWSBTC [ ren, wbtc, sbtc ]
            lpToken: IERC20(0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3),
            deposit: ICurveFi(0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714),
            sett: ISett(0xd04c48A53c111300aD41190D63681ed3dAd998eC)
        });
        pools[2] = Pool({ // tbtc-sbtcCrv [ tbtc, ren, wbtc, sbtc ]
            lpToken: IERC20(0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd),
            deposit: ICurveFi(0xaa82ca713D94bBA7A89CEAB55314F9EfFEdDc78c),
            sett: ISett(0xb9D076fDe463dbc9f915E5392F807315Bf940334)
        });
        pools[3] = Pool({ // Exclusive to wBTC
            lpToken: wbtc,
            deposit: ICurveFi(0x0),
            sett: ISett(0x4b92d19c11435614CD49Af1b589001b7c08cD4D5) // byvWbtc
        });

        // Since we don't hold any tokens in this contract, we can optimize gas usage in mint calls by providing infinite approvals
        for (uint i = 0; i < pools.length; i++) {
            Pool memory pool = pools[i];
            pool.lpToken.safeApprove(address(pool.sett), uint(-1));
            if (i < 3) {
                ren.safeApprove(address(pool.deposit), uint(-1));
                wbtc.safeApprove(address(pool.deposit), uint(-1));
                IERC20(address(pool.sett)).safeApprove(address(settPeak), uint(-1));
            } else {
                IERC20(address(pool.sett)).safeApprove(address(byvWbtcPeak), uint(-1));
            }
        }
        pools[2].lpToken.safeApprove(address(pools[2].deposit), uint(-1));
    }

    /**
    * @notice Mint ibbtc with wBTC / renBTC
    * @param token wBTC or renBTC address
    * @param amount wBTC or renBTC amount
    * @param poolId 0=crvRenWBTC, 1=crvRenWSBTC, 2=tbtc-sbtcCrv, 3=yvWbtc
    * @param idx Index of the token in the curve pool while adding liquidity; redundant for yvWbtc
    * @param minOut Minimum amount of ibbtc to mint. Use for capping slippage while adding liquidity to curve pool.
    * @return _ibbtc Minted ibbtc amount
    */
    function mint(IERC20 token, uint amount, uint poolId, uint idx, uint minOut)
        external
        defend
        blockLocked
        whenNotPaused
        returns(uint _ibbtc)
    {
        token.safeTransferFrom(msg.sender, address(this), amount);

        Pool memory pool = pools[poolId];
        if (poolId < 3) { // setts
            _addLiquidity(pool.deposit, amount, poolId + 2, idx); // pools are such that the #tokens they support is +2 from their poolId.
            pool.sett.deposit(pool.lpToken.balanceOf(address(this)));
            _ibbtc = settPeak.mint(poolId, pool.sett.balanceOf(address(this)), new bytes32[](0));
        } else if (poolId == 3) { // byvwbtc
            IbyvWbtc(address(pool.sett)).deposit(new bytes32[](0)); // pulls all available
            _ibbtc = byvWbtcPeak.mint(pool.sett.balanceOf(address(this)), new bytes32[](0));
        } else {
            revert("INVALID_POOL_ID");
        }

        require(_ibbtc >= minOut, "INSUFFICIENT_IBBTC"); // used for capping slippage in curve pools
        ibbtc.safeTransfer(msg.sender, _ibbtc);
    }

    /**
    * @dev Add liquidity to curve btc pools
    * @param amount wBTC / renBTC amount
    * @param pool Curve btc pool
    * @param numTokens # supported tokens for the curve pool
    * @param idx Index of the supported token in the curve pool in question
    */
    function _addLiquidity(ICurveFi pool, uint amount, uint numTokens, uint idx) internal {
        if (numTokens == 2) {
            uint[2] memory amounts;
            amounts[idx] = amount;
            pool.add_liquidity(amounts, 0);
        }

        if (numTokens == 3) {
            uint[3] memory amounts;
            amounts[idx] = amount;
            pool.add_liquidity(amounts, 0);
        }

        if (numTokens == 4) {
            uint[4] memory amounts;
            amounts[idx] = amount;
            pool.add_liquidity(amounts, 0);
        }
    }

    /**
    * @notice Calculate the most optimal route and expected ibbtc amount when minting with wBTC / renBtc.
    * @dev Use returned params poolId, idx and bBTC in the call to mint(...)
           The last param `minOut` in mint(...) should be a bit less than the returned bBTC value.
           For instance 0.2% - 1% lesser depending on slippage tolerange.
    * @param amount renBTC amount
    * @return poolId 0=crvRenWBTC, 1=crvRenWSBTC, 2=tbtc-sbtcCrv, 3=byvwbtc
    * @return idx Index of the supported token in the curve pool (poolId). Should be ignored for poolId=3
    * @return bBTC Expected ibbtc. Not for precise calculations. Doesn't factor in (deposit) fee charged by the curve pool / byvwbtc.
    * @return fee Fee being charged by ibbtc system. Denominated in corresponding sett token
    */
    function calcMint(address token, uint amount) external view returns(uint poolId, uint idx, uint bBTC, uint fee) {
        if (token == address(ren)) {
            return calcMintWithRen(amount);
        }
        if (token == address(wbtc)) {
            return calcMintWithWbtc(amount);
        }
        revert("INVALID_TOKEN");
    }

    /**
    * @notice Calculate mint through renWBTC pool route and expected ibbtc amount when minting with renBTC.
    * @dev Use returned params poolId, idx and bBTC in the call to mint(...)
           The last param `minOut` in mint(...) should be a bit more than the returned bBTC value.
           For instance 0.2% - 1% higher depending on slippage tolerange.
    * @param amount renBTC amount
    * @return poolId 0=crvRenWBTC, 1=crvRenWSBTC, 2=tbtc-sbtcCrv
    * @return idx Index of the supported token in the curve pool (poolId)
    * @return bBTC Expected ibbtc. Not for precise calculations. Doesn't factor in fee charged by the curve pool
    * @return fee Fee being charged by ibbtc system. Denominated in corresponding sett token
    */
    function calcMintWithRen(uint amount) public view returns(uint poolId, uint idx, uint bBTC, uint fee) {
        uint _ibbtc;
        uint _fee;

        // poolId=0, idx=0
        (bBTC, fee) = curveLPToIbbtc(0, pools[0].deposit.calc_token_amount([amount,0], true));
    }

    /**
    * @notice Calculate mint through renWBTC pool route and expected ibbtc amount when minting with wBTC.
    * @dev Use returned params poolId, idx and bBTC in the call to mint(...)
           The last param `minOut` in mint(...) should be a bit more than the returned bBTC value.
           For instance 0.2% - 1% higher depending on slippage tolerange.
    * @param amount renBTC amount
    * @return poolId 0=crvRenWBTC, 1=crvRenWSBTC, 2=tbtc-sbtcCrv, 3=byvwbtc
    * @return idx Index of the supported token in the curve pool (poolId). Should be ignored for poolId=3
    * @return bBTC Expected ibbtc. Not for precise calculations. Doesn't factor in (deposit) fee charged by the curve pool / byvwbtc.
    * @return fee Fee being charged by ibbtc system. Denominated in corresponding sett token
    */
    function calcMintWithWbtc(uint amount) public view returns(uint poolId, uint idx, uint bBTC, uint fee) {
        uint _ibbtc;
        uint _fee;

        // poolId=0
        (bBTC, fee) = curveLPToIbbtc(0, pools[0].deposit.calc_token_amount([0,amount], true));
        idx = 1;
    }

    /**
    * @dev Curve LP token amount to expected ibbtc amount
    */
    function curveLPToIbbtc(uint poolId, uint _lp) public view returns(uint bBTC, uint fee) {
        Pool memory pool = pools[poolId];
        uint _sett = _lp.mul(1e18).div(pool.sett.getPricePerFullShare());
        return settPeak.calcMint(poolId, _sett);
    }

    // Redeem Methods

    function redeem(IERC20 token, uint amount, uint poolId, int128 idx, uint minOut)
        external
        defend
        blockLocked
        whenNotPaused
        returns(uint out)
    {
        ibbtc.safeTransferFrom(msg.sender, address(this), amount);

        Pool memory pool = pools[poolId];
        if (poolId < 3) { // setts
            settPeak.redeem(poolId, amount);
            pool.sett.withdrawAll();
            pool.deposit.remove_liquidity_one_coin(pool.lpToken.balanceOf(address(this)), idx, minOut);
        } else if (poolId == 3) { // byvwbtc
            byvWbtcPeak.redeem(amount);
            IbyvWbtc(address(pool.sett)).withdraw(); // withdraws all available
        } else {
            revert("INVALID_POOL_ID");
        }
        out = token.balanceOf(address(this));
        token.safeTransfer(msg.sender, out);
    }

    /**
    * @notice Calculate redeem through renWBTC pool route and expected token amount when redeeming ibbtc.
    * @dev Use returned params poolId, idx and out in the call to redeem(...)
           The last param `redeem` in mint(...) should be a bit less than the returned `out` value.
           For instance 0.2% - 1% lesser depending on slippage tolerange.
    * @param amount ibbtc amount
    * @return poolId 0=crvRenWBTC, 1=crvRenWSBTC, 2=tbtc-sbtcCrv, 3=byvwbtc
    * @return idx Index of the supported token in the curve pool (poolId). Should be ignored for poolId=3
    * @return out Expected amount for token. Not for precise calculations. Doesn't factor in (deposit) fee charged by the curve pool / byvwbtc.
    * @return fee Fee being charged by ibbtc + setts. Denominated in corresponding sett token
    */
    function calcRedeem(address token, uint amount) external view returns(uint poolId, uint idx, uint out, uint fee) {
        if (token == address(ren)) {
            return calcRedeemInRen(amount);
        }
        if (token == address(wbtc)) {
            return calcRedeemInWbtc(amount);
        }
        revert("INVALID_TOKEN");
    }

    /**
    * @notice Calculate redeem through renWBTC pool route and expected renbtc amount when redeeming ibbtc.
    * @dev Use returned params poolId, idx and renAmount in the call to redeem(...)
           The last param `minOut` in redeem(...) should be a bit less than the returned renAmount value.
           For instance 0.2% - 1% lesser depending on slippage tolerange.
    * @param amount ibbtc amount
    * @return poolId 0=crvRenWBTC, 1=crvRenWSBTC, 2=tbtc-sbtcCrv
    * @return idx Index of the supported token in the curve pool (poolId)
    * @return renAmount Expected renBtc. Not for precise calculations. Doesn't factor in fee charged by the curve pool
    * @return fee Fee being charged by ibbtc system. Denominated in corresponding sett token
    */
    function calcRedeemInRen(uint amount) public view returns(uint poolId, uint idx, uint renAmount, uint fee) {
        uint _lp;
        uint _fee;
        uint _ren;

        // poolId=0, idx=0
        (_lp, fee) = ibbtcToCurveLP(0, amount);
        renAmount = pools[0].deposit.calc_withdraw_one_coin(_lp, 0);
    }

    /**
    * @notice Calculate the most optimal route and expected wbtc amount when redeeming ibbtc.
    * @dev Use returned params poolId, idx and wbtc in the call to redeem(...)
           The last param `minOut` in redeem(...) should be a bit less than the returned wbtc value.
           For instance 0.2% - 1% lesser depending on slippage tolerange.
    * @param amount ibbtc amount
    * @return poolId 0=crvRenWBTC, 1=crvRenWSBTC, 2=tbtc-sbtcCrv, 3=byvwbtc
    * @return idx Index of the supported token in the curve pool (poolId)
    * @return wBTCAmount Expected wbtc. Not for precise calculations. Doesn't factor in fee charged by the curve pool
    * @return fee Fee being charged by ibbtc system. Denominated in corresponding sett token
    */
    function calcRedeemInWbtc(uint amount) public view returns(uint poolId, uint idx, uint wBTCAmount, uint fee) {
        uint _lp;
        uint _fee;
        uint _wbtc;

        // poolId=0, idx=0
        (_lp, fee) = ibbtcToCurveLP(0, amount);
        wBTCAmount = pools[0].deposit.calc_withdraw_one_coin(_lp, 1);
        idx = 1;
    }

    function ibbtcToCurveLP(uint poolId, uint bBtc) public view returns(uint lp, uint fee) {
        uint sett;
        uint max;
        (sett,fee,max) = settPeak.calcRedeem(poolId, bBtc);
        Pool memory pool = pools[poolId];
        if (bBtc > max) {
            return (0,fee);
        } else {
            // pesimistically charge 0.5% on the withdrawal.
            // Actual fee might be lesser if the vault keeps keeps a buffer
            uint strategyFee = sett.mul(controller.strategies(pool.lpToken).withdrawalFee()).div(10000);
            lp = sett.sub(strategyFee).mul(pool.sett.getPricePerFullShare()).div(1e18);
            fee = fee.add(strategyFee);
        }
    }

    // Governance controls

    function setGovernance(address _governance) external onlyGovernance {
        _setGovernance(_governance);
    }

    function _setGovernance(address _governance) internal {
        require(_governance != address(0), "NULL_ADDRESS");
        governance = _governance;
    }

    function approveContractAccess(address account) external onlyGovernance {
        _approveContractAccess(account);
    }

    function revokeContractAccess(address account) external onlyGovernance {
        _revokeContractAccess(account);
    }

    function pause() external onlyGovernance {
        _pause();
    }

    function unpause() external onlyGovernance {
        _unpause();
    }
}

interface ICurveFi {
    function add_liquidity(uint[2] calldata amounts, uint min_mint_amount) external;
    function calc_token_amount(uint[2] calldata amounts, bool isDeposit) external view returns(uint);

    function add_liquidity(uint[3] calldata amounts, uint min_mint_amount) external;
    function calc_token_amount(uint[3] calldata amounts, bool isDeposit) external view returns(uint);

    function add_liquidity(uint[4] calldata amounts, uint min_mint_amount) external;
    function calc_token_amount(uint[4] calldata amounts, bool isDeposit) external view returns(uint);

    function remove_liquidity_one_coin(uint _token_amount, int128 i, uint min_amount) external;
    function calc_withdraw_one_coin(uint _token_amount, int128 i) external view returns(uint);
}

interface IStrategy {
    function withdrawalFee() external view returns(uint);
}

interface IController {
    function strategies(IERC20 token) external view returns(IStrategy);
}
