// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringMath.sol";
import "./ERC20Mock.sol";

contract FreelyMintableERC20Mock is ERC20Mock {
    using BoringMath for uint256;

    constructor(uint256 initialSupply) public ERC20Mock(initialSupply) {}

    function mint(address to, uint256 amount) public {
        totalSupply = totalSupply.add(amount);
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(uint256 amount) public {
        require(amount <= balanceOf[msg.sender], "MIM: not enough");
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }
}
