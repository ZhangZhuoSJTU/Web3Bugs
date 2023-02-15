// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "./interfaces/IStaker.sol";
import "./interfaces/ILongShort.sol";
import "./interfaces/ISyntheticToken.sol";

/**
@title SyntheticToken
@notice An ERC20 token that tracks or inversely tracks the price of an
        underlying asset with floating exposure.
@dev Logic for price tracking contained in LongShort.sol. 
     The contract inherits from ERC20PresetMinterPauser.sol
*/
contract SyntheticToken is ISyntheticToken {
  /// @notice Address of the LongShort contract, a deployed LongShort.sol
  address public longShort;
  /// @notice Address of the Staker contract, a deployed Staker.sol
  address public staker;
  /// @notice Identifies which market in longShort the token is for.
  uint32 public marketIndex;
  /// @notice Whether the token is a long token or short token for its market.
  bool public isLong;

  /// @notice Creates an instance of the contract.
  /// @dev Should only be called by TokenFactory.sol for our system.
  /// @param name The name of the token.
  /// @param symbol The symbol for the token.
  /// @param _longShort Address of the core LongShort contract.
  /// @param _staker Address of the staker contract.
  /// @param _marketIndex Which market the token is for.
  /// @param _isLong Whether the token is long or short for its market.
  constructor(
    string memory name,
    string memory symbol,
    address _longShort,
    address _staker,
    uint32 _marketIndex,
    bool _isLong
  ) ERC20PresetMinterPauser(name, symbol) {
    longShort = _longShort;
    staker = _staker;
    marketIndex = _marketIndex;
    isLong = _isLong;
  }

  /// @notice Allows users to stake their synthetic tokens to earn Float.
  /// @dev Core staking logic contained in Staker.sol
  /// @param amount Amount to stake in wei.
  function stake(uint256 amount) external override {
    // NOTE: this is safe, this function will throw "ERC20: transfer
    //       amount exceeds balance" if amount exceeds users balance.
    super._transfer(msg.sender, address(staker), amount);

    IStaker(staker).stakeFromUser(msg.sender, amount);
  }

  /*╔══════════════════════════════════════════════════════╗
    ║    FUNCTIONS INHERITED BY ERC20PresetMinterPauser    ║
    ╚══════════════════════════════════════════════════════╝*/

  /** 
  @notice Mints a number of synthetic tokens for an address.
  @dev Can only be called by addresses with a minter role. 
        This should correspond to the Long Short contract.
  @param to The address for which to mint the tokens for.
  @param amount Amount of synthetic tokens to mint in wei.
  */
  function mint(address to, uint256 amount) public override {
    ERC20PresetMinterPauser.mint(to, amount);
  }

  /// @notice Burns or destroys a number of held synthetic tokens for an address.
  /// @dev Modified to only allow Long Short to burn tokens on redeem.
  /// @param account The account for which to burn tokens for.
  /// @param amount The amount of tokens to burn in wei.
  function _burn(address account, uint256 amount) internal override {
    require(msg.sender == longShort, "Only LongShort contract");
    super._burn(account, amount);
  }

  /** 
  @notice Overrides the default ERC20 transferFrom.
  @dev To allow users to avoid approving LongShort when redeeming tokens,
       longShort has a virtual infinite allowance.
  @param sender User for which to transfer tokens.
  @param recipient Recipient of the transferred tokens.
  @param amount Amount of tokens to transfer in wei.
  */
  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public override returns (bool) {
    if (recipient == longShort && msg.sender == longShort) {
      super._transfer(sender, recipient, amount);
      return true;
    } else {
      return super.transferFrom(sender, recipient, amount);
    }
  }

  /** 
  @notice Overrides the OpenZeppelin _beforeTokenTransfer hook
  @dev Ensures that this contract's accounting reflects all the senders's outstanding
       tokens from next price actions before any token transfer occurs.
       Removal of pausing functionality of ERC20PresetMinterPausable is intentional.
  @param sender User for which tokens are to be transferred for.
  */
  function _beforeTokenTransfer(
    address sender,
    address,
    uint256
  ) internal override {
    if (sender != longShort) {
      ILongShort(longShort).executeOutstandingNextPriceSettlementsUser(sender, marketIndex);
    }
  }

  /** 
  @notice Gets the synthetic token balance of the user in wei.
  @dev To automatically account for next price actions which have been confirmed but not settled,
        includes any outstanding tokens owed by longShort.
  @param account The address for which to get the balance of.
  */
  function balanceOf(address account) public view virtual override returns (uint256) {
    return
      ERC20.balanceOf(account) +
      ILongShort(longShort).getUsersConfirmedButNotSettledSynthBalance(account, marketIndex, isLong);
  }
}
