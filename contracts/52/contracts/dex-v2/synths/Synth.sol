// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/shared/IERC20Extended.sol";
import "../../interfaces/dex-v2/synth/ISynth.sol";

contract Synth is ISynth, ProtocolConstants, ERC20, Ownable {
    /* ========== CONSTRUCTOR ========== */

    constructor(IERC20Extended token)
        ERC20(_calculateName(token), _calculateSymbol(token))
    {}

    /* ========== VIEWS ========== */

    function _calculateName(IERC20Extended token)
        internal
        view
        returns (string memory)
    {
        return _combine(token.name(), " - vSynth");
    }

    function _calculateSymbol(IERC20Extended token)
        internal
        view
        returns (string memory)
    {
        return _combine(token.symbol(), ".v");
    }

    function _combine(string memory a, string memory b)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(a, b));
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function mint(address to, uint256 amount) external override onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external override onlyOwner {
        _burn(msg.sender, amount);
    }
}
