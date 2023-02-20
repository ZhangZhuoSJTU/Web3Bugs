// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "hardhat/console.sol";

contract Ownable {
  address private _owner;

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  constructor() {
    _owner = msg.sender;
    emit OwnershipTransferred(address(0), msg.sender);
  }

  function owner() public view returns (address) {
    return _owner;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(_owner == msg.sender, "Ownable: caller is not the owner");
    _;
  }

  /**
   * @dev Leaves the contract without owner. It will not be possible to call
   * `onlyOwner` functions anymore. Can only be called by the current owner.
   *
   * NOTE: Renouncing ownership will leave the contract without an owner,
   * thereby removing any functionality that is only available to the owner.
   */
  function renounceOwnership() public virtual onlyOwner {
    emit OwnershipTransferred(_owner, address(0));
    _owner = address(0);
  }

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * Can only be called by the current owner.
   */
  function transferOwnership(address newOwner) public virtual onlyOwner {
    require(newOwner != address(0), "Ownable: new owner is the zero address");
    emit OwnershipTransferred(_owner, newOwner);
    _owner = newOwner;
  }
}

pragma solidity 0.8.4;

abstract contract PyroTokenLike {
  function config()
    public
    virtual
    returns (
      address,
      address,
      address,
      bool
    );

  function redeem(uint256 pyroTokenAmount) external virtual returns (uint256);

  function mint(uint256 baseTokenAmount) external payable virtual returns (uint256);

  function redeemRate() public view virtual returns (uint256);

  // function baseToken() public view virtual returns (address);
}

pragma solidity 0.8.4;

interface IERC20 {
  function name() external view returns (string memory);

  function symbol() external view returns (string memory);

  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function decimals() external returns (uint8);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function allowance(address owner, address spender) external view returns (uint256);

  function approve(address spender, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}
pragma solidity 0.8.4;

interface IERC2612 {
  /**
   * @dev Sets `amount` as the allowance of `spender` over `owner`'s tokens,
   * given `owner`'s signed approval.
   *
   * IMPORTANT: The same issues {IERC20-approve} has related to transaction
   * ordering also apply here.
   *
   * Emits an {Approval} event.
   *
   * Requirements:
   *
   * - `owner` cannot be the zero address.
   * - `spender` cannot be the zero address.
   * - `deadline` must be a timestamp in the future.
   * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
   * over the EIP712-formatted function arguments.
   * - the signature must use ``owner``'s current nonce (see {nonces}).
   *
   * For more information on the signature format, see the
   * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
   * section].
   */
  function permit(
    address owner,
    address spender,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;

  /**
   * @dev Returns the current ERC2612 nonce for `owner`. This value must be
   * included whenever a signature is generated for {permit}.
   *
   * Every successful call to {permit} increases ``owner``'s nonce by one. This
   * prevents a signature from being used multiple times.
   */
  function nonces(address owner) external view returns (uint256);
}

interface IERC3156FlashBorrower {
  /**
   * @dev Receive a flash loan.
   * @param initiator The initiator of the loan.
   * @param token The loan currency.
   * @param amount The amount of tokens lent.
   * @param fee The additional amount of tokens to repay.
   * @param data Arbitrary data structure, intended to contain user-defined parameters.
   * @return The keccak256 hash of "ERC3156FlashBorrower.onFlashLoan"
   */
  function onFlashLoan(
    address initiator,
    address token,
    uint256 amount,
    uint256 fee,
    bytes calldata data
  ) external returns (bytes32);
}

interface IERC3156FlashLender {
  /**
   * @dev The amount of currency available to be lended.
   * @param token The loan currency.
   * @return The amount of `token` that can be borrowed.
   */
  function maxFlashLoan(address token) external view returns (uint256);

  /**
   * @dev The fee to be charged for a given loan.
   * @param token The loan currency.
   * @param amount The amount of tokens lent.
   * @return The amount of `token` to be charged for the loan, on top of the returned principal.
   */
  function flashFee(address token, uint256 amount) external view returns (uint256);

