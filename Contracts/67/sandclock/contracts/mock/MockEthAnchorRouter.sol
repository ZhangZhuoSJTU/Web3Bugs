// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../strategy/anchor/IEthAnchorRouter.sol";

contract MockEthAnchorRouter is IEthAnchorRouter {
    using SafeERC20 for IERC20;

    IERC20 public ustToken;
    IERC20 public aUstToken;

    address public pendingOperator;
    mapping(address => uint256) public depositOperations;
    mapping(address => uint256) public redeemOperations;
    mapping(address => uint256) public depositFinishResults;
    mapping(address => uint256) public redeemFinishResults;

    constructor(IERC20 _ustToken, IERC20 _aUstToken) {
        require(address(_ustToken) != address(0), "invalid UST token");
        require(address(_aUstToken) != address(0), "invalid aUST token");

        ustToken = _ustToken;
        aUstToken = _aUstToken;
    }

    function addPendingOperator(address _operator) external {
        require(_operator != address(0), "invalid operator");

        pendingOperator = _operator;
    }

    function initDepositStable(uint256 _amount)
        external
        override(IEthAnchorRouter)
        returns (address operator)
    {
        require(pendingOperator != address(0));
        ustToken.safeTransferFrom(msg.sender, address(this), _amount);
        depositOperations[pendingOperator] = _amount;
        operator = pendingOperator;
        pendingOperator = address(0);
    }

    function notifyDepositResult(address _operation, uint256 _amount) external {
        require(depositOperations[_operation] > 0);
        aUstToken.safeTransferFrom(msg.sender, address(this), _amount);
        depositOperations[_operation] = 0;
        depositFinishResults[_operation] = _amount;
    }

    function finishDepositStable(address _operation)
        external
        override(IEthAnchorRouter)
    {
        require(depositFinishResults[_operation] > 0);
        aUstToken.safeTransfer(msg.sender, depositFinishResults[_operation]);
        depositFinishResults[_operation] = 0;
    }

    function initRedeemStable(uint256 _amount)
        external
        override(IEthAnchorRouter)
        returns (address operator)
    {
        require(pendingOperator != address(0));
        aUstToken.safeTransferFrom(msg.sender, address(this), _amount);
        redeemOperations[pendingOperator] = _amount;
        operator = pendingOperator;
        pendingOperator = address(0);
    }

    function notifyRedeemResult(address _operation, uint256 _amount) external {
        require(redeemOperations[_operation] > 0);
        ustToken.safeTransferFrom(msg.sender, address(this), _amount);
        redeemOperations[_operation] = 0;
        redeemFinishResults[_operation] = _amount;
    }

    function finishRedeemStable(address _operation) external override {
        require(redeemFinishResults[_operation] > 0);
        ustToken.safeTransfer(msg.sender, redeemFinishResults[_operation]);
        redeemFinishResults[_operation] = 0;
    }
}
