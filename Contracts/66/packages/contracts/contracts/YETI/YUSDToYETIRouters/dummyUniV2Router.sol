pragma solidity 0.6.12;

import "../IsYETIRouter.sol";
import "../BoringCrypto/BoringOwnable.sol";
import "../BoringCrypto/IERC20.sol";

// Dummy contract for swapping just in one swap from YUSD to YETI 
// in one univ2 pool with the path being just that. Testing purposes only.

contract dummyUniV2Router is IsYETIRouter, BoringOwnable {
    IRouter JOERouter;
    address JOERouterAddress;
    address[] path;
    IERC20 yusdToken;
    IERC20 yetiToken;

    function setup(address _JOERouter, address _yusdToken, address _yetiToken) external onlyOwner {
        JOERouterAddress = _JOERouter;
        JOERouter = IRouter(_JOERouter);
        path = new address[](2);
        yusdToken = IERC20(_yusdToken);
        yetiToken = IERC20(_yetiToken);
        path[0] = _yusdToken;
        path[1] = _yetiToken;
        // Renounce ownership
        transferOwnership(address(0), true, true);
    }

    function swap(uint256 _YUSDAmount, uint256 _minYETIOut, address _to) external override returns (uint256[] memory amounts) {
        address cachedJOERouterAddress = JOERouterAddress;
        IERC20 cachedYUSDToken = yusdToken;
        require(cachedYUSDToken.approve(cachedJOERouterAddress, 0));
        require(cachedYUSDToken.increaseAllowance(cachedJOERouterAddress, _YUSDAmount));
        amounts = JOERouter.swapExactTokensForTokens(_YUSDAmount, _minYETIOut, path, _to, block.timestamp);
    }
}


// Router for Uniswap V2, performs YUSD -> YETI swaps
interface IRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}