  /**
   * @dev Initiate a flash loan.
   * @param receiver The receiver of the tokens in the loan, and the receiver of the callback.
   * @param token The loan currency.
   * @param amount The amount of tokens lent.
   * @param data Arbitrary data structure, intended to contain user-defined parameters.
   */
  function flashLoan(
    IERC3156FlashBorrower receiver,
    address token,
    uint256 amount,
    bytes calldata data
  ) external returns (bool);
}

/// @dev Wrapped Ether v10 (WETH10) is an Ether (ETH) ERC-20 wrapper. You can `deposit` ETH and obtain an WETH10 balance which can then be operated as an ERC-20 token. You can
/// `withdraw` ETH from WETH10, which will then burn WETH10 token in your wallet. The amount of WETH10 token in any wallet is always identical to the
/// balance of ETH deposited minus the ETH withdrawn with that specific wallet.
interface IWETH10 is IERC20, IERC2612, IERC3156FlashLender {
  /// @dev Returns current amount of flash-minted WETH10 token.
  function flashMinted() external view returns (uint256);

  /// @dev `msg.value` of ETH sent to this contract grants caller account a matching increase in WETH10 token balance.
  /// Emits {Transfer} event to reflect WETH10 token mint of `msg.value` from zero address to caller account.
  function deposit() external payable;

  /// @dev `msg.value` of ETH sent to this contract grants `to` account a matching increase in WETH10 token balance.
  /// Emits {Transfer} event to reflect WETH10 token mint of `msg.value` from zero address to `to` account.
  function depositTo(address to) external payable;

  /// @dev Burn `value` WETH10 token from caller account and withdraw matching ETH to the same.
  /// Emits {Transfer} event to reflect WETH10 token burn of `value` to zero address from caller account.
  /// Requirements:
  ///   - caller account must have at least `value` balance of WETH10 token.
  function withdraw(uint256 value) external;

  /// @dev Burn `value` WETH10 token from caller account and withdraw matching ETH to account (`to`).
  /// Emits {Transfer} event to reflect WETH10 token burn of `value` to zero address from caller account.
  /// Requirements:
  ///   - caller account must have at least `value` balance of WETH10 token.
  function withdrawTo(address payable to, uint256 value) external;

  /// @dev Burn `value` WETH10 token from account (`from`) and withdraw matching ETH to account (`to`).
  /// Emits {Approval} event to reflect reduced allowance `value` for caller account to spend from account (`from`),
  /// unless allowance is set to `type(uint256).max`
  /// Emits {Transfer} event to reflect WETH10 token burn of `value` to zero address from account (`from`).
  /// Requirements:
  ///   - `from` account must have at least `value` balance of WETH10 token.
  ///   - `from` account must have approved caller to spend at least `value` of WETH10 token, unless `from` and caller are the same account.
  function withdrawFrom(
    address from,
    address payable to,
    uint256 value
  ) external;

  /// @dev `msg.value` of ETH sent to this contract grants `to` account a matching increase in WETH10 token balance,
  /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
  /// Emits {Transfer} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// For more information on *transferAndCall* format, see https://github.com/ethereum/EIPs/issues/677.
  function depositToAndCall(address to, bytes calldata data) external payable returns (bool);

  /// @dev Sets `value` as allowance of `spender` account over caller account's WETH10 token,
  /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
  /// Emits {Approval} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// For more information on approveAndCall format, see https://github.com/ethereum/EIPs/issues/677.
  function approveAndCall(
    address spender,
    uint256 value,
    bytes calldata data
  ) external returns (bool);

