pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// test input data from the 0x API
// 0xd9627aa4000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000008430000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee869584cd0000000000000000000000001000000000000000000000000000000000000011000000000000000000000000000000000000000000000052beeb861f60df6a37

contract MockZrxExchangeProxy {
    // well behaved function that takes 1000 * 1e18 _1[0] tokens and returns 1000e18
    // _1[1] tokens if possible.
    //
    // function selector: 0xd9627aa4 (real selector in use on mainnet)
    function sellToUniswap(address[] calldata _1, uint256 _2, uint256 _3, bool _4) external payable {
        require(_1.length > 1, "tokens");
        IERC20 tokenToSell = IERC20(_1[0]);
        IERC20 tokenToBuy = IERC20(_1[1]);
        tokenToSell.transferFrom(msg.sender, address(this), 1000 ether);
        tokenToBuy.transfer(msg.sender, 1000 ether);
    }

    // well behaved function that takes 1000 * 1e18 _1[0] tokens and returns 1 ETH,
    // if possible.
    //
    // function selector: 0x22170963
    function sellToUniswap1(address[] calldata _1, uint256 _2, uint256 _3, bool _4) external payable {
        require(_1.length > 0, "tokens");
        IERC20 tokenToSell = IERC20(_1[0]);
        IERC20 tokenToBuy = IERC20(_1[1]);
        tokenToSell.transferFrom(msg.sender, address(this), 1000 ether);
        payable(address(msg.sender)).transfer(1 ether);
    }

    // well behaved function that takes 1 ETH and returns 1000 * 1e18 _1[1]
    // tokens, if possible.
    //
    // function selector: 0x02af0bb5
    function sellToUniswap2(address[] calldata _1, uint256 _2, uint256 _3, bool _4) external payable {
        require(msg.value == 1 ether, "mispaid");
        require(_1.length > 1, "tokens");
        IERC20(_1[1]).transfer(msg.sender, 1000 ether);
    }

    // function that reverts
    //
    // function selector: 0x9b1d1f41
    function sellToUniswap3(address[] calldata _1, uint256 _2, uint256 _3, bool _4) external payable {
        revert("Sorry fren");
    }

    // malicious function that takes all ETH and returns nothing
    //
    // function selector: 0xb88ce71e
    function sellToUniswap4(address[] calldata _1, uint256 _2, uint256 _3, bool _4) external payable {
        // yep that's it :)
    }

    // malicious function that takes all approved _1[0] tokens and returns a
    // small amount of ETH
    //
    // function selector: 0x1f9b9985
    function sellToUniswap5(address[] calldata _1, uint256 _2, uint256 _3, bool _4) external payable {
        if(_1.length > 0) {
            IERC20 token = IERC20(_1[0]);
            uint256 allowance = token.allowance(msg.sender, address(this));
            IERC20(_1[0]).transferFrom(msg.sender, address(this), allowance);
            payable(address(msg.sender)).transfer(0.1 ether);
            // see you later sucker!
        }
    }

    fallback() external payable {}
    receive() external payable {}
}
