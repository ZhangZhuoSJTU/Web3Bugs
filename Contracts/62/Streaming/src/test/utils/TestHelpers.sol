pragma solidity >=0.8.0;

import "./HEVMTokenExtension.sol";

contract TestHelpers is TokenExtensions {
    function expect_revert_with(
        address who,
        string memory sig,
        bytes memory args,
        string memory revert_string
    )
        public
    {
        bytes memory calld = abi.encodePacked(sigs(sig), args);
        (bool success, bytes memory ret) = who.call(calld);
        assertTrue(!success);
        string memory ret_revert_string = abi.decode(slice(5, ret.length, ret), (string));
        assertEq(ret_revert_string, revert_string);
    }

    // In a passing test, expect a revert with a string (takes a function signature and args and *is* payable)
    function expect_revert_with(
        address who,
        string memory sig,
        bytes memory args,
        uint256 value,
        string memory revert_string
    )
        public
    {
        bytes memory calld = abi.encodePacked(sigs(sig), args);
        (bool success, bytes memory ret) = who.call{value: value}(calld);
        assertTrue(!success);
        string memory ret_revert_string = abi.decode(slice(5, ret.length, ret), (string));
        assertEq(ret_revert_string, revert_string);
    }

    // pass as a 4byte function signature instead
    function expect_revert_with(
        address who,
        bytes4 sig,
        bytes memory args,
        string memory revert_string
    )
        public
    {
        bytes memory calld = abi.encodePacked(sig, args);
        (bool success, bytes memory ret) = who.call(calld);
        assertTrue(!success);
        string memory ret_revert_string = abi.decode(slice(5, ret.length, ret), (string));
        assertEq(ret_revert_string, revert_string);
    }

    function expect_revert(
        address who,
        bytes4 sig,
        bytes memory args
    )
        public
    {
        bytes memory calld = abi.encodePacked(sig, args);
        (bool success, bytes memory ret) = who.call(calld);
        assertTrue(!success);
    }

    function slice(uint256 begin, uint256 end, bytes memory text) public pure returns (bytes memory) {
       bytes memory a = new bytes(end - begin + 1);
       for(uint i=0 ; i <= end - begin; i++) {
           a[i] = bytes(text)[i + begin - 1];
       }
       return a;
    }

    function ff(uint256 x) public {
        hevm.warp(block.timestamp + x);
    }

    function rev(uint256 x) public {
        hevm.warp(block.timestamp - x);
    }
}