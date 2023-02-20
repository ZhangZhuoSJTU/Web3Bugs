// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

/**


    ██████╗ █████╗  ██╗     ██╗  ██╗   ██╗
    ██╔════╝██╔══██╗██║     ██║  ╚██╗ ██╔╝
    ██║     ███████║██║     ██║   ╚████╔╝ 
    ██║     ██╔══██║██║     ██║    ╚██╔╝  
    ╚██████╗██║  ██║███████╗███████╗██║   
     ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝   
                                      

    
    NFT & ERC20 covered call vaults.
    this is intended to be a public good.
    pog pog pog.
    

*/

import "solmate/utils/SafeTransferLib.sol";
import "solmate/utils/ReentrancyGuard.sol";
import "openzeppelin/access/Ownable.sol";

import "./CallyNft.sol";

/// @title Cally - https://cally.finance
/// @author out.eth
/// @notice NFT & ERC20 covered call vaults
contract Cally is CallyNft, ReentrancyGuard, Ownable {
    using SafeTransferLib for ERC20;
    using SafeTransferLib for address payable;

    /// @notice Fires when a new vault has been created
    /// @param vaultId The newly minted vault NFT
    /// @param from The account that created the vault
    /// @param token The token address of the underlying asset
    event NewVault(uint256 indexed vaultId, address indexed from, address indexed token);

    /// @notice Fires when an option has been bought from a vault
    /// @param optionId The newly minted option NFT
    /// @param from The account that bought the option
    /// @param token The token address of the underlying asset
    event BoughtOption(uint256 indexed optionId, address indexed from, address indexed token);

    /// @notice Fires when an option is exercised
    /// @param optionId The option NFT which is being exercised
    /// @param from The account that exercised the option
    event ExercisedOption(uint256 indexed optionId, address indexed from);

    /// @notice Fires when someone harvests their ETH balance
    /// @param from The account that is harvesting
    /// @param amount The amount of ETH which was harvested
    event Harvested(address indexed from, uint256 amount);

    /// @notice Fires when someone initiates a withdrawal on their vault
    /// @param vaultId The vault NFT which is being withdrawn
    /// @param from The account that is initiating the withdrawal
    event InitiatedWithdrawal(uint256 indexed vaultId, address indexed from);

    /// @notice Fires when someone withdraws their vault
    /// @param vaultId The vault NFT which is being withdrawn
    /// @param from The account that is withdrawing
    event Withdrawal(uint256 indexed vaultId, address indexed from);

    enum TokenType {
        ERC721,
        ERC20
    }

    struct Vault {
        uint256 tokenIdOrAmount;
        address token;
        uint8 premiumIndex; // indexes into `premiumOptions`
        uint8 durationDays; // days
        uint8 dutchAuctionStartingStrikeIndex; // indexes into `strikeOptions`
        uint32 currentExpiration;
        bool isExercised;
        bool isWithdrawing;
        TokenType tokenType;
        uint256 currentStrike;
        uint256 dutchAuctionReserveStrike;
    }

    uint32 public constant AUCTION_DURATION = 24 hours;

    // prettier-ignore
    uint256[] public premiumOptions = [0.01 ether, 0.025 ether, 0.05 ether, 0.075 ether, 0.1 ether, 0.25 ether, 0.5 ether, 0.75 ether, 1.0 ether, 2.5 ether, 5.0 ether, 7.5 ether, 10 ether, 25 ether, 50 ether, 75 ether, 100 ether];
    // prettier-ignore
    uint256[] public strikeOptions = [1 ether, 2 ether, 3 ether, 5 ether, 8 ether, 13 ether, 21 ether, 34 ether, 55 ether, 89 ether, 144 ether, 233 ether, 377 ether, 610 ether, 987 ether, 1597 ether, 2584 ether, 4181 ether, 6765 ether];

    uint256 public feeRate = 0;
    uint256 public protocolUnclaimedFees = 0;

    /// @notice The current vault index. Used for determining which
    ///         tokenId to use when minting a new vault. Increments by
    ///         2 on each new mint.
    uint256 public vaultIndex = 1;

    /// @notice Mapping of vault tokenId -> vault information
    mapping(uint256 => Vault) private _vaults;

    /// @notice Mapping of vault tokenId -> vault beneficiary.
    ///         Beneficiary is credited the premium when option is
    ///         purchased or strike ETH when option is exercised.
    mapping(uint256 => address) private _vaultBeneficiaries;

    /// @notice The unharvested ethBalance of each account
    mapping(address => uint256) public ethBalance;

    /*********************
        ADMIN FUNCTIONS
    **********************/

    /// @notice Sets the fee that is applied on exercise
    /// @param feeRate_ The new fee rate: fee = 1% = (1 / 100) * 1e18
    function setFee(uint256 feeRate_) external onlyOwner {
        feeRate = feeRate_;
    }

    /// @notice Withdraws the protocol fees and sends to current owner
    function withdrawProtocolFees() external onlyOwner returns (uint256 amount) {
        amount = protocolUnclaimedFees;
        protocolUnclaimedFees = 0;
        payable(msg.sender).safeTransferETH(amount);
    }

    /**************************
        MAIN LOGIC FUNCTIONS
    ***************************/

    /*
        standard lifecycle:
            createVault
            buyOption (repeats)
            exercise
            initiateWithdraw
            withdraw

        [*] setVaultBeneficiary
        [*] harvest

        [*] can be called anytime in lifecycle
    */

    /// @notice Creates a new vault that perpetually sells calls
    ///         on the underlying assets until a call option is exercised
    ///         or the owner initiates a withdrawal.
    /// @param tokenIdOrAmount The tokenId (NFT) or amount (ERC20) to vault
    /// @param token The address of the NFT or ERC20 contract to vault
    /// @param premiumIndex The index into the premiumOptions of each call that is sold
    /// @param durationDays The length/duration of each call that is sold in days
    /// @param dutchAuctionStartingStrikeIndex The index into the strikeOptions for the starting strike for each dutch auction
    /// @param dutchAuctionReserveStrike The reserve strike for each dutch auction
    /// @param tokenType The type of the underlying asset (NFT or ERC20)
    function createVault(
        uint256 tokenIdOrAmount,
        address token,
        uint8 premiumIndex,
        uint8 durationDays,
        uint8 dutchAuctionStartingStrikeIndex,
        uint256 dutchAuctionReserveStrike,
        TokenType tokenType
    ) external returns (uint256 vaultId) {
        require(premiumIndex < premiumOptions.length, "Invalid premium index");
        require(dutchAuctionStartingStrikeIndex < strikeOptions.length, "Invalid strike index");
        require(dutchAuctionReserveStrike < strikeOptions[dutchAuctionStartingStrikeIndex], "Reserve strike too small");
        require(durationDays > 0, "durationDays too small");
        require(tokenType == TokenType.ERC721 || tokenType == TokenType.ERC20, "Invalid token type");

        Vault memory vault = Vault({
            tokenIdOrAmount: tokenIdOrAmount,
            token: token,
            premiumIndex: premiumIndex,
            durationDays: durationDays,
            dutchAuctionStartingStrikeIndex: dutchAuctionStartingStrikeIndex,
            currentExpiration: uint32(block.timestamp),
            isExercised: false,
            isWithdrawing: false,
            tokenType: tokenType,
            currentStrike: 0,
            dutchAuctionReserveStrike: dutchAuctionReserveStrike
        });

        // vault index should always be odd
        vaultIndex += 2;
        vaultId = vaultIndex;
        _vaults[vaultId] = vault;

        // give msg.sender vault token
        _mint(msg.sender, vaultId);

        emit NewVault(vaultId, msg.sender, token);

        // transfer the NFTs or ERC20s to the contract
        vault.tokenType == TokenType.ERC721
            ? ERC721(vault.token).transferFrom(msg.sender, address(this), vault.tokenIdOrAmount)
            : ERC20(vault.token).safeTransferFrom(msg.sender, address(this), vault.tokenIdOrAmount);
    }

    /// @notice Buys an option from a vault at a fixed premium and variable strike
    ///         which is dependent on the dutch auction. Premium is credited to
    ///         vault beneficiary.
    /// @param vaultId The tokenId of the vault to buy the option from
    function buyOption(uint256 vaultId) external payable returns (uint256 optionId) {
        Vault memory vault = _vaults[vaultId];

        // vaultId should always be odd
        require(vaultId % 2 != 0, "Not vault type");

        // check vault exists
        require(ownerOf(vaultId) != address(0), "Vault does not exist");

        // check that the vault still has the NFTs as collateral
        require(vault.isExercised == false, "Vault already exercised");

        // check that the vault is not in withdrawing state
        require(vault.isWithdrawing == false, "Vault is being withdrawn");

        // check enough eth was sent to cover premium
        uint256 premium = getPremium(vaultId);
        require(msg.value >= premium, "Incorrect ETH amount sent");

        // check option associated with the vault has expired
        uint32 auctionStartTimestamp = vault.currentExpiration;
        require(block.timestamp >= auctionStartTimestamp, "Auction not started");

        // set new currentStrike
        vault.currentStrike = getDutchAuctionStrike(
            strikeOptions[vault.dutchAuctionStartingStrikeIndex],
            vault.currentExpiration + AUCTION_DURATION,
            vault.dutchAuctionReserveStrike
        );

        // set new expiration
        vault.currentExpiration = uint32(block.timestamp) + (vault.durationDays * 1 days);

        // update the vault with the new option expiration and strike
        _vaults[vaultId] = vault;

        // force transfer the vault's associated option from old owner to new owner
        // option id for a respective vault is always vaultId + 1
        optionId = vaultId + 1;
        _forceTransfer(msg.sender, optionId);

        // increment vault beneficiary's unclaimed premiums
        address beneficiary = getVaultBeneficiary(vaultId);
        ethBalance[beneficiary] += msg.value;

        emit BoughtOption(optionId, msg.sender, vault.token);
    }

    /// @notice Exercises a call option and sends the underlying assets to the
    ///         exerciser and the strike ETH to the vault beneficiary.
    /// @param optionId The tokenId of the option to exercise
    function exercise(uint256 optionId) external payable {
        // optionId should always be even
        require(optionId % 2 == 0, "Not option type");

        // check owner
        require(msg.sender == ownerOf(optionId), "You are not the owner");

        uint256 vaultId = optionId - 1;
        Vault memory vault = _vaults[vaultId];

        // check option hasn't expired
        require(block.timestamp < vault.currentExpiration, "Option has expired");

        // check correct ETH amount was sent to pay the strike
        require(msg.value == vault.currentStrike, "Incorrect ETH sent for strike");

        // burn the option token
        _burn(optionId);

        // mark the vault as exercised
        vault.isExercised = true;
        _vaults[vaultId] = vault;

        // collect protocol fee
        uint256 fee = 0;
        if (feeRate > 0) {
            fee = (msg.value * feeRate) / 1e18;
            protocolUnclaimedFees += fee;
        }

        // increment vault beneficiary's ETH balance
        ethBalance[getVaultBeneficiary(vaultId)] += msg.value - fee;

        emit ExercisedOption(optionId, msg.sender);

        // transfer the NFTs or ERC20s to the exerciser
        vault.tokenType == TokenType.ERC721
            ? ERC721(vault.token).transferFrom(address(this), msg.sender, vault.tokenIdOrAmount)
            : ERC20(vault.token).safeTransfer(msg.sender, vault.tokenIdOrAmount);
    }

    /// @notice Initiates a withdrawal so that the vault will no longer sell
    ///         another call once the currently active call option has expired.
    /// @param vaultId The tokenId of the vault to initiate a withdrawal on
    function initiateWithdraw(uint256 vaultId) external {
        // vaultId should always be odd
        require(vaultId % 2 != 0, "Not vault type");

        // check msg.sender owns the vault
        require(msg.sender == ownerOf(vaultId), "You are not the owner");

        _vaults[vaultId].isWithdrawing = true;

        emit InitiatedWithdrawal(vaultId, msg.sender);
    }

    /// @notice Sends the underlying assets back to the vault owner and claims any
    ///         unharvested premiums for the owner. Vault and it's associated option
    ///         NFT are burned.
    /// @param vaultId The tokenId of the vault to withdraw
    function withdraw(uint256 vaultId) external nonReentrant {
        // vaultId should always be odd
        require(vaultId % 2 != 0, "Not vault type");

        // check owner
        require(msg.sender == ownerOf(vaultId), "You are not the owner");

        Vault memory vault = _vaults[vaultId];

        // check vault can be withdrawn
        require(vault.isExercised == false, "Vault already exercised");
        require(vault.isWithdrawing, "Vault not in withdrawable state");
        require(block.timestamp > vault.currentExpiration, "Option still active");

        // burn option and vault
        uint256 optionId = vaultId + 1;
        _burn(optionId);
        _burn(vaultId);

        emit Withdrawal(vaultId, msg.sender);

        // claim any ETH still in the account
        harvest();

        // transfer the NFTs or ERC20s back to the owner
        vault.tokenType == TokenType.ERC721
            ? ERC721(vault.token).transferFrom(address(this), msg.sender, vault.tokenIdOrAmount)
            : ERC20(vault.token).safeTransfer(msg.sender, vault.tokenIdOrAmount);
    }

    /// @notice Sets the vault beneficiary that will receive premiums/strike ETH from the vault
    /// @param vaultId The tokenId of the vault to update
    /// @param beneficiary The new vault beneficiary
    function setVaultBeneficiary(uint256 vaultId, address beneficiary) external {
        // vaultId's should always be odd
        require(vaultId % 2 != 0, "Not vault type");
        require(msg.sender == ownerOf(vaultId), "Not owner");

        _vaultBeneficiaries[vaultId] = beneficiary;
    }

    /// @notice Sends any unclaimed ETH (premiums/strike) to the msg.sender
    function harvest() public returns (uint256 amount) {
        // reset premiums
        amount = ethBalance[msg.sender];
        ethBalance[msg.sender] = 0;

        emit Harvested(msg.sender, amount);

        // transfer premiums to owner
        payable(msg.sender).safeTransferETH(amount);
    }

    /**********************
        GETTER FUNCTIONS
    ***********************/

    /// @notice Get the current beneficiary for a vault
    /// @param vaultId The tokenId of the vault to fetch the beneficiary for
    /// @return beneficiary The beneficiary for the vault
    function getVaultBeneficiary(uint256 vaultId) public view returns (address beneficiary) {
        address currentBeneficiary = _vaultBeneficiaries[vaultId];

        // return the current owner if vault beneficiary is not set
        return currentBeneficiary == address(0) ? ownerOf(vaultId) : currentBeneficiary;
    }

    /// @notice Get details for a vault
    /// @param vaultId The tokenId of the vault to fetch the details for
    function vaults(uint256 vaultId) external view returns (Vault memory) {
        return _vaults[vaultId];
    }

    /// @notice Get the fixed option premium for a vault
    /// @param vaultId The tokenId of the vault to fetch the premium for
    /// @return premium The premium for the vault
    function getPremium(uint256 vaultId) public view returns (uint256 premium) {
        Vault memory vault = _vaults[vaultId];
        return premiumOptions[vault.premiumIndex];
    }

    /// @notice Get the current dutch auction strike for a start value and end
    ///         timestamp. Strike decreases exponentially to 0 over time starting
    ///         at startingStrike. Minimum value returned is reserveStrike.
    /// @param startingStrike The starting strike value
    /// @param auctionEndTimestamp The unix timestamp when the auction ends
    /// @param reserveStrike The minimum value for the strike
    /// @return strike The strike
    function getDutchAuctionStrike(
        uint256 startingStrike,
        uint32 auctionEndTimestamp,
        uint256 reserveStrike
    ) public view returns (uint256 strike) {
        /*
            delta = max(auctionEnd - currentTimestamp, 0)
            progress = delta / auctionDuration
            auctionStrike = progress^2 * startingStrike
            strike = max(auctionStrike, reserveStrike)
        */
        uint256 delta = auctionEndTimestamp > block.timestamp ? auctionEndTimestamp - block.timestamp : 0;
        uint256 progress = (1e18 * delta) / AUCTION_DURATION;
        uint256 auctionStrike = (progress * progress * startingStrike) / (1e18 * 1e18);

        // max(auctionStrike, reserveStrike)
        strike = auctionStrike > reserveStrike ? auctionStrike : reserveStrike;
    }

    /*************************
        OVVERIDES FUNCTIONS
    **************************/

    /// @dev Resets the beneficiary address when transferring vault NFTs.
    ///      The new beneficiary will be the account receiving the vault NFT.
    function transferFrom(
        address from,
        address to,
        uint256 id
    ) public override {
        require(from == _ownerOf[id], "WRONG_FROM");
        require(to != address(0), "INVALID_RECIPIENT");
        require(
            msg.sender == from || isApprovedForAll[from][msg.sender] || msg.sender == getApproved[id],
            "NOT_AUTHORIZED"
        );

        // reset the beneficiary
        bool isVaultToken = id % 2 != 0;
        if (isVaultToken) {
            _vaultBeneficiaries[id] = address(0);
        }

        _ownerOf[id] = to;
        delete getApproved[id];

        emit Transfer(from, to, id);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf[tokenId] != address(0), "URI query for NOT_MINTED token");

        bool isVaultToken = tokenId % 2 != 0;
        Vault memory vault = _vaults[isVaultToken ? tokenId : tokenId - 1];

        string memory jsonStr = renderJson(
            vault.token,
            vault.tokenIdOrAmount,
            getPremium(vault.premiumIndex),
            vault.durationDays,
            strikeOptions[vault.dutchAuctionStartingStrikeIndex],
            vault.currentExpiration,
            vault.currentStrike,
            vault.isExercised,
            isVaultToken
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(jsonStr))));
    }
}
