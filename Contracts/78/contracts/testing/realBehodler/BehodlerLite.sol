// File: contracts/openzeppelin/Ownable.sol

// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "hardhat/console.sol";
import "./CommonIERC20.sol";

abstract contract Burnable {
  function burn(uint256 amount) public virtual;

  function symbol() public pure virtual returns (string memory);

  function burn(address holder, uint256 amount) public virtual;
}

contract ScarcityLite is CommonIERC20 {
  event Mint(address sender, address recipient, uint256 value);
  event Burn(uint256 value);

  mapping(address => uint256) internal balances;
  mapping(address => mapping(address => uint256)) internal _allowances;
  uint256 internal _totalSupply;

  struct BurnConfig {
    uint256 transferFee; // percentage expressed as number betewen 1 and 1000
    uint256 burnFee; // percentage expressed as number betewen 1 and 1000
    address feeDestination;
  }

  BurnConfig public config;

  function configureScarcity(
    uint256 transferFee,
    uint256 burnFee,
    address feeDestination
  ) public {
    require(config.transferFee + config.burnFee < 1000);
    config.transferFee = transferFee;
    config.burnFee = burnFee;
    config.feeDestination = feeDestination;
  }

  function getConfiguration()
    public
    view
    returns (
      uint256,
      uint256,
      address
    )
  {
    return (config.transferFee, config.burnFee, config.feeDestination);
  }

  function name() public pure returns (string memory) {
    return "Scarcity";
  }

  function symbol() public pure returns (string memory) {
    return "SCX";
  }

  function decimals() public pure override returns (uint8) {
    return 18;
  }

  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) external view override returns (uint256) {
    return balances[account];
  }

  function transfer(address recipient, uint256 amount) external override returns (bool) {
    _transfer(msg.sender, recipient, amount);
    return true;
  }

  function allowance(address owner, address spender) external view override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external override returns (bool) {
    _transfer(sender, recipient, amount);
    _approve(sender, msg.sender, _allowances[sender][msg.sender] - (amount));
    return true;
  }

  function burn(uint256 value) external returns (bool) {
    burn(msg.sender, value);
    return true;
  }

  function burn(address holder, uint256 value) internal {
    balances[holder] = balances[holder] - value;
    _totalSupply = _totalSupply - value;
    emit Burn(value);
  }

  function mint(address recipient, uint256 value) internal {
    balances[recipient] = balances[recipient] + (value);
    _totalSupply = _totalSupply + (value);
    emit Mint(msg.sender, recipient, value);
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

  //outside of Behodler, Scarcity transfer incurs a fee.
  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), "Scarcity: transfer from the zero address");
    require(recipient != address(0), "Scarcity: transfer to the zero address");

    uint256 feeComponent = (config.transferFee * amount) / (1000);
    console.log("transferFee %s, amount %s, feeComponent %s", config.transferFee, amount, feeComponent);
    uint256 burnComponent = (config.burnFee * amount) / (1000);
    _totalSupply = _totalSupply - burnComponent;
    emit Burn(burnComponent);

    balances[config.feeDestination] = balances[config.feeDestination] + (feeComponent);

    balances[sender] = balances[sender] - (amount);

    balances[recipient] = balances[recipient] + (amount - (feeComponent + burnComponent));
    emit Transfer(sender, recipient, amount);
  }

  function applyBurnFee(
    address token,
    uint256 amount,
    bool proxyBurn
  ) internal returns (uint256) {
    uint256 burnAmount = (config.burnFee * amount) / (1000);
    Burnable bToken = Burnable(token);
    if (proxyBurn) {
      bToken.burn(address(this), burnAmount);
    } else {
      bToken.burn(burnAmount);
    }

    return burnAmount;
  }
}

library AddressBalanceCheck {
  function tokenBalance(address token) public view returns (uint256) {
    return CommonIERC20(token).balanceOf(address(this));
  }

  function shiftedBalance(address token, uint256 factor) public view returns (uint256) {
    return CommonIERC20(token).balanceOf(address(this)) / factor;
  }

  function transferIn(
    address token,
    address sender,
    uint256 value
  ) public {
    CommonIERC20(token).transferFrom(sender, address(this), value);
  }

  function transferOut(
    address token,
    address recipient,
    uint256 value
  ) public {
    CommonIERC20(token).transfer(recipient, value);
  }
}

