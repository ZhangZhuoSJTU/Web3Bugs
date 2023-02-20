// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./MockBehodler.sol";
import "../facades/LimboAddTokenToBehodlerPowerLike.sol";

contract MockAddTokenPower is LimboAddTokenToBehodlerPowerLike {
    address behodler;
    address limbo;
    uint256 scxToMint = 10000;

    function setScarcityToMint(uint256 _scarcity) public {
        scxToMint = _scarcity;
    }

    function seed(address _behodler, address _limbo) public {
        limbo = _limbo;
        behodler = _behodler;
    }

    function parameterize(address token, bool burnable) public override {}

    function invoke() public {
        MockBehodler(behodler).mint(scxToMint);
        MockBehodler(behodler).transfer(limbo, scxToMint);
    }
}
