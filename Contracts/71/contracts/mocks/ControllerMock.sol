pragma solidity 0.8.7;

import "../mocks/TestERC20Mock.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IOwnership.sol";

contract ControllerMock {
    TestERC20Mock public token;
    IVault public vault;
    IOwnership public ownership;

    modifier onlyOwner() {
        require(ownership.owner() == msg.sender, 'Restricted: caller is not allowed to operate');
        _;
    }

    constructor(address _token, address _ownership) {
        token = TestERC20Mock(_token);
        ownership = IOwnership(_ownership);
    }

    function withdraw(address _to, uint256 _amount) external {
        require(msg.sender == address(vault));
        token.transfer(_to, _amount);
    }

    function valueAll() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function earn(address, uint256) external {
        //do something for yield here in real contracts
    }

    function setVault(address _address) external onlyOwner{
        vault = IVault(_address);
    }

    function yield() external onlyOwner{
        uint256 _amount = vault.utilize();
        uint256 _mint = (_amount * 5) / 10;
        token.mint(address(this), _mint);
    }

    function migrate(address) external {
        //do something for yield here in real contracts
    }
}
