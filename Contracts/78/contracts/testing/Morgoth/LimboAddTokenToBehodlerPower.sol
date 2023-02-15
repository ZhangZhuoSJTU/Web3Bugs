// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

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

abstract contract AngbandLike {
  function getAddress(bytes32 _key) public view virtual returns (address);

  bytes32 public constant POWERREGISTRY = "POWERREGISTRY";

  function setBehodler(address behodler, address lachesis) public virtual;
}

abstract contract LachesisLike {
  function measure(
    address token,
    bool valid,
    bool burnable
  ) public virtual;

  function updateBehodler(address token) public virtual;

  function setBehodler(address b) public virtual;
}

interface IERC20 {
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

interface BehodlerLike is IERC20 {
  function addLiquidity(address inputToken, uint256 amount) external payable returns (uint256 deltaSCX);

  function withdrawLiquidityFindSCX(
    address outputToken,
    uint256 tokensToRelease,
    uint256 scx,
    uint256 passes
  ) external view returns (uint256);

  function setValidToken(
    address token,
    bool valid,
    bool burnable
  ) external;
}

contract LimboAddTokenToBehodlerTestNet {
    event PowerInvoked(address user, bytes32 minion, bytes32 domain);

  struct Parameters {
    address soul;
    bool burnable;
    address limbo;
  }

  struct Config{
    address behodler;
    address lachesis;
    address angband;
  }

  Parameters public params;
  Config config;

  constructor(address angband, address behodler,address lachesis, address limbo){
    params.limbo = limbo;
    config.angband = angband;
    config.lachesis = lachesis;
    config.behodler = behodler;
  }

  function parameterize(address soul, bool burnable) public {
    require(msg.sender == params.limbo, "MORGOTH: Only Limbo can migrate tokens from Limbo.");
    params.soul = soul;
    params.burnable = burnable;
  }

 function invoke(bytes32 minion, address sender) public {
    require(msg.sender == address(config.angband), "MORGOTH: angband only");
    require(orchestrate(), "MORGOTH: Power invocation");
    emit PowerInvoked(sender, minion, "domain");
  }

  function orchestrate() internal returns (bool) {
    require(params.soul != address(0), "MORGOTH: PowerInvoker not parameterized.");
    LachesisLike lachesis = LachesisLike(config.lachesis);
    lachesis.measure(params.soul, true, params.burnable);
    lachesis.updateBehodler(params.soul);
    uint256 balanceOfToken = IERC20(params.soul).balanceOf(address(this));
    require(balanceOfToken > 0, "MORGOTH: remember to seed contract");
    IERC20(params.soul).approve(config.behodler, type(uint256).max);
    BehodlerLike(config.behodler).addLiquidity(params.soul, balanceOfToken);
    uint256 scxBal = IERC20(config.behodler).balanceOf(address(this));
    IERC20(config.behodler).transfer(params.limbo, scxBal);
    params.soul = address(0); // prevent non limbo from executing.
    return true;
  }
}
