// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "./GERC20.sol";
import "../common/Constants.sol";
import "../common/Whitelist.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IController.sol";
import "../interfaces/IERC20Detailed.sol";
import "../interfaces/IToken.sol";

/// @notice Base contract for gro protocol tokens - The Gro token specifies some additional functionality
///     shared by both tokens (Rebasing, NonRebasing).
///     - Factor:
///         The GToken factor. The two tokens are associated with a factor that controls their price (NonRebasing),
///         or their amount (Rebasing). The factor is defined by the totalSupply / total assets lock in token.
///     - Base:
///         The base amount of minted tokens, this affects the Rebasing token as the totalSupply is defined by:
///         BASE amount / factor
///     - Total assets:
///         Total assets is the dollarvalue of the underlying assets used to mint Gtokens. The Gtoken
///         depends on an external contract (Controller.sol) to get this value (retrieved from PnL calculations)
abstract contract GToken is GERC20, Constants, Whitelist, IToken {
    uint256 public constant BASE = DEFAULT_DECIMALS_FACTOR;

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IController public ctrl;

    constructor(string memory name, string memory symbol) public GERC20(name, symbol, DEFAULT_DECIMALS) {}

    function setController(address controller) external onlyOwner {
        ctrl = IController(controller);
    }

    function factor() public view override returns (uint256) {
        return factor(totalAssets());
    }

    function applyFactor(
        uint256 a,
        uint256 b,
        bool base
    ) internal pure returns (uint256 resultant) {
        uint256 _BASE = BASE;
        uint256 diff;
        if (base) {
            diff = a.mul(b) % _BASE;
            resultant = a.mul(b).div(_BASE);
        } else {
            diff = a.mul(_BASE) % b;
            resultant = a.mul(_BASE).div(b);
        }
        if (diff >= 5E17) {
            resultant = resultant.add(1);
        }
    }

    function factor(uint256 totalAssets) public view override returns (uint256) {
        if (totalSupplyBase() == 0) {
            return getInitialBase();
        }

        if (totalAssets > 0) {
            return totalSupplyBase().mul(BASE).div(totalAssets);
        }

        // This case is totalSupply > 0 && totalAssets == 0, and only occurs on system loss
        return 0;
    }

    function totalAssets() public view override returns (uint256) {
        return ctrl.gTokenTotalAssets();
    }

    function getInitialBase() internal pure virtual returns (uint256) {
        return BASE;
    }
}
