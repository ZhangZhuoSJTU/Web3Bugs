// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IERC20Upgradeable.sol";
import "./ERC20Upgradeable.sol";
import "../util/OwnableUpgradeable.sol";
// import "../interface/INFTXVaultFactory.sol";

// interface INFTXInventoryStaking {
//     function nftxVaultFactory() external view returns (INFTXVaultFactory);
// }

// SushiBar is the coolest bar in town. You come in with some Sushi, and leave with more! The longer you stay, the more Sushi you get.
//
// This contract handles swapping to and from xSushi, SushiSwap's staking token.
contract XTokenUpgradeable is OwnableUpgradeable, ERC20Upgradeable {
    IERC20Upgradeable public baseToken;
    mapping(address => uint256) internal timelock;

    event Timelocked(address user, uint256 until);

    function __XToken_init(address _baseToken, string memory name, string memory symbol) public initializer {
        __Ownable_init();
        // string memory _name = INFTXInventoryStaking(msg.sender).nftxVaultFactory().vault();
        __ERC20_init(name, symbol);
        baseToken = IERC20Upgradeable(_baseToken);
    }

    // Needs to be called BEFORE new base tokens are deposited.
    function mintXTokens(address account, uint256 _amount, uint256 timelockLength) external onlyOwner returns (uint256) {
        // Gets the amount of Base Token locked in the contract
        uint256 totalBaseToken = baseToken.balanceOf(address(this));
        // Gets the amount of xTokens in existence
        uint256 totalShares = totalSupply();
        // If no xTokens exist, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalBaseToken == 0) {
            _timelockMint(account, _amount, timelockLength);
            return _amount;
        }
        // Calculate and mint the amount of xTokens the base tokens are worth. The ratio will change overtime, as xTokens are burned/minted and base tokens deposited + gained from fees / withdrawn.
        else {
            uint256 what = (_amount * totalShares) / totalBaseToken;
            _timelockMint(account, what, timelockLength);
            return what;
        }
    }

    function burnXTokens(address who, uint256 _share) external onlyOwner returns (uint256) {
        // Gets the amount of xToken in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of base tokens the xToken is worth
        uint256 what = (_share * baseToken.balanceOf(address(this))) / totalShares;
        _burn(who, _share);
        baseToken.transfer(who, what);
        return what;
    }

    function timelockAccount(address account , uint256 timelockLength) public onlyOwner virtual {
        uint256 timelockFinish = block.timestamp + timelockLength;
        timelock[account] = timelockFinish;
        emit Timelocked(account, timelockFinish);
    }

    function _burn(address who, uint256 amount) internal override {
        require(block.timestamp > timelock[who], "User locked");
        super._burn(who, amount);
    }

    function timelockUntil(address account) public view returns (uint256) {
        return timelock[account];
    }

    function _timelockMint(address account, uint256 amount, uint256 timelockLength) internal virtual {
        uint256 timelockFinish = block.timestamp + timelockLength;
        timelock[account] = timelockFinish;
        emit Timelocked(account, timelockFinish);
        _mint(account, amount);
    }
    
    function _transfer(address from, address to, uint256 value) internal override {
        require(block.timestamp > timelock[from], "User locked");
        super._transfer(from, to, value);
    }
}