  /// @dev Moves `value` WETH10 token from caller's account to account (`to`),
  /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
  /// A transfer to `address(0)` triggers an ETH withdraw matching the sent WETH10 token in favor of caller.
  /// Emits {Transfer} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// Requirements:
  ///   - caller account must have at least `value` WETH10 token.
  /// For more information on transferAndCall format, see https://github.com/ethereum/EIPs/issues/677.
  function transferAndCall(
    address to,
    uint256 value,
    bytes calldata data
  ) external returns (bool);
}

interface ITransferReceiver {
  function onTokenTransfer(
    address,
    uint256,
    bytes calldata
  ) external returns (bool);
}

interface IApprovalReceiver {
  function onTokenApproval(
    address,
    uint256,
    bytes calldata
  ) external returns (bool);
}

/// @dev Wrapped Ether v10 (WETH10) is an Ether (ETH) ERC-20 wrapper. You can `deposit` ETH and obtain an WETH10 balance which can then be operated as an ERC-20 token. You can
/// `withdraw` ETH from WETH10, which will then burn WETH10 token in your wallet. The amount of WETH10 token in any wallet is always identical to the
/// balance of ETH deposited minus the ETH withdrawn with that specific wallet.
contract WETH10 is IWETH10 {
  string public constant override name = "WETH10";
  string public constant override symbol = "WETH10";
  uint8 public constant override decimals = 18;

  bytes32 public immutable CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");
  bytes32 public immutable PERMIT_TYPEHASH =
    keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

  /// @dev Records amount of WETH10 token owned by account.
  mapping(address => uint256) public override balanceOf;

  /// @dev Records current ERC2612 nonce for account. This value must be included whenever signature is generated for {permit}.
  /// Every successful call to {permit} increases account's nonce by one. This prevents signature from being used multiple times.
  mapping(address => uint256) public override nonces;

  /// @dev Records number of WETH10 token that account (second) will be allowed to spend on behalf of another account (first) through {transferFrom}.
  mapping(address => mapping(address => uint256)) public override allowance;

  /// @dev Current amount of flash-minted WETH10 token.
  uint256 public override flashMinted;

  /// @dev Returns the total supply of WETH10 token as the ETH held in this contract.
  function totalSupply() external view override returns (uint256) {
    return address(this).balance + flashMinted;
  }

  /// @dev Fallback, `msg.value` of ETH sent to this contract grants caller account a matching increase in WETH10 token balance.
  /// Emits {Transfer} event to reflect WETH10 token mint of `msg.value` from zero address to caller account.
  receive() external payable {
    // _mintTo(msg.sender, msg.value);
    balanceOf[msg.sender] += msg.value;
    emit Transfer(address(0), msg.sender, msg.value);
  }

  /// @dev `msg.value` of ETH sent to this contract grants caller account a matching increase in WETH10 token balance.
  /// Emits {Transfer} event to reflect WETH10 token mint of `msg.value` from zero address to caller account.
  function deposit() external payable override {
    // _mintTo(msg.sender, msg.value);
    balanceOf[msg.sender] += msg.value;
    emit Transfer(address(0), msg.sender, msg.value);
  }

  /// @dev `msg.value` of ETH sent to this contract grants `to` account a matching increase in WETH10 token balance.
  /// Emits {Transfer} event to reflect WETH10 token mint of `msg.value` from zero address to `to` account.
  function depositTo(address to) external payable override {
    // _mintTo(to, msg.value);
    balanceOf[to] += msg.value;
    emit Transfer(address(0), to, msg.value);
  }

  /// @dev `msg.value` of ETH sent to this contract grants `to` account a matching increase in WETH10 token balance,
  /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
  /// Emits {Transfer} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// For more information on *transferAndCall* format, see https://github.com/ethereum/EIPs/issues/677.
  function depositToAndCall(address to, bytes calldata data) external payable override returns (bool success) {
    // _mintTo(to, msg.value);
    balanceOf[to] += msg.value;
    emit Transfer(address(0), to, msg.value);

    return ITransferReceiver(to).onTokenTransfer(msg.sender, msg.value, data);
  }

  /// @dev Return the amount of WETH10 token that can be flash-lent.
  function maxFlashLoan(address token) external view override returns (uint256) {
    return token == address(this) ? type(uint112).max - flashMinted : 0; // Can't underflow
  }

  /// @dev Return the fee (zero) for flash-lending an amount of WETH10 token.
  function flashFee(address token, uint256) external view override returns (uint256) {
    require(token == address(this), "WETH: flash mint only WETH10");
    return 0;
  }

  /// @dev Flash lends `value` WETH10 token to the receiver address.
  /// By the end of the transaction, `value` WETH10 token will be burned from the receiver.
  /// The flash-minted WETH10 token is not backed by real ETH, but can be withdrawn as such up to the ETH balance of this contract.
  /// Arbitrary data can be passed as a bytes calldata parameter.
  /// Emits {Approval} event to reflect reduced allowance `value` for this contract to spend from receiver account (`receiver`),
  /// unless allowance is set to `type(uint256).max`
  /// Emits two {Transfer} events for minting and burning of the flash-minted amount.
  /// Returns boolean value indicating whether operation succeeded.
  /// Requirements:
  ///   - `value` must be less or equal to type(uint112).max.
  ///   - The total of all flash loans in a tx must be less or equal to type(uint112).max.
  function flashLoan(
    IERC3156FlashBorrower receiver,
    address token,
    uint256 value,
    bytes calldata data
  ) external override returns (bool) {
    require(token == address(this), "WETH: flash mint only WETH10");
    require(value <= type(uint112).max, "WETH: individual loan limit exceeded");
    flashMinted = flashMinted + value;
    require(flashMinted <= type(uint112).max, "WETH: total loan limit exceeded");

    // _mintTo(address(receiver), value);
    balanceOf[address(receiver)] += value;
    emit Transfer(address(0), address(receiver), value);

    require(
      receiver.onFlashLoan(msg.sender, address(this), value, 0, data) == CALLBACK_SUCCESS,
      "WETH: flash loan failed"
    );

    // _decreaseAllowance(address(receiver), address(this), value);
    uint256 allowed = allowance[address(receiver)][address(this)];
    if (allowed != type(uint256).max) {
      require(allowed >= value, "WETH: request exceeds allowance");
      uint256 reduced = allowed - value;
      allowance[address(receiver)][address(this)] = reduced;
      emit Approval(address(receiver), address(this), reduced);
    }

    // _burnFrom(address(receiver), value);
    uint256 balance = balanceOf[address(receiver)];
    require(balance >= value, "WETH: burn amount exceeds balance");
    balanceOf[address(receiver)] = balance - value;
    emit Transfer(address(receiver), address(0), value);

    flashMinted = flashMinted - value;
    return true;
  }

  /// @dev Burn `value` WETH10 token from caller account and withdraw matching ETH to the same.
  /// Emits {Transfer} event to reflect WETH10 token burn of `value` to zero address from caller account.
  /// Requirements:
  ///   - caller account must have at least `value` balance of WETH10 token.
  function withdraw(uint256 value) external override {
    // _burnFrom(msg.sender, value);
    uint256 balance = balanceOf[msg.sender];
    require(balance >= value, "WETH: burn amount exceeds balance");
    balanceOf[msg.sender] = balance - value;
    emit Transfer(msg.sender, address(0), value);

    // _transferEther(msg.sender, value);
    (bool success, ) = msg.sender.call{value: value}("");
    require(success, "WETH: ETH transfer failed");
  }

  /// @dev Burn `value` WETH10 token from caller account and withdraw matching ETH to account (`to`).
  /// Emits {Transfer} event to reflect WETH10 token burn of `value` to zero address from caller account.
  /// Requirements:
  ///   - caller account must have at least `value` balance of WETH10 token.
  function withdrawTo(address payable to, uint256 value) external override {
    // _burnFrom(msg.sender, value);
    uint256 balance = balanceOf[msg.sender];
    require(balance >= value, "WETH: burn amount exceeds balance");
    balanceOf[msg.sender] = balance - value;
    emit Transfer(msg.sender, address(0), value);

    // _transferEther(to, value);
    (bool success, ) = to.call{value: value}("");
    require(success, "WETH: ETH transfer failed");
  }

  /// @dev Burn `value` WETH10 token from account (`from`) and withdraw matching ETH to account (`to`).
  /// Emits {Approval} event to reflect reduced allowance `value` for caller account to spend from account (`from`),
  /// unless allowance is set to `type(uint256).max`
  /// Emits {Transfer} event to reflect WETH10 token burn of `value` to zero address from account (`from`).
  /// Requirements:
  ///   - `from` account must have at least `value` balance of WETH10 token.
  ///   - `from` account must have approved caller to spend at least `value` of WETH10 token, unless `from` and caller are the same account.
  function withdrawFrom(
    address from,
    address payable to,
    uint256 value
  ) external override {
    if (from != msg.sender) {
      // _decreaseAllowance(from, msg.sender, value);
      uint256 allowed = allowance[from][msg.sender];
      if (allowed != type(uint256).max) {
        require(allowed >= value, "WETH: request exceeds allowance");
        uint256 reduced = allowed - value;
        allowance[from][msg.sender] = reduced;
        emit Approval(from, msg.sender, reduced);
      }
    }

    // _burnFrom(from, value);
    uint256 balance = balanceOf[from];
    require(balance >= value, "WETH: burn amount exceeds balance");
    balanceOf[from] = balance - value;
    emit Transfer(from, address(0), value);

    // _transferEther(to, value);
    (bool success, ) = to.call{value: value}("");
    require(success, "WETH: Ether transfer failed");
  }

  /// @dev Sets `value` as allowance of `spender` account over caller account's WETH10 token.
  /// Emits {Approval} event.
  /// Returns boolean value indicating whether operation succeeded.
  function approve(address spender, uint256 value) external override returns (bool) {
    // _approve(msg.sender, spender, value);
    allowance[msg.sender][spender] = value;
    emit Approval(msg.sender, spender, value);

    return true;
  }

  /// @dev Sets `value` as allowance of `spender` account over caller account's WETH10 token,
  /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
  /// Emits {Approval} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// For more information on approveAndCall format, see https://github.com/ethereum/EIPs/issues/677.
  function approveAndCall(
    address spender,
    uint256 value,
    bytes calldata data
  ) external override returns (bool) {
    // _approve(msg.sender, spender, value);
    allowance[msg.sender][spender] = value;
    emit Approval(msg.sender, spender, value);

    return IApprovalReceiver(spender).onTokenApproval(msg.sender, value, data);
  }

  /// @dev Sets `value` as allowance of `spender` account over `owner` account's WETH10 token, given `owner` account's signed approval.
  /// Emits {Approval} event.
  /// Requirements:
  ///   - `deadline` must be timestamp in future.
  ///   - `v`, `r` and `s` must be valid `secp256k1` signature from `owner` account over EIP712-formatted function arguments.
  ///   - the signature must use `owner` account's current nonce (see {nonces}).
  ///   - the signer cannot be zero address and must be `owner` account.
  /// For more information on signature format, see https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP section].
  /// WETH10 token implementation adapted from https://github.com/albertocuestacanada/ERC20Permit/blob/master/contracts/ERC20Permit.sol.
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external override {
    require(block.timestamp <= deadline, "WETH: Expired permit");

    uint256 chainId;
    assembly {
      chainId := chainid()
    }
    bytes32 DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256(bytes(name)),
        keccak256(bytes("1")),
        chainId,
        address(this)
      )
    );

