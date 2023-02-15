// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/Stabilize.sol";

contract MockzpaToken is ERC20, IZPAToken {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 constant divisionFactor = 100000;

    address public override underlyingAsset;
    uint256 public override initialFee = 1000; // 1000 = 1%, 100000 = 100%, max fee restricted in contract is 10%
    uint256 public override endFee = 100; // 100 = 0.1%
    uint256 public override feeDuration = 604800; // The amount of seconds it takes from the initial to end fee

    // Info of each user.
    struct UserInfo {
        uint256 depositTime; // The time the user made a deposit, every deposit resets the time
    }

    mapping(address => UserInfo) private userInfo;

    constructor(
        string memory _name,
        string memory _symbol,
        address _underlyingAsset
    )
        public
        ERC20(_name, _symbol)
    {
        underlyingAsset = _underlyingAsset;
    }

    function deposit(uint256 _amount) external override {
        uint256 _toMint = _amount.mul(1e18).div(pricePerToken());
        IERC20(underlyingAsset).safeTransferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _toMint);
        userInfo[_msgSender()].depositTime = block.timestamp; // Update the deposit time
    }

    function redeem(uint256 _amount) external override {
        uint256 _underlyingAmount = _amount.mul(pricePerToken()).div(1e18);
        _burn(msg.sender, _amount);

        // Pay fee upon withdrawing
        if (userInfo[_msgSender()].depositTime == 0) {
            // The user has never deposited here
            userInfo[_msgSender()].depositTime = block.timestamp; // Give them the max fee
        }

        uint256 feeSubtraction = initialFee.sub(endFee).mul(block.timestamp.sub(userInfo[_msgSender()].depositTime)).div(feeDuration);
        if (feeSubtraction > initialFee.sub(endFee)) {
            // Cannot reduce fee more than this
            feeSubtraction = initialFee.sub(endFee);
        }
        uint256 fee = initialFee.sub(feeSubtraction);
        fee = _underlyingAmount.mul(fee).div(divisionFactor);
        _underlyingAmount = _underlyingAmount.sub(fee);

        // Now withdraw this amount to the user and send fee to treasury
        IERC20(underlyingAsset).safeTransfer(msg.sender, _underlyingAmount);
        IERC20(underlyingAsset).safeTransfer(DEAD, fee);
    }

    function pricePerToken() public view override returns (uint256) {
        return 2e18;
    }
}
