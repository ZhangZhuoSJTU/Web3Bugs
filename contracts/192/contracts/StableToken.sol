// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./utils/MetaContext.sol";

contract StableToken is ERC20Permit, MetaContext {

    mapping(address => bool) public isMinter;

    constructor(string memory name_, string memory symbol_) ERC20Permit(name_) ERC20(name_, symbol_) {}

    function burnFrom(
        address account,
        uint256 amount
    ) 
        public 
        virtual 
        onlyMinter() 
    {
        _burn(account, amount);
    }

    function mintFor(
        address account,
        uint256 amount
    ) 
        public 
        virtual 
        onlyMinter() 
    {  
        _mint(account, amount);
    }

    /**
     * @dev Sets the status of minter.
     */
    function setMinter(
        address _address,
        bool _status
    ) 
        public
        onlyOwner()
    {
        isMinter[_address] = _status;
    }

    /**
     * @dev Throws if called by any account that is not minter.
     */
    modifier onlyMinter() {
        require(isMinter[_msgSender()], "!Minter");
        _;
    }

    // META-TX
    function _msgSender() internal view override(Context, MetaContext) returns (address sender) {
        return MetaContext._msgSender();
    }

    // Unreachable
    function _msgData() internal view override(Context, MetaContext) returns (bytes calldata) {
        return MetaContext._msgData();
    }
}