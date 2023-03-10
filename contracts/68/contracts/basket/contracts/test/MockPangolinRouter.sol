// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

import "./MockToken.sol";

contract MockPangolinRouter {
    address public immutable WAVAX;
    uint256 public globalAmountOut;
    uint256 public globalAmountIn;

    constructor() {
        WAVAX = address(new MockToken("name", "ticker"));
    }

    function setAmountIn(uint256 _globalAmountIn) external {
        globalAmountIn = _globalAmountIn;
    }

    function setAmountOut(uint256 _globalAmountOut) external {
        globalAmountOut = _globalAmountOut;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(
            MockToken(path[0]).transferFrom(
                msg.sender,
                address(this),
                amountIn
            ),
            "Transfer failed"
        );
        MockToken(path[0]).burn(amountIn, address(this));
        if (amountOutMin > 0)
            MockToken(path[path.length - 1]).mint(amountOutMin, to);
        else
            MockToken(path[path.length - 1]).mint(
                (amountIn * globalAmountOut) / globalAmountIn,
                to
            );
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        uint256 amountIn = amountInMax > 0
            ? amountInMax
            : (amountOut * globalAmountIn) / globalAmountOut;
        require(
            MockToken(path[0]).transferFrom(
                msg.sender,
                address(this),
                amountIn
            ),
            "Transfer failed"
        );
        MockToken(path[0]).burn(amountIn, address(this));

        MockToken(path[path.length - 1]).mint(amountOut, to);
    }

    function getAmountsOut(uint256 amountIn, address[] memory path)
        public
        view
        virtual
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](path.length);

        amounts[path.length - 1] = globalAmountOut;
    }

    function getAmountsIn(uint256 amountOut, address[] memory path)
        public
        view
        virtual
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](path.length);
        amounts[0] = globalAmountIn;
    }
}
