// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

contract MaticTestToken {
    // MODEL

    string public constant name = 'Matic TEST TOKEN';
    string public constant symbol = 'MATIC';
    uint8 public immutable decimals = 18;

    address private constant ZERO = address(type(uint160).min);

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // EVENT

    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    // UPDATE

    function approve(address _spender, uint256 _value) external returns (bool) {
        _approve(msg.sender, _spender, _value);
        return true;
    }

    function transfer(address _to, uint256 _value) external returns (bool) {
        _transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        if (msg.sender != _from && allowance[_from][msg.sender] != type(uint256).max) {
            allowance[_from][msg.sender] -= _value;

            emit Approval(_from, msg.sender, allowance[_from][msg.sender]);
        }
        _transfer(_from, _to, _value);
        return true;
    }

    function mint(address _to, uint256 _value) external {
        totalSupply += _value;
        balanceOf[_to] += _value;
        emit Transfer(ZERO, _to, _value);
    }

    // HELPER

    function _approve(
        address _owner,
        address _spender,
        uint256 _value
    ) private {
        allowance[_owner][_spender] = _value;
        emit Approval(_owner, _spender, _value);
    }

    function _transfer(
        address _from,
        address _to,
        uint256 _value
    ) private {
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(_from, _to, _value);
    }
}