library ABDK {
  /*
   * Minimum value signed 64.64-bit fixed point number may have.
   */
  int128 private constant MIN_64x64 = -0x80000000000000000000000000000000;

  /*
   * Maximum value signed 64.64-bit fixed point number may have.
   */
  int128 private constant MAX_64x64 = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /**
   * Convert unsigned 256-bit integer number into signed 64.64-bit fixed point
   * number.  Revert on overflow.
   *
   * @param x unsigned 256-bit integer number
   * @return signed 64.64-bit fixed point number
   */
  function fromUInt(uint256 x) internal pure returns (int128) {
    require(x <= 0x7FFFFFFFFFFFFFFF);
    return int128(uint128(x << 64));
  }

  /**
   * Calculate x + y.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function add(int128 x, int128 y) internal pure returns (int128) {
    int256 result = int256(x) + y;
    require(result >= MIN_64x64 && result <= MAX_64x64);
    return int128(result);
  }

  /**
   * Calculate binary logarithm of x.  Revert if x <= 0.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function log_2(uint256 x) internal pure returns (uint256) {
    require(x > 0);

    uint256 msb = 0;
    uint256 xc = x;
    if (xc >= 0x10000000000000000) {
      xc >>= 64;
      msb += 64;
    }
    if (xc >= 0x100000000) {
      xc >>= 32;
      msb += 32;
    }
    if (xc >= 0x10000) {
      xc >>= 16;
      msb += 16;
    }
    if (xc >= 0x100) {
      xc >>= 8;
      msb += 8;
    }
    if (xc >= 0x10) {
      xc >>= 4;
      msb += 4;
    }
    if (xc >= 0x4) {
      xc >>= 2;
      msb += 2;
    }
    if (xc >= 0x2) msb += 1; // No need to shift xc anymore

    uint256 result = (msb - 64) << 64;
    uint256 ux = uint256(x) << uint256(127 - msb);
    for (uint256 bit = 0x8000000000000000; bit > 0; bit >>= 1) {
      ux *= ux;
      uint256 b = ux >> 255;
      ux >>= 127 + b;
      result += bit * b;
    }

    return result;
  }
}

contract StubLiquidityReceiver {}

contract LachesisLite {
  struct tokenConfig {
    bool valid;
    bool burnable;
  }
  address public behodler;
  mapping(address => tokenConfig) private config;

  function cut(address token) public view returns (bool, bool) {
    tokenConfig memory parameters = config[token];
    return (parameters.valid, parameters.burnable);
  }

  function measure(
    address token,
    bool valid,
    bool burnable
  ) public {
    _measure(token, valid, burnable);
  }

  function _measure(
    address token,
    bool valid,
    bool burnable
  ) internal {
    config[token] = tokenConfig({valid: valid, burnable: burnable});
  }

  function setBehodler(address b) public {
    behodler = b;
  }

  function updateBehodler(address token) public {
    (bool valid, bool burnable) = cut(token);

    BehodlerLite(behodler).setValidToken(token, valid, burnable);
    BehodlerLite(behodler).setTokenBurnable(token, burnable);
  }
}

contract BehodlerLite is ScarcityLite {
  using ABDK for int128;
  using ABDK for uint256;
  using AddressBalanceCheck for address;
  mapping(address => bool) validTokens;
  struct PrecisionFactors {
    uint8 swapPrecisionFactor;
    uint8 maxLiquidityExit; //percentage as number between 1 and 100
  }
  address receiver;
  address lachesis;
  PrecisionFactors safetyParameters;

  constructor() {
    receiver = address(new StubLiquidityReceiver());
    safetyParameters.swapPrecisionFactor = 30; //approximately a billion
    safetyParameters.maxLiquidityExit = 90;
  }

  function setLachesis(address l) public {
    lachesis = l;
  }

  function setValidToken(
    address token,
    bool valid,
    bool burnable
  ) public {
    require(msg.sender == lachesis);
    validTokens[token] = valid;
    tokenBurnable[token] = burnable;
  }

  modifier onlyValidToken(address token) {
    if (!validTokens[token]) console.log("invalid token %s", token);
    require(lachesis == address(0) || validTokens[token], "BehodlerLite: tokenInvalid");
    _;
  }

  function setReceiver(address newReceiver) public {
    receiver = newReceiver;
  }

  function setSafetParameters(uint8 swapPrecisionFactor, uint8 maxLiquidityExit) external {
    safetyParameters.swapPrecisionFactor = swapPrecisionFactor;
    safetyParameters.maxLiquidityExit = maxLiquidityExit;
  }

  //Logarithmic growth can get quite flat beyond the first chunk. We divide input amounts by
  uint256 public constant MIN_LIQUIDITY = 1e12;

  mapping(address => bool) public tokenBurnable;

  function setTokenBurnable(address token, bool burnable) public {
    tokenBurnable[token] = burnable;
  }

  mapping(address => bool) public whiteListUsers; // can trade on tokens that are disabled

  function swap(
    address inputToken,
    address outputToken,
    uint256 inputAmount,
    uint256 outputAmount
  ) external payable onlyValidToken(inputToken) returns (bool success) {
    uint256 initialInputBalance = inputToken.tokenBalance();

    inputToken.transferIn(msg.sender, inputAmount);

    uint256 netInputAmount = inputAmount - burnToken(inputToken, inputAmount);
    uint256 initialOutputBalance = outputToken.tokenBalance();
    require(
      (outputAmount * 100) / initialOutputBalance <= safetyParameters.maxLiquidityExit,
      "BEHODLER: liquidity withdrawal too large."
    );
    uint256 finalInputBalance = initialInputBalance + (netInputAmount);
    uint256 finalOutputBalance = initialOutputBalance - (outputAmount);

    //new scope to avoid stack too deep errors.
    {
      //if the input balance after adding input liquidity is 1073741824 bigger than the initial balance, we revert.
      uint256 inputRatio = (initialInputBalance << safetyParameters.swapPrecisionFactor) / finalInputBalance;
      uint256 outputRatio = (finalOutputBalance << safetyParameters.swapPrecisionFactor) / initialOutputBalance;

      require(inputRatio != 0 && inputRatio == outputRatio, "BEHODLER: swap invariant.");
    }

    require(finalOutputBalance >= MIN_LIQUIDITY, "BEHODLER: min liquidity.");
    outputToken.transferOut(msg.sender, outputAmount);
    success = true;
  }

  function addLiquidity(address inputToken, uint256 amount)
    external
    payable
    onlyValidToken(inputToken)
    returns (uint256 deltaSCX)
  {
    uint256 initialBalance = uint256(int256(inputToken.shiftedBalance(MIN_LIQUIDITY).fromUInt()));

    inputToken.transferIn(msg.sender, amount);

    uint256 netInputAmount = uint256(int256(((amount - burnToken(inputToken, amount)) / MIN_LIQUIDITY).fromUInt()));

    uint256 finalBalance = uint256(initialBalance + netInputAmount);
    require(uint256(finalBalance) >= MIN_LIQUIDITY, "BEHODLER: min liquidity.");
    deltaSCX = uint256(finalBalance.log_2() - (initialBalance > 1 ? initialBalance.log_2() : 0));
    mint(msg.sender, deltaSCX);
  }

  /*
        ΔSCX =  log(InitialBalance) - log(FinalBalance)
        tokensToRelease = InitialBalance -FinalBalance
        =>FinalBalance =  InitialBalance - tokensToRelease
        Then apply logs and deduct SCX from msg.sender

        The choice of base for the log isn't relevant from a mathematical point of view
        but from a computational point of view, base 2 is the cheapest for obvious reasons.
        "From my point of view, the Jedi are evil" - Darth Vader
     */
  function withdrawLiquidity(address outputToken, uint256 tokensToRelease)
    external
    payable
    onlyValidToken(outputToken)
    returns (uint256 deltaSCX)
  {
    uint256 initialBalance = outputToken.tokenBalance();
    uint256 finalBalance = initialBalance - tokensToRelease;
    require(finalBalance > MIN_LIQUIDITY, "BEHODLER: min liquidity");
    require(
      (tokensToRelease * 100) / initialBalance <= safetyParameters.maxLiquidityExit,
      "BEHODLER: liquidity withdrawal too large."
    );

    uint256 logInitial = initialBalance.log_2();
    uint256 logFinal = finalBalance.log_2();

    deltaSCX = logInitial - (finalBalance > 1 ? logFinal : 0);
    uint256 scxBalance = balances[msg.sender];

    if (deltaSCX > scxBalance) {
      //rounding errors in scx creation and destruction. Err on the side of holders
      uint256 difference = deltaSCX - scxBalance;
      if ((difference * 10000) / deltaSCX == 0) deltaSCX = scxBalance;
    }
    burn(msg.sender, deltaSCX);
    outputToken.transferOut(msg.sender, tokensToRelease);
  }

  /*
        ΔSCX =  log(InitialBalance) - log(FinalBalance)
        tokensToRelease = InitialBalance -FinalBalance
        =>FinalBalance =  InitialBalance - tokensToRelease
        Then apply logs and deduct SCX from msg.sender

        The choice of base for the log isn't relevant from a mathematical point of view
        but from a computational point of view, base 2 is the cheapest for obvious reasons.
        "From my point of view, the Jedi are evil" - Darth Vader
     */
  function withdrawLiquidityFindSCX(
    address outputToken,
    uint256 tokensToRelease,
    uint256 scx,
    uint256 passes
  ) external view returns (uint256) {
    uint256 upperBoundary = outputToken.tokenBalance();
    uint256 lowerBoundary = 0;

    for (uint256 i = 0; i < passes; i++) {
      uint256 initialBalance = outputToken.tokenBalance();
      uint256 finalBalance = initialBalance - tokensToRelease;

      uint256 logInitial = initialBalance.log_2();
      uint256 logFinal = finalBalance.log_2();

      int256 deltaSCX = int256(logInitial - (finalBalance > 1 ? logFinal : 0));
      int256 difference = int256(scx) - deltaSCX;
      // if (difference**2 < 1000000) return tokensToRelease;
      if (difference == 0) return tokensToRelease;
      if (difference < 0) {
        // too many tokens requested
        upperBoundary = tokensToRelease - 1;
      } else {
        //too few tokens requested
        lowerBoundary = tokensToRelease + 1;
      }
      tokensToRelease = ((upperBoundary - lowerBoundary) / 2) + lowerBoundary; //bitshift
      tokensToRelease = tokensToRelease > initialBalance ? initialBalance : tokensToRelease;
    }
    return tokensToRelease;
  }

  function burnToken(address token, uint256 amount) private returns (uint256 burnt) {
    if (tokenBurnable[token]) {
      burnt = applyBurnFee(token, amount, false);
    } else {
      burnt = (config.burnFee * amount) / (1000);
      token.transferOut(receiver, burnt);
    }
  }
}
