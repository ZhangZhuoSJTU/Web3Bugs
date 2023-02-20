// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

pragma experimental ABIEncoderV2;

import "../Adminable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/// @dev Admin of this contract is the address of Timelock. 
contract OLEToken is Adminable {
    using SafeMath for uint;

    // EIP-20 token name for this token
    string public  name;

    // EIP-20 token symbol for this token
    string public  symbol;

    // EIP-20 token decimals for this token
    uint8 public constant decimals = 18;

    // Total number of tokens in circulation
    uint public totalSupply = 1000000000e18; // 1 billion OLE

    // Allowance amounts on behalf of others
    mapping(address => mapping(address => uint)) internal allowances;

    // Official record of token balances for each account
    mapping(address => uint) internal balances;

    // The standard EIP-20 transfer event
    event Transfer(address indexed from, address indexed to, uint256 amount);

    // The standard EIP-20 approval event
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    /**
     * Construct a new OpenLev token
     * @param initAccount The initial account to grant all the tokens
     */
    constructor(address initAccount, address payable _admin, string memory _name, string memory _symbol)  {
        admin = _admin;
        balances[initAccount] = totalSupply;
        name = _name;
        symbol = _symbol;
        emit Transfer(address(0), initAccount, totalSupply);
    }

    function mint(address account, uint amount) external onlyAdmin {
        require(account != address(0), "OLE: mint to the zero address");
        totalSupply = totalSupply.add(amount);
        balances[account] = balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function burn(uint amount) external {
        balances[msg.sender] = balances[msg.sender].sub(amount);
        totalSupply = totalSupply.sub(amount);
        emit Transfer(msg.sender, address(0), amount);
    }
    /**
     * Get the number of tokens `spender` is approved to spend on behalf of `account`
     * @param account The address of the account holding the funds
     * @param spender The address of the account spending the funds
     * @return The number of tokens approved
     */
    function allowance(address account, address spender) external view returns (uint) {
        return allowances[account][spender];
    }


    /**
     * Approve `spender` to transfer up to `amount` from `src`
     * @dev This will overwrite the approval amount for `spender`
     *  and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)
     * @param spender The address of the account which may transfer tokens
     * @return Whether or not the approval succeeded
     */
    function approve(address spender, uint amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * Get the number of tokens held by the `account`
     * @param account The address of the account to get the balance of
     * @return The number of tokens held
     */
    function balanceOf(address account) external view returns (uint) {
        return balances[account];
    }

    /**
     * Transfer `amount` tokens from `msg.sender` to `dst`
     * @param dst The address of the destination account
     * @return Whether or not the transfer succeeded
     */
    function transfer(address dst, uint amount) external returns (bool) {
        _transferTokens(msg.sender, dst, amount);
        return true;
    }

    /**
     * Transfer `amount` tokens from `src` to `dst`
     * @param src The address of the source account
     * @param dst The address of the destination account
     * @return Whether or not the transfer succeeded
     */
    function transferFrom(address src, address dst, uint amount) external returns (bool) {
        address spender = msg.sender;
        uint spenderAllowance = allowances[src][spender];

        if (spender != src && spenderAllowance != uint(- 1)) {
            allowances[src][spender] = spenderAllowance.sub(amount);
            emit Approval(src, spender, allowances[src][spender]);
        }

        _transferTokens(src, dst, amount);
        return true;
    }


    function _transferTokens(address src, address dst, uint amount) internal {
        require(src != address(0), "Zero src address");
        require(dst != address(0), "Zero dst address");

        balances[src] = balances[src].sub(amount);
        balances[dst] = balances[dst].add(amount);
        emit Transfer(src, dst, amount);
    }

}