    bytes32 hashStruct = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline));

    bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hashStruct));

    address signer = ecrecover(hash, v, r, s);
    require(signer != address(0) && signer == owner, "WETH: invalid permit");

    // _approve(owner, spender, value);
    allowance[owner][spender] = value;
    emit Approval(owner, spender, value);
  }

  /// @dev Moves `value` WETH10 token from caller's account to account (`to`).
  /// A transfer to `address(0)` triggers an ETH withdraw matching the sent WETH10 token in favor of caller.
  /// Emits {Transfer} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// Requirements:
  ///   - caller account must have at least `value` WETH10 token.
  function transfer(address to, uint256 value) external override returns (bool) {
    // _transferFrom(msg.sender, to, value);
    if (to != address(0)) {
      // Transfer
      uint256 balance = balanceOf[msg.sender];
      require(balance >= value, "WETH: transfer amount exceeds balance");

      balanceOf[msg.sender] = balance - value;
      balanceOf[to] += value;
      emit Transfer(msg.sender, to, value);
    } else {
      // Withdraw
      uint256 balance = balanceOf[msg.sender];
      require(balance >= value, "WETH: burn amount exceeds balance");
      balanceOf[msg.sender] = balance - value;
      emit Transfer(msg.sender, address(0), value);

      (bool success, ) = msg.sender.call{value: value}("");
      require(success, "WETH: ETH transfer failed");
    }

    return true;
  }

  /// @dev Moves `value` WETH10 token from account (`from`) to account (`to`) using allowance mechanism.
  /// `value` is then deducted from caller account's allowance, unless set to `type(uint256).max`.
  /// A transfer to `address(0)` triggers an ETH withdraw matching the sent WETH10 token in favor of caller.
  /// Emits {Approval} event to reflect reduced allowance `value` for caller account to spend from account (`from`),
  /// unless allowance is set to `type(uint256).max`
  /// Emits {Transfer} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// Requirements:
  ///   - `from` account must have at least `value` balance of WETH10 token.
  ///   - `from` account must have approved caller to spend at least `value` of WETH10 token, unless `from` and caller are the same account.
  function transferFrom(
    address from,
    address to,
    uint256 value
  ) external override returns (bool) {
    if (from != msg.sender) {
      // _decreaseAllowance(from, msg.sender, value);

      uint256 allowed = allowance[from][msg.sender];
      if (allowed != type(uint256).max) {
        if (allowed < value) {
          console.log("FROM: %s TO: %s", from, to);
          console.log("allowed: %s value: %s", allowed, value);
        }
        require(allowed >= value, "WETH: request exceeds allowance");
        uint256 reduced = allowed - value;
        allowance[from][msg.sender] = reduced;
        emit Approval(from, msg.sender, reduced);
      }
    }

    // _transferFrom(from, to, value);
    if (to != address(0)) {
      // Transfer
      uint256 balance = balanceOf[from];
      require(balance >= value, "WETH: transfer amount exceeds balance");

      balanceOf[from] = balance - value;
      balanceOf[to] += value;
      emit Transfer(from, to, value);
    } else {
      // Withdraw
      uint256 balance = balanceOf[from];
      require(balance >= value, "WETH: burn amount exceeds balance");
      balanceOf[from] = balance - value;
      emit Transfer(from, address(0), value);

      (bool success, ) = msg.sender.call{value: value}("");
      require(success, "WETH: ETH transfer failed");
    }

    return true;
  }

  /// @dev Moves `value` WETH10 token from caller's account to account (`to`),
  /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
  /// A transfer to `address(0)` triggers an ETH withdraw matching the sent WETH10 token in favor of caller.
  /// Emits {Transfer} event.
  /// Returns boolean value indicating whether operation succeeded.
  /// Requirements:
  ///   - caller account must have at least `value` WETH10 token.
  /// For more information on transferAndCall format, see https://github.com/ethereum/EIPs/issues/677.
  function transferAndCall(
    address to,
    uint256 value,
    bytes calldata data
  ) external override returns (bool) {
    // _transferFrom(msg.sender, to, value);
    if (to != address(0)) {
      // Transfer
      uint256 balance = balanceOf[msg.sender];
      require(balance >= value, "WETH: transfer amount exceeds balance");

      balanceOf[msg.sender] = balance - value;
      balanceOf[to] += value;
      emit Transfer(msg.sender, to, value);
    } else {
      // Withdraw
      uint256 balance = balanceOf[msg.sender];
      require(balance >= value, "WETH: burn amount exceeds balance");
      balanceOf[msg.sender] = balance - value;
      emit Transfer(msg.sender, address(0), value);

      (bool success, ) = msg.sender.call{value: value}("");
      require(success, "WETH: ETH transfer failed");
    }

    return ITransferReceiver(to).onTokenTransfer(msg.sender, value, data);
  }
}

