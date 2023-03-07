// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IVRFNFTRandomDraw {
    /// @notice Cannot redraw during waiting period
    error STILL_IN_WAITING_PERIOD_BEFORE_REDRAWING();
    /// @notice Admin emergency withdraw can only happen once unlocked
    error RECOVERY_IS_NOT_YET_POSSIBLE();
    /// @notice Token that is offered does not exist with ownerOf
    error TOKEN_BEING_OFFERED_NEEDS_TO_EXIST();
    /// @notice Token needs to be a contract when initializing
    error TOKEN_NEEDS_TO_BE_A_CONTRACT(address potentialTokenAddress);
    /// @notice Token needs to be approved to raffle contract
    error TOKEN_NEEDS_TO_BE_APPROVED_TO_CONTRACT();
    /// @notice Waiting on a response from chainlink
    error REQUEST_IN_FLIGHT();
    /// @notice Chainlink VRF response doesn't match current ID
    error REQUEST_DOES_NOT_MATCH_CURRENT_ID();
    /// @notice The tokens' totalSupply doesn't match one claimed on contract
    error SUPPLY_TOKENS_COUNT_WRONG();
    /// @notice Cannot attempt to claim winnings if request is not started or in flight
    error NEEDS_TO_HAVE_CHOSEN_A_NUMBER();

    /// @notice When the range is [20,0] (from 20 to 0, that doesn't make sense)
    error DRAWING_TOKEN_RANGE_INVALID();
    /// @notice Withdraw timelock min is 1 hour
    error REDRAW_TIMELOCK_NEEDS_TO_BE_MORE_THAN_AN_HOUR();
    error REDRAW_TIMELOCK_NEEDS_TO_BE_LESS_THAN_A_MONTH();
    /// @notice Admin NFT recovery timelock min is 1 week
    error RECOVER_TIMELOCK_NEEDS_TO_BE_AT_LEAST_A_WEEK();
    /// @notice Admin NFT recovery timelock max is 1 year
    error RECOVER_TIMELOCK_NEEDS_TO_BE_LESS_THAN_A_YEAR();
    /// @notice The given user has not won
    error USER_HAS_NOT_WON();
    /// @notice Cannot re-draw yet
    error TOO_SOON_TO_REDRAW();
    /// @notice NFT for raffle is not owned by the admin
    error DOES_NOT_OWN_NFT();
    /// @notice Too many / few random words are sent back from chainlink
    error WRONG_LENGTH_FOR_RANDOM_WORDS();

    /// @notice When the draw is initialized
    event InitializedDraw(address indexed sender, Settings settings);
    /// @notice When the draw is setup
    event SetupDraw(address indexed sender, Settings settings);
    /// @notice When the owner reclaims nft aftr recovery time delay
    event OwnerReclaimedNFT(address indexed owner);
    /// @notice Dice roll is complete from callback
    event DiceRollComplete(address indexed sender, CurrentRequest request);
    /// @notice Sent when the winner sends/claims an NFT
    event WinnerSentNFT(
        address indexed winner,
        address indexed nft,
        uint256 indexed tokenId,
        Settings settings
    );

    /// @notice Struct to organize current request
    struct CurrentRequest {
        /// @notice current chainlink request id
        uint256 currentChainlinkRequestId;
        /// @notice current chosen random number
        uint256 currentChosenTokenId;
        /// @notice has chosen a random number (in case random number = 0(in case random number = 0)(in case random number = 0)(in case random number = 0)(in case random number = 0)(in case random number = 0)(in case random number = 0)(in case random number = 0)(in case random number = 0))
        bool hasChosenRandomNumber;
        /// @notice time lock (block.timestamp) that a re-draw can be issued
        uint256 drawTimelock;
    }

    /// @notice Struct to organize user settings
    struct Settings {
        /// @notice Token Contract to put up for raffle
        address token;
        /// @notice Token ID to put up for raffle
        uint256 tokenId;
        /// @notice Token that each (sequential) ID has a entry in the raffle.
        address drawingToken;
        /// @notice Start token ID for the drawing (if totalSupply = 20 but the first token is 5 (5-25), setting this to 5 would fix the ordering)
        uint256 drawingTokenStartId;
        /// @notice End token ID for the drawing (exclusive) (token ids 0 - 9 would be 10 in this field)
        uint256 drawingTokenEndId;
        /// @notice Draw buffer time – time until a re-drawing can occur if the selected user cannot or does not claim the NFT.
        uint256 drawBufferTime;
        /// @notice block.timestamp that the admin can recover the NFT (as a safety fallback)
        uint256 recoverTimelock;
        /// @notice Chainlink gas keyhash
        bytes32 keyHash;
        /// @notice Chainlink subscription id
        uint64 subscriptionId;
    }

    /// @notice Initialize the contract with settings and an admin
    /// @param admin initial admin user
    /// @param _settings initial settings for draw
    function initialize(address admin, Settings memory _settings) external;

    /// @notice Call this to start the raffle drawing
    /// @return chainlink request id
    function startDraw() external returns (uint256);

    /// @notice Call this to re-draw the raffle
    /// @return chainlink request ID
    /// @dev Only callable by the owner
    function redraw() external returns (uint256);

    /// @notice Function to determine if the user has won in the current drawing
    /// @param user address for the user to check if they have won in the current drawing
    function hasUserWon(address user) external view returns (bool);

    /// @notice Function for the winner to call to retrieve their NFT
    function winnerClaimNFT() external;

    /// @notice Optional last resort admin reclaim nft function
    /// @dev Only callable by the owner
    function lastResortTimelockOwnerClaimNFT() external;

    /// @notice Getter for request details, does not include picked tokenID
    /// @return currentChainlinkRequestId Current Chainlink Request ID
    /// @return hasChosenRandomNumber If the random number for the drawing has been chosen
    /// @return drawTimelock block.timestamp when a redraw can be issued
    function getRequestDetails()
        external
        view
        returns (
            uint256 currentChainlinkRequestId,
            bool hasChosenRandomNumber,
            uint256 drawTimelock
        );
}
