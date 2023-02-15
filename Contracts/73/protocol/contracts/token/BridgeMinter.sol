pragma solidity ^0.5.11;

import "../Manager.sol";

interface IBridgeMinterToken {
    function transfer(address _to, uint256 _amount) external;

    function mint(address _to, uint256 _amount) external;

    function transferOwnership(address _owner) external;

    function balanceOf(address _addr) external view returns (uint256);
}

contract BridgeMinter is Manager {
    address public tokenAddr;
    address public l1MigratorAddr;
    address public l1LPTGatewayAddr;

    modifier onlyL1Migrator() {
        require(msg.sender == l1MigratorAddr, "NOT_L1_MIGRATOR");
        _;
    }

    modifier onlyL1LPTGateway() {
        require(msg.sender == l1LPTGatewayAddr, "NOT_L1_LPT_GATEWAY");
        _;
    }

    constructor(
        address _controller,
        address _tokenAddr,
        address _l1MigratorAddr,
        address _l1LPTGatewayAddr
    ) public Manager(_controller) {
        tokenAddr = _tokenAddr;
        l1MigratorAddr = _l1MigratorAddr;
        l1LPTGatewayAddr = _l1LPTGatewayAddr;
    }

    /**
     * @notice Set LPT address. Only callable by Controller owner
     * @param _tokenAddr LPT address
     */
    function setToken(address _tokenAddr) external onlyControllerOwner {
        tokenAddr = _tokenAddr;
    }

    /**
     * @notice Set L1Migrator address. Only callable by Controller owner
     * @param _l1MigratorAddr L1Migrator address
     */
    function setL1Migrator(address _l1MigratorAddr) external onlyControllerOwner {
        l1MigratorAddr = _l1MigratorAddr;
    }

    /**
     * @notice Set L1LPTGateway address. Only callable by Controller owner
     * @param _l1LPTGatewayAddr L1LPTGateway address
     */
    function setL1LPTGateway(address _l1LPTGatewayAddr) external onlyControllerOwner {
        l1LPTGatewayAddr = _l1LPTGatewayAddr;
    }

    /**
     * @notice Migrate to a new Minter. Only callable by Controller owner
     * @param _newMinterAddr New Minter address
     */
    function migrateToNewMinter(address _newMinterAddr) external onlyControllerOwner {
        require(
            _newMinterAddr != address(this) && _newMinterAddr != address(0),
            "BridgeMinter#migrateToNewMinter: INVALID_MINTER"
        );

        IBridgeMinterToken token = IBridgeMinterToken(tokenAddr);
        // Transfer ownership of token to new Minter
        token.transferOwnership(_newMinterAddr);
        // Transfer current Minter's LPT balance to new Minter
        token.transfer(_newMinterAddr, token.balanceOf(address(this)));
        // Transfer current Minter's ETH balance to new Minter
        // call() should be safe from re-entrancy here because the Controller owner and _newMinterAddr are trusted
        (bool ok, ) = _newMinterAddr.call.value(address(this).balance)("");
        require(ok, "BridgeMinter#migrateToNewMinter: FAIL_CALL");
    }

    /**
     * @notice Send contract's ETH to L1Migrator. Only callable by L1Migrator
     * @return Amount of ETH sent
     */
    function withdrawETHToL1Migrator() external onlyL1Migrator returns (uint256) {
        uint256 balance = address(this).balance;

        // call() should be safe from re-entrancy here because the L1Migrator and l1MigratorAddr are trusted
        (bool ok, ) = l1MigratorAddr.call.value(address(this).balance)("");
        require(ok, "BridgeMinter#withdrawETHToL1Migrator: FAIL_CALL");

        return balance;
    }

    /**
     * @notice Send contract's LPT to L1Migrator. Only callable by L1Migrator
     * @return Amount of LPT sent
     */
    function withdrawLPTToL1Migrator() external onlyL1Migrator returns (uint256) {
        IBridgeMinterToken token = IBridgeMinterToken(tokenAddr);

        uint256 balance = token.balanceOf(address(this));

        token.transfer(l1MigratorAddr, balance);

        return balance;
    }

    /**
     * @notice Mint LPT to address. Only callable by L1LPTGateway
     * @dev Relies on L1LPTGateway for minting rules
     * @param _to Address to receive LPT
     * @param _amount Amount of LPT to mint
     */
    function bridgeMint(address _to, uint256 _amount) external onlyL1LPTGateway {
        IBridgeMinterToken(tokenAddr).mint(_to, _amount);
    }

    /**
     * @notice Deposit ETH. Required for migrateToNewMinter() from older Minter implementation
     */
    function depositETH() external payable returns (bool) {
        return true;
    }

    /**
     * @notice Returns Controller address. Required for migrateToNewMinter() from older Minter implementation
     * @return Controller address
     */
    function getController() public view returns (address) {
        return address(controller);
    }
}