contract PyroWeth10Proxy is Ownable {
  // address public baseToken;
  IWETH10 public weth10;
  uint256 constant ONE = 1e18;
  bool unlocked = true;
  address public baseToken;
  modifier reentrancyGuard() {
    require(unlocked, "PyroProxy: reentrancy guard active");
    unlocked = false;
    _;
    unlocked = true;
  }

  constructor(address pyroWeth) {
    baseToken = pyroWeth;
    (, address weth, , ) = PyroTokenLike(pyroWeth).config();
    weth10 = IWETH10(weth);
    IERC20(weth10).approve(baseToken, type(uint256).max);
  }

  function balanceOf(address holder) external view returns (uint256) {
    return IERC20(baseToken).balanceOf(holder);
  }

  function redeem(uint256 pyroTokenAmount) external reentrancyGuard returns (uint256) {
    IERC20(baseToken).transferFrom(msg.sender, address(this), pyroTokenAmount); //0.1% fee
    uint256 actualAmount = IERC20(baseToken).balanceOf(address(this));
    PyroTokenLike(baseToken).redeem(actualAmount);
    uint256 balanceOfWeth = weth10.balanceOf(address(this));
    weth10.withdrawTo(payable(msg.sender), balanceOfWeth);
    return balanceOfWeth;
  }

  function mint(uint256 baseTokenAmount) external payable reentrancyGuard returns (uint256) {
    require(msg.value == baseTokenAmount && baseTokenAmount > 0, "PyroWethProxy: amount invariant");
    weth10.deposit{value: msg.value}();
    uint256 weth10Balance = weth10.balanceOf(address(this));
    PyroTokenLike(baseToken).mint(weth10Balance);
    uint256 pyroWethBalance = IERC20(baseToken).balanceOf(address(this));
    IERC20(baseToken).transfer(msg.sender, pyroWethBalance);
    return (pyroWethBalance * 999) / 1000; //0.1% fee
  }

  function calculateMintedPyroWeth(uint256 baseTokenAmount) external view returns (uint256) {
    uint256 pyroTokenRedeemRate = PyroTokenLike(baseToken).redeemRate();
    uint256 mintedPyroTokens = (baseTokenAmount * ONE) / (pyroTokenRedeemRate);
    return (mintedPyroTokens * 999) / 1000; //0.1% fee
  }

  function calculateRedeemedWeth(uint256 pyroTokenAmount) external view returns (uint256) {
    uint256 pyroTokenSupply = IERC20(baseToken).totalSupply() - ((pyroTokenAmount * 1) / 1000);
    uint256 wethBalance = IERC20(weth10).balanceOf(baseToken);
    uint256 newRedeemRate = (wethBalance * ONE) / pyroTokenSupply;
    uint256 newPyroTokenbalance = (pyroTokenAmount * 999) / 1000;
    uint256 fee = (newPyroTokenbalance * 2) / 100;
    uint256 net = newPyroTokenbalance - fee;
    return (net * newRedeemRate) / ONE;
  }

  function redeemRate() public view returns (uint256) {
    return PyroTokenLike(baseToken).redeemRate();
  }
}
