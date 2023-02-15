// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IERC20Metadata.sol";
import "./interfaces/ITreasury.sol";
import "./Ownable.sol";

contract Treasury is Ownable, ITreasury {
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    event SetBondContract(address bond, bool approved);
    event Withdraw(address indexed token, address indexed destination, uint amount);

    uint8 private immutable PAYOUT_TOKEN_DECIMALS;

    address public immutable payoutToken;
    mapping(address => bool) public isBondContract;

    constructor(address _payoutToken) {
        require(_payoutToken != address(0), "payout token = zero");
        payoutToken = _payoutToken;
        PAYOUT_TOKEN_DECIMALS = IERC20Metadata(_payoutToken).decimals();
    }

    modifier onlyBondContract() {
        require(isBondContract[msg.sender], "not bond");
        _;
    }

    /**
     *  @notice deposit principal token and recieve back payout token
     *  @param _principalToken address
     *  @param _principalAmount uint
     *  @param _payoutAmount uint
     */
    function deposit(
        address _principalToken,
        uint _principalAmount,
        uint _payoutAmount
    ) external override onlyBondContract {
        IERC20(_principalToken).safeTransferFrom(msg.sender, address(this), _principalAmount);
        IERC20(payoutToken).safeTransfer(msg.sender, _payoutAmount);
    }

    /**
     *   @notice returns payout token valuation of priciple
     *   @param _principalToken address
     *   @param _amount uint
     *   @return value uint
     */
    function valueOfToken(address _principalToken, uint _amount) external view override returns (uint value) {
        // convert amount to match payout token decimals
        value = _amount.mul(10**PAYOUT_TOKEN_DECIMALS).div(10**IERC20Metadata(_principalToken).decimals());
    }

    /**
     *  @notice owner can withdraw ERC20 token to desired address
     *  @param _token uint
     *  @param _destination address
     *  @param _amount uint
     */
    function withdraw(
        address _token,
        address _destination,
        uint _amount
    ) external onlyOwner {
        IERC20(_token).safeTransfer(_destination, _amount);
        emit Withdraw(_token, _destination, _amount);
    }

    /**
     *  @notice set bond contract
     *  @param _bond address
     *  @param _approve bool
     */
    function setBondContract(address _bond, bool _approve) external onlyOwner {
        require(isBondContract[_bond] != _approve, "no change");
        isBondContract[_bond] = _approve;
        emit SetBondContract(_bond, _approve);
    }
}
