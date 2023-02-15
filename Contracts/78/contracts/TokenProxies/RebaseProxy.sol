// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../facades/TokenProxyLike.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

///@title Rebase Proxy
///@author Justin Goro
/**@notice expresses the balance changes of a rebase token as a fluctuating redeem rate, allowing for balanceOf stability. Useful for dapps which maintain their own balance values
* Very large rebase down movement tokens are still discouraged as this could cause threshold instability.
*/
///@dev TokenProxyRegistry contract maps this token to a base token.
contract RebaseProxy is ERC20, TokenProxyLike {
    constructor(
        address _baseToken,
        string memory name_,
        string memory symbol_
    ) TokenProxyLike(_baseToken) ERC20(name_, symbol_) {}

    function redeemRate() public view returns (uint256) {
        uint256 balanceOfBase = IERC20(baseToken).balanceOf(address(this));
        if (totalSupply() == 0 || balanceOfBase == 0) return ONE;

        return (balanceOfBase * ONE) / totalSupply();
    }

    function mint(address to, uint256 amount)
        public
        override
        returns (uint256)
    {
        uint256 _redeemRate = redeemRate();
        require(
            IERC20(baseToken).transferFrom(msg.sender, address(this), amount)
        );
        uint256 baseBalance = IERC20(baseToken).balanceOf(address(this));
        uint256 proxy = (baseBalance * ONE) / _redeemRate;
        _mint(to, proxy);
    }

    function redeem(address to, uint256 amount)
        public
        override
        returns (uint256)
    {
        uint256 _redeemRate = redeemRate();
        uint256 baseTokens = (_redeemRate * amount) / ONE;
        _burn(msg.sender, amount);
        IERC20(baseToken).transfer(to, baseTokens);
    }
}
