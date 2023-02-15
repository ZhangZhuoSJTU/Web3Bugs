pragma solidity 0.8.7;

import "../InsureDAOERC20.sol";

contract InsureDAOERC20Mock is InsureDAOERC20 {
    constructor() {}

    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) external {
        initializeToken(name_, symbol_, decimals_);
    }

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }

    function burn(uint256 _amount) external {
        _burn(msg.sender, _amount);
    }
}
