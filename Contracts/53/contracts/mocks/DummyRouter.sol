//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "../NestedFactory.sol";
import "../libraries/ExchangeHelpers.sol";
import "../interfaces/INestedFactory.sol";

contract DummyRouter is IERC721Receiver {
    address payable public factory;
    INestedFactory.Order[] attackOrders;
    IWETH public weth;

    receive() external payable {}

    // send ETH, get the token
    function dummyswapETH(IERC20 token) public payable {
        // send 1ETH, you get 10 dummy tokens
        token.transfer(msg.sender, msg.value * 10);
    }

    // send a token, get the token
    function dummyswapToken(
        IERC20 _inputToken,
        IERC20 _outputToken,
        uint256 _amount
    ) external {
        IERC20(_inputToken).transferFrom(msg.sender, address(this), _amount);
        _outputToken.transfer(msg.sender, _amount);
    }

    function reentrancyAttackForDestroy(uint256 nftId) external {
        NestedFactory(factory).destroy(nftId, IERC20(address(weth)), attackOrders);
    }

    function prepareAttack(
        address payable _factory,
        IWETH _weth,
        INestedFactory.Order[] calldata _tokenOrders,
        INestedFactory.Order[] calldata _attackOrders
    ) external payable {
        factory = _factory;
        weth = _weth;
        uint256 amountIn = msg.value;
        weth.deposit{ value: amountIn }();
        weth.approve(_factory, amountIn);
        attackOrders.push(_attackOrders[0]);
        attackOrders.push(_attackOrders[1]);
        NestedFactory(_factory).create(0, IERC20(address(_weth)), amountIn - amountIn / 98, _tokenOrders);
    }

    function setMaxAllowance(IERC20 _token, address _spender) external {
        ExchangeHelpers.setMaxAllowance(_token, _spender);
    }

    function setAllowance(
        IERC20 _token,
        address _spender,
        uint256 _amount
    ) external {
        _token.approve(_spender, _amount);
    }

    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenId,
        bytes calldata _data
    ) external pure override returns (bytes4) {
        _operator;
        _from;
        _tokenId;
        _data;
        return 0x150b7a02;
    }
}
