pragma solidity 0.5.17;

/**
  * Smart contract wallet to support swapping between old ERC-20 token to a new contract.
  * It also supports swap and deposit into mainchainGateway in a single transaction.
  * Pre-requisites: New token needs to be transferred to this contract.
  * Dev should check that the decimals and supply of old token and new token are identical.
 */
contract TokenSwap is HasAdmin {
  IERC20 public oldToken;
  IERC20 public newToken;
  MainchainGateway public mainchainGateway;

  constructor(
    IERC20 _oldToken,
    IERC20 _newToken
  )
    public
  {
    oldToken = _oldToken;
    newToken = _newToken;
  }

  function setGateway(MainchainGateway _mainchainGateway) external onlyAdmin {
    if (address(mainchainGateway) != address(0)) {
      require(newToken.approve(address(mainchainGateway), 0));
    }

    mainchainGateway = _mainchainGateway;
    require(newToken.approve(address(mainchainGateway), uint256(-1)));
  }

  function swapToken() external {
    uint256 _balance = oldToken.balanceOf(msg.sender);
    require(oldToken.transferFrom(msg.sender, address(this), _balance));
    require(newToken.transfer(msg.sender, _balance));
  }

  function swapAndBridge(address _recipient, uint256 _amount) external {
    require(_recipient != address(0), "TokenSwap: recipient is the zero address");
    uint256 _balance = oldToken.balanceOf(msg.sender);
    require(oldToken.transferFrom(msg.sender, address(this), _balance));

    require(_amount <= _balance);
    require(newToken.transfer(msg.sender, _balance - _amount));
    mainchainGateway.depositERC20For(_recipient, address(newToken), _amount);
  }

  function swapAndBridgeAll(address _recipient) external {
    require(_recipient != address(0), "TokenSwap: recipient is the zero address");
    uint256 _balance = oldToken.balanceOf(msg.sender);
    require(oldToken.transferFrom(msg.sender, address(this), _balance));
    mainchainGateway.depositERC20For(_recipient, address(newToken), _balance);
  }

  // Used when some old token lost forever
  function withdrawToken() external onlyAdmin {
    newToken.transfer(msg.sender, newToken.balanceOf(address(this)));
  }
}