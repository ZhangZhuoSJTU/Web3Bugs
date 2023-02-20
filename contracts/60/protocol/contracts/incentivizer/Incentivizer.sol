// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IIncentivizer.sol";
import "../interfaces/IFactory.sol";
import "./types/Program.sol";
import "../utils/unstructured/UReentrancyGuard.sol";
import "../product/types/position/Position.sol";
import "../product/types/accumulator/Accumulator.sol";
import "../factory/UFactoryProvider.sol";

contract Incentivizer is IIncentivizer, UFactoryProvider, UReentrancyGuard {
    using UFixed18Lib for UFixed18;
    using EnumerableSet for EnumerableSet.UintSet;
    using Token18Lib for Token18;
    using PositionLib for Position;
    using AccumulatorLib for Accumulator;
    using ProgramInfoLib for ProgramInfo;
    using ProgramLib for Program;

    /// @dev Maximum programs per product allowed
    uint256 public programsPerProduct;

    /// @dev Fee taken from total program amount
    UFixed18 public fee;

    /// @dev Static program state
    ProgramInfo[] private _programInfos;

    /// @dev Dynamic program state
    mapping(uint256 => Program) private _programs;

    /// @dev Mapping of all programs for each product
    mapping(IProduct => EnumerableSet.UintSet) private _registry;

    /// @dev Fees that have been collected, but remain unclaimed
    mapping(Token18 => UFixed18) public fees;

    /**
     * @notice Initializes the contract state
     * @param factory_ Factory contract address
     */
    function initialize(IFactory factory_) external {
        UFactoryProvider__initialize(factory_);
        UReentrancyGuard__initialize();

        programsPerProduct = 2;
        fee = UFixed18Lib.ZERO;
    }

    /**
     * @notice Creates a new incentive program
     * @dev Must be called as the product or protocol owner
     * @param info Parameters for the new program
     * @return new program's ID
     */
    function create(ProgramInfo calldata info)
    nonReentrant
    isProduct(info.product)
    notPaused
    external returns (uint256) {
        bool protocolOwned = msg.sender == factory().owner();

        if (_registry[info.product].length() >= programsPerProduct) revert IncentivizerTooManyProgramsError();
        if (!protocolOwned && msg.sender != factory().owner(info.product))
            revert NotProductOwnerError(msg.sender, info.product);

        uint256 programId = _programInfos.length;
        (ProgramInfo memory programInfo, UFixed18 programFee) = ProgramInfoLib.create(fee, info);

        _programInfos.push(programInfo);
        _programs[programId].initialize(programInfo, protocolOwned);
        _registry[info.product].add(programId);
        fees[info.token] = fees[info.token].add(programFee);

        info.token.pull(msg.sender, info.amount.sum());

        emit ProgramCreated(
            programId,
            programInfo.product,
            programInfo.token,
            programInfo.amount.maker,
            programInfo.amount.taker,
            programInfo.start,
            programInfo.duration,
            programInfo.grace,
            programFee
        );

        return programId;
    }

    /**
     * @notice Completes an in-progress program early
     * @dev Must be called as the program owner
     * @param programId Program to end
     */
    function end(uint256 programId)
    notPaused
    validProgram(programId)
    onlyProgramOwner(programId)
    external {
        completeInternal(programId);
    }

    /**
     * @notice Closes a program, returning all unclaimed rewards
     * @param programId Program to end
     */
    function close(uint256 programId)
    notPaused
    validProgram(programId)
    external {
        Program storage program = _programs[programId];
        ProgramInfo storage programInfo = _programInfos[programId];

        if (!program.canClose(programInfo, block.timestamp)) revert IncentivizerProgramNotClosableError();

        // complete if not yet completed
        if (program.versionComplete == 0) {
            completeInternal(programId);
        }

        // close
        UFixed18 amountToReturn = _programs[programId].close();
        programInfo.token.push(treasury(programId), amountToReturn);
        _registry[programInfo.product].remove(programId);

        emit ProgramClosed(programId, amountToReturn);
    }

    /**
     * @notice Completes any in-progress programs that newly completable
     * @dev Called every settle() from each product
     */
    function sync() onlyProduct external {
        IProduct product = IProduct(msg.sender);
        IProductProvider provider = product.provider();

        uint256 currentTimestamp = provider.timestampAtVersion(provider.currentVersion());

        for (uint256 i; i < _registry[product].length(); i++) {
            uint256 programId = _registry[product].at(i);

            if (_programs[programId].versionComplete != 0) continue;
            if (!_programInfos[programId].isComplete(currentTimestamp)) continue;

            completeInternal(programId);
        }
    }

    /**
     * @notice Completes a program
     * @dev Internal helper
     * @param programId Program to complete
     */
    function completeInternal(uint256 programId) private {
        uint256 version = _programInfos[programId].product.latestVersion();
        _programs[programId].complete(version);

        emit ProgramCompleted(programId, version);
    }

    /**
     * @notice Settles unsettled balance for `account`
     * @dev Called immediately proceeding a position update in the corresponding product
     * @param account Account to sync
     */
    function syncAccount(address account) onlyProduct external {
        IProduct product = IProduct(msg.sender);

        for (uint256 i; i < _registry[product].length(); i++) {
            uint256 programId = _registry[product].at(i);
            _programs[programId].settle(_programInfos[programId], account);
        }
    }

    /**
     * @notice Claims all of `msg.sender`'s rewards for `product` programs
     * @param product Product to claim rewards for
     */
    function claim(IProduct product) notPaused nonReentrant isProduct(product) public {
        // settle product markets
        product.settle();
        product.settleAccount(msg.sender);

        // claim
        for (uint256 i; i < _registry[product].length(); i++) {
            claimInternal(msg.sender, _registry[product].at(i));
        }
    }

    /**
     * @notice Claims all of `msg.sender`'s rewards for a specific program
     * @param programId Program to claim rewards for
     */
    function claim(uint256 programId) notPaused nonReentrant validProgram(programId) public {
        IProduct product = _programInfos[programId].product;

        // settle product markets
        product.settle();
        product.settleAccount(msg.sender);

        // claim
        claimInternal(msg.sender, programId);
    }

    /**
     * @notice Claims all of `account`'s rewards for a specific program
     * @dev Internal helper, assumes account has already been product-settled prior to calling
     * @param account Account to claim rewards for
     * @param programId Program to claim rewards for
     */
    function claimInternal(address account, uint256 programId) private {
        Program storage program = _programs[programId];
        ProgramInfo memory programInfo = _programInfos[programId];

        program.settle(programInfo, account);
        UFixed18 claimedAmount = program.claim(account);

        programInfo.token.push(account, claimedAmount);

        emit Claim(account, programId, claimedAmount);
    }

    /**
     * @notice Claims all `tokens` fees to the protocol treasury
     * @param tokens Tokens to claim fees for
     */
    function claimFee(Token18[] calldata tokens) notPaused external {
        for(uint256 i; i < tokens.length; i++) {
            Token18 token = tokens[i];
            UFixed18 amount = fees[token];

            fees[token] = UFixed18Lib.ZERO;
            tokens[i].push(factory().treasury(), amount);

            emit FeeClaim(token, amount);
        }
    }

    /**
     * @notice Returns program info for program `programId`
     * @param programId Program to return for
     * @return Program info
     */
    function programInfos(uint256 programId) external view returns (ProgramInfo memory) {
        return _programInfos[programId];
    }

    /**
     * @notice Returns `account`'s total unclaimed rewards for a specific program
     * @param account Account to return for
     * @param programId Program to return for
     * @return `account`'s total unclaimed rewards for `programId`
     */
    function unclaimed(address account, uint256 programId) external view returns (UFixed18) {
        if (programId >= _programInfos.length) return (UFixed18Lib.ZERO);

        ProgramInfo memory programInfo = _programInfos[programId];
        return _programs[programId].unclaimed(programInfo, account);
    }

    /**
     * @notice Returns `account`'s latest synced version for a specific program
     * @param account Account to return for
     * @param programId Program to return for
     * @return `account`'s latest synced version for `programId`
     */
    function latestVersion(address account, uint256 programId) external view returns (uint256) {
        return _programs[programId].latestVersion[account];
    }

    /**
     * @notice Returns `account`'s settled rewards for a specific program
     * @param account Account to return for
     * @param programId Program to return for
     * @return `account`'s settled rewards for `programId`
     */
    function settled(address account, uint256 programId) external view returns (UFixed18) {
        return _programs[programId].settled[account];
    }

    /**
     * @notice Returns available rewards for a specific program
     * @param programId Program to return for
     * @return Available rewards for `programId`
     */
    function available(uint256 programId) external view returns (UFixed18) {
        return _programs[programId].available;
    }

    /**
     * @notice Returns the version completed for a specific program
     * @param programId Program to return for
     * @return The version completed for `programId`
     */
    function versionComplete(uint256 programId) external view returns (uint256) {
        return _programs[programId].versionComplete;
    }

    /**
     * @notice Returns whether closed for a specific program
     * @param programId Program to return for
     * @return whether closed for `programId`
     */
    function closed(uint256 programId) external view returns (bool) {
        return _programs[programId].closed;
    }

    /**
     * @notice Returns quantity of programs for a specific product
     * @param product Product to return for
     * @return Quantity of programs for `product`
     */
    function programsForLength(IProduct product) external view returns (uint256) {
        return _registry[product].length();
    }

    /**
     * @notice Returns the program at index `index` for a specific product
     * @param product Product to return for
     * @param index Index to return for
     * @return The program at index `index` for `product`
     */
    function programsForAt(IProduct product, uint256 index) external view returns (uint256) {
        return _registry[product].at(index);
    }

    /**
     * @notice Returns the owner of a specific program
     * @param programId Program to return for
     * @return The owner of `programId`
     */
    function owner(uint256 programId) public view returns (address) {
        Program storage program = _programs[programId];
        ProgramInfo storage programInfo = _programInfos[programId];
        return program.protocolOwned ? factory().owner() : factory().owner(programInfo.product);
    }

    /**
     * @notice Returns the treasury of a specific program
     * @param programId Program to return for
     * @return The treasury of `programId`
     */
    function treasury(uint256 programId) public view returns (address) {
        Program storage program = _programs[programId];
        ProgramInfo storage programInfo = _programInfos[programId];
        return program.protocolOwned ? factory().treasury() : factory().treasury(programInfo.product);
    }

    /**
     * @notice Updates the maximum programs per product
     * @param newProgramsPerProduct New maximum programs per product value
     */
    function updateProgramsPerProduct(uint256 newProgramsPerProduct) onlyOwner external {
        programsPerProduct = newProgramsPerProduct;

        emit ProgramsPerProductUpdated(newProgramsPerProduct);
    }

    /**
     * @notice Updates the fee
     * @param newFee New fee value
     */
    function updateFee(UFixed18 newFee) onlyOwner external {
        fee = newFee;

        emit FeeUpdated(newFee);
    }

    /// @dev Only allow the owner of `programId` to call
    modifier onlyProgramOwner(uint256 programId) {
        if (msg.sender != owner(programId)) revert IncentivizerNotProgramOwnerError(msg.sender, programId);

        _;
    }

    /// @dev Only allow a valid `programId`
    modifier validProgram(uint256 programId) {
        if (programId >= _programInfos.length) revert IncentivizerInvalidProgramError(programId);

        _;
    }
}
