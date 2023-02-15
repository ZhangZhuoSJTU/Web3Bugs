pragma solidity 0.8.7;

import "./Interfaces/IERC20_8.sol";

contract ERC20_8 is IERC20 {

    string public _symbol;
    string public _name;
    uint8 public _decimals;
    uint public _totalSupply;

    // For each person map between their address and the number of tokens they have
    mapping(address => uint) balances;
    // To transfer erc20 token, give contract permission to transfer. Maps from your address to address of transfer target and amount to transfer.
    mapping(address => mapping(address => uint)) allowed;

    /* ========== View Functions ========== */

    //Returns decimals that this token uses.
    function decimals() public view returns (uint8) {
        return _decimals;
    }


    //Returns the token name
    function name() public view returns (string memory) {
        return _name;
    }


    //Returns the symbol
    function symbol() public view returns (string memory) {
        return _symbol;
    }


    // Return total supply
    function totalSupply() public override view returns (uint) {
        return _totalSupply;
    }


    // Return the token balance for account tokenOwner
    function balanceOf(address _token_owner) public override view returns (uint balance) {
        return balances[_token_owner];
    }

    // ------------------------------------------------------------------------
    // Returns the amount of tokens approved by the owner that can be
    // transferred to the spender's account
    // ------------------------------------------------------------------------
    function allowance(address tokenOwner, address spender) public override view returns (uint remaining) {
        return allowed[tokenOwner][spender];
    }


    /* ========== External Functions ========== */


    // ------------------------------------------------------------------------
    // Transfer the balance from token owner's account to to account
    // - Owner's account must have sufficient balance to transfer
    // - 0 value transfers are allowed
    // ------------------------------------------------------------------------
    function transfer(address _to, uint _num_tokens) public virtual override returns (bool success) {
        require(_num_tokens <= balances[msg.sender], "You are trying to transfer more tokens than you have");

        unchecked { balances[msg.sender] = balances[msg.sender] - _num_tokens; } // pre checked that you have enough tokens
        balances[_to] = balances[_to] + _num_tokens;
        emit Transfer(msg.sender, _to, _num_tokens);
        return true;
    }

    // ------------------------------------------------------------------------
    // Token owner can approve for spender to transferFrom(...) tokens
    // from the token owner's account
    //
    // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md
    // recommends that there are no checks for the approval double-spend attack
    // as this should be implemented in user interfaces
    // ------------------------------------------------------------------------
    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
        _approve(msg.sender, spender, allowed[msg.sender][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        _approve(msg.sender, spender, allowed[msg.sender][spender] - subtractedValue);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        allowed[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }


    // ------------------------------------------------------------------------
    // Transfer tokens from the from account to the to account
    //
    // The calling account must already have sufficient tokens approve(...)-d
    // for spending from the from account and
    // - From account must have sufficient balance to transfer
    // - Spender must have sufficient allowance to transfer
    // - 0 value transfers are allowed
    // ------------------------------------------------------------------------
    function transferFrom(address _from, address _to, uint _amount) public virtual override returns (bool success) {
        return _transferFrom(_from, _to, _amount);
    }


    function _transferFrom(address _from, address _to, uint _amount) internal returns (bool) {
        balances[_from] = balances[_from] - _amount;
        allowed[_from][msg.sender] = allowed[_from][msg.sender] - _amount;
        balances[_to] = balances[_to] + _amount;
        emit Transfer(_from, _to, _amount);
        return true;
    }


    // ------------------------------------------------------------------------
    // Mint new tokens to a given _to address
    // ------------------------------------------------------------------------
    function _mint(address _to, uint _num_tokens) internal returns (bool success) {
        balances[_to] = balances[_to] + _num_tokens;
        _totalSupply= _totalSupply+_num_tokens;
        emit Transfer(address(0), _to, _num_tokens);
        return true;
    }

    // ------------------------------------------------------------------------
    // Burn tokens owned by _holder
    // ------------------------------------------------------------------------
    function _burn(address _holder, uint _num_tokens) internal returns (bool success) {
        balances[_holder] = balances[_holder] - _num_tokens;
        _totalSupply= _totalSupply- _num_tokens;
        emit Transfer(_holder, address(0), _num_tokens);
        return true;
    }
}
