pragma solidity 0.5.17;


/**
 * This is an implementation of the ERC20 interface but without any data
 * backing the token to be used in tests.
 *
 * This contract should not be used in production.
 */
contract TestErc20Noop
{
  uint suppressCompileWarning;

  function transfer(
    address /* to */,
    uint /* value */
  ) external
    returns (bool)
  {
    suppressCompileWarning++;
    return true;
  }

  function approve(
    address /* spender */,
    uint /* value */
  ) external
    returns (bool)
  {
    suppressCompileWarning++;
    return true;
  }

  function mint(
    address /* to */,
    uint /* value */
  ) public
    returns (bool)
  {
    suppressCompileWarning++;
    return true;
  }

  function transferFrom(
    address /* from */,
    address /* to */,
    uint /* value */
  ) external
    returns (bool)
  {
    suppressCompileWarning++;
    return true;
  }

  function balanceOf(
    address /* who */
  ) external view
    returns (uint)
  {
    require(suppressCompileWarning >= 0, 'Suppressing the Solidity compile warning');
    return uint(-1);
  }
}
