
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.3.2 (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import "../interfaces/IOverlayTokenNew.sol";
import "./utils/AccessControlEnumerable.sol";
import "./utils/Context.sol";


contract OverlayTokenNew is Context, IOverlayTokenNew, AccessControlEnumerable {

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    bytes32 public constant ADMIN_ROLE = 0x00;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER");

    string constant public override name = "Overlay Token";
    string constant public override symbol = "OVL";
    uint256 constant public override decimals = 18;

    uint256 private _totalSupply;

    constructor() {

        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(BURNER_ROLE, msg.sender);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, ADMIN_ROLE);

    }

    modifier onlyMinter() {
        require(hasRole(MINTER_ROLE, msg.sender), "OVL:!minter");
        _;
    }

    modifier onlyBurner() {
        require(hasRole(BURNER_ROLE, msg.sender), "OVL:!burner");
        _;
    }


    /// @dev Get the current total supply of OVL.
    /// @return totalSupply_ The outstanding supply of OVL tokens.
    function totalSupply() public view virtual override returns (
        uint256 totalSupply_
    ) {
        totalSupply_ = _totalSupply;
    }

    /// @dev Get OVL balance of a given account.
    /// @param account Account to find the OVL balance of.
    /// @return balance_ The account's balance of OVL.
    function balanceOf(
        address account
    ) public view virtual override returns (
        uint256 balance_
    ) {

        balance_ = _balances[account];

    }


    /// @dev Transfer amount of tokens from msg.sender to recipient
    /// @param recipient Can not be the zero address.
    /// @param amount Msg.sender must have at least this amount in tokens.
    /// @return success_ Returns success == true when call does not revert.
    function transfer(
        address recipient, 
        uint256 amount
    ) public virtual override returns (
        bool success_
    ) {

        _transfer(_msgSender(), recipient, amount);

        success_ = true;

    }


    /// @dev Returns allowance on one account for another account.
    /// @param owner Account to allow another to spend its tokens.
    /// @param spender Account allowed to spend the tokens of another.
    /// @return allowance_ Amount of tokens owner allows spender to control.
    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }


    /// @dev Allows one account to approve another to spend from its balance. 
    /// @param spender Account to allow to spend from msg.sender's balance.
    /// @param amount Amount to allow spending of.
    /// @return success_ Returns success == true if call does not revert.
    function approve(
        address spender, 
        uint256 amount
    ) public virtual override returns (
        bool success_
    ) {

        _approve(_msgSender(), spender, amount);

        success_ = true;

    }

    /// @dev Transfers tokens from sender to recipient if sender has allowance.
    /// @param sender Address of account from which to send tokens.
    /// @param recipient Address of account to receive tokens.
    /// @param amount Amount of tokens to send.
    /// @param success_ Returns success == true if call does not revert.
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (
        bool success_
    ) {

        _transfer(sender, recipient, amount);

        uint256 currentAllowance = _allowances[sender][_msgSender()];

        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");

        unchecked { _approve(sender, _msgSender(), currentAllowance - amount); }

        success_ = true;

    }


    /// @dev Allows msg.sender to simultaneously send and burn tokens.
    /// @param recipient Account to send tokens to.
    /// @param amount Amount of tokens to send.
    /// @param burnt Amount of tokens to burn from msg.sender.
    /// @return success_ Returns success == true if call does not revert.
    function transferBurn(
        address recipient,
        uint256 amount,
        uint256 burnt
    ) public override onlyBurner returns (
        bool
    ) {

        _transferBurn(msg.sender, recipient, amount, burnt);

        return true;

    }


    /// @dev Allows msg.sender to simultaneously send and burn tokens 
    /// from sender according to allowance granted.
    /// @param sender Address from which to transfer tokens.
    /// @param recipient Address to trasnfer tokens into.
    /// @param amount Amount of tokens to send.
    /// @param burnt Amount of tokens to burn.
    /// @return success Returns true if call does not revert.
    function transferFromBurn(
        address sender,
        address recipient,
        uint256 amount,
        uint256 burnt
    ) public override onlyBurner returns (
        bool success
    ) {

        _transferBurn(sender, recipient, amount, burnt);

        uint256 currentAllowance = _allowances[sender][msg.sender];

        require(currentAllowance >= amount + burnt, "OVL:allowance<amount+burnt");

        unchecked { _approve(sender, msg.sender, currentAllowance - amount - burnt); }

        success = true;

    }
    

    /// @dev Internal function to transfer and burn OVL simultaneously.
    /// @param sender Address to send and burn from.
    /// @param recipient Address to send to.
    /// @param amount Amount to send.
    /// @param burnt Amount to burn.
    function _transferBurn(
        address sender,
        address recipient,
        uint256 amount,
        uint256 burnt
    ) internal {

        uint256 senderBalance = _balances[sender];

        require(senderBalance >= amount + burnt, "OVL:balance<amount+burnt");

        unchecked { _balances[sender] = senderBalance - amount - burnt; }

        _balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);
        emit Transfer(sender, address(0), burnt);

    }

    /// @dev Allows msg.sender to simultaneously transfer tokens and mint 
    /// to the recipient.
    /// @param recipient Account to transfer and mint tokens to.
    /// @param amount Amount of tokens to transfer.
    /// @param minted Amount of tokens to mint.
    /// @return success Returns true if call does not revert.
    function transferMint(
        address recipient,
        uint256 amount,
        uint256 minted
    ) public override onlyMinter returns (
        bool success
    ) {

        _transferMint(msg.sender, recipient, amount, minted);

        success = true;

    }

    /// @dev Allows msg.sender to simultaneously transfer from sender 
    /// according to its granted allowance and mint to recipient.
    /// @param sender Account to transfer tokens from.
    /// @param recipient Account to transfer tokens and mint to.
    /// @param amount Amount of tokens to transfer.
    /// @param minted Amount of tokens to mint.
    /// @return success Returns true if call does not revert.
    function transferFromMint(
        address sender,
        address recipient,
        uint256 amount,
        uint256 minted
    ) public override onlyMinter returns (
        bool
    ) {

        _transferMint(sender, recipient, amount, minted);

        uint256 currentAllowance = _allowances[sender][msg.sender];

        require(currentAllowance >= amount, "OVL:allowance<amount");

        unchecked { _approve(sender, msg.sender, currentAllowance - amount); }

        return true;

    }

    /// @dev Internal function taking care of transfering from sender 
    /// to recipient and minting at recipient.
    /// @param sender Account to transfer tokens from.
    /// @param recipient Account to transfer tokens to and mint at.
    /// @param amount Amount of tokens to transfer.
    /// @param minted Amount of tokens to mint.
    function _transferMint(
        address sender,
        address recipient,
        uint256 amount,
        uint256 minted
    ) internal {

        uint256 senderBalance = _balances[sender];

        require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");

        unchecked { _balances[sender] = senderBalance - amount; }

        _balances[recipient] += amount + minted;

        emit Transfer(sender, recipient, amount);
        emit Transfer(address(0), recipient, minted);

    }

    function increaseAllowance(
        address spender, 
        uint256 addedValue
    ) public virtual returns (
        bool success
    ) {

        _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);

        success = true;

    }

    function decreaseAllowance(
        address spender, 
        uint256 subtractedValue
    ) public virtual returns (
        bool success
    ) {

        uint256 currentAllowance = _allowances[_msgSender()][spender];

        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");

        unchecked { _approve(_msgSender(), spender, currentAllowance - subtractedValue); }

        success = true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[sender] = senderBalance - amount;
        }
        _balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);

        _afterTokenTransfer(sender, recipient, amount);
    }


    function mint(
        address _recipient, 
        uint256 _amount
    ) external override onlyMinter {

        _mint(_recipient, _amount);

    }

    function _mint(
        address account, 
        uint256 amount
    ) internal virtual {

        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);

    }

    function burn(
        address _account, 
        uint256 _amount
    ) external override onlyBurner {

        _burn(_account, _amount);

    }


    function _burn(
        address account, 
        uint256 amount
    ) internal virtual {

        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {

        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);

    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

}