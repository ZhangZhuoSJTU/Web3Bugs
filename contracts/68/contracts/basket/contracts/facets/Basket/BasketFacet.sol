// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../interfaces/IBasketFacet.sol";
import "../ERC20/LibERC20Storage.sol";
import "../ERC20/LibERC20.sol";
import "../shared/Reentry/ReentryProtection.sol";
import "../shared/Access/CallProtection.sol";
import "./LibBasketStorage.sol";

contract BasketFacet is ReentryProtection, CallProtection, IBasketFacet {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MIN_AMOUNT = 10**6;
    uint256 public constant MAX_ENTRY_FEE = 10**17; // 10%
    uint256 public constant MAX_EXIT_FEE = 10**17; // 10%
    uint256 public constant MAX_ANNUAL_FEE = 10**17; // 10%
    uint256 public constant HUNDRED_PERCENT = 10**18;

    // Assuming a block gas limit of 12M this allows for a gas consumption per token of roughly 333k allowing 2M of overhead for addtional operations
    uint256 public constant MAX_TOKENS = 30;

    function addToken(address _token) external override protectedCall {
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();
        require(!bs.inPool[_token], "TOKEN_ALREADY_IN_POOL");
        require(bs.tokens.length < MAX_TOKENS, "TOKEN_LIMIT_REACHED");
        // Enforce minimum to avoid rounding errors; (Minimum value is the same as in Balancer)
        require(balance(_token) >= MIN_AMOUNT, "BALANCE_TOO_SMALL");

        bs.inPool[_token] = true;
        bs.tokens.push(IERC20(_token));

        emit TokenAdded(_token);
    }

    function removeToken(address _token) external override protectedCall {
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();

        require(bs.inPool[_token], "TOKEN_NOT_IN_POOL");

        bs.inPool[_token] = false;

        // remove token from array
        for (uint256 i; i < bs.tokens.length; i++) {
            if (address(bs.tokens[i]) == _token) {
                bs.tokens[i] = bs.tokens[bs.tokens.length - 1];
                bs.tokens.pop();
                emit TokenRemoved(_token);
                break;
            }
        }
    }

    function setEntryFee(uint256 _fee) external override protectedCall {
        require(_fee <= MAX_ENTRY_FEE, "FEE_TOO_BIG");
        LibBasketStorage.basketStorage().entryFee = _fee;
        emit EntryFeeSet(_fee);
    }

    function getEntryFee() external view override returns (uint256) {
        return LibBasketStorage.basketStorage().entryFee;
    }

    function setExitFee(uint256 _fee) external override protectedCall {
        require(_fee <= MAX_EXIT_FEE, "FEE_TOO_BIG");
        LibBasketStorage.basketStorage().exitFee = _fee;
        emit ExitFeeSet(_fee);
    }

    function getExitFee() external view override returns (uint256) {
        return LibBasketStorage.basketStorage().exitFee;
    }

    function setAnnualizedFee(uint256 _fee) external override protectedCall {
        chargeOutstandingAnnualizedFee();
        require(_fee <= MAX_ANNUAL_FEE, "FEE_TOO_BIG");
        LibBasketStorage.basketStorage().annualizedFee = _fee;
        emit AnnualizedFeeSet(_fee);
    }

    function getAnnualizedFee() external view override returns (uint256) {
        return LibBasketStorage.basketStorage().annualizedFee;
    }

    function setFeeBeneficiary(address _beneficiary)
        external
        override
        protectedCall
    {
        chargeOutstandingAnnualizedFee();
        LibBasketStorage.basketStorage().feeBeneficiary = _beneficiary;
        emit FeeBeneficiarySet(_beneficiary);
    }

    function getFeeBeneficiary() external view override returns (address) {
        return LibBasketStorage.basketStorage().feeBeneficiary;
    }

    function setEntryFeeBeneficiaryShare(uint256 _share)
        external
        override
        protectedCall
    {
        require(_share <= HUNDRED_PERCENT, "FEE_SHARE_TOO_BIG");
        LibBasketStorage.basketStorage().entryFeeBeneficiaryShare = _share;
        emit EntryFeeBeneficiaryShareSet(_share);
    }

    function getEntryFeeBeneficiaryShare()
        external
        view
        override
        returns (uint256)
    {
        return LibBasketStorage.basketStorage().entryFeeBeneficiaryShare;
    }

    function setExitFeeBeneficiaryShare(uint256 _share)
        external
        override
        protectedCall
    {
        require(_share <= HUNDRED_PERCENT, "FEE_SHARE_TOO_BIG");
        LibBasketStorage.basketStorage().exitFeeBeneficiaryShare = _share;
        emit ExitFeeBeneficiaryShareSet(_share);
    }

    function getExitFeeBeneficiaryShare()
        external
        view
        override
        returns (uint256)
    {
        return LibBasketStorage.basketStorage().exitFeeBeneficiaryShare;
    }

    function joinPool(uint256 _amount, uint16 _referral)
        external
        override
        noReentry
    {
        require(!this.getLock(), "POOL_LOCKED");
        chargeOutstandingAnnualizedFee();
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();
        uint256 totalSupply = LibERC20Storage.erc20Storage().totalSupply;
        require(
            totalSupply.add(_amount) <= this.getCap(),
            "MAX_POOL_CAP_REACHED"
        );

        uint256 feeAmount = _amount.mul(bs.entryFee).div(10**18);

        for (uint256 i; i < bs.tokens.length; i++) {
            IERC20 token = bs.tokens[i];
            uint256 tokenAmount =
                balance(address(token)).mul(_amount.add(feeAmount)).div(
                    totalSupply
                );
            require(tokenAmount != 0, "AMOUNT_TOO_SMALL");
            token.safeTransferFrom(msg.sender, address(this), tokenAmount);
        }

        // If there is any fee that should go to the beneficiary mint it
        if (
            feeAmount != 0 &&
            bs.entryFeeBeneficiaryShare != 0 &&
            bs.feeBeneficiary != address(0)
        ) {
            uint256 feeBeneficiaryShare =
                feeAmount.mul(bs.entryFeeBeneficiaryShare).div(10**18);
            if (feeBeneficiaryShare != 0) {
                LibERC20.mint(bs.feeBeneficiary, feeBeneficiaryShare);
            }
        }

        LibERC20.mint(msg.sender, _amount);
        emit PoolJoined(msg.sender, _amount, _referral);
    }

    // Must be overwritten to withdraw from strategies
    function exitPool(uint256 _amount, uint16 _referral)
        external
        virtual
        override
        noReentry
    {
        require(!this.getLock(), "POOL_LOCKED");
        chargeOutstandingAnnualizedFee();
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();
        uint256 totalSupply = LibERC20Storage.erc20Storage().totalSupply;

        uint256 feeAmount = _amount.mul(bs.exitFee).div(10**18);

        for (uint256 i; i < bs.tokens.length; i++) {
            IERC20 token = bs.tokens[i];
            uint256 tokenBalance = balance(address(token));
            // redeem less tokens if there is an exit fee
            uint256 tokenAmount =
                tokenBalance.mul(_amount.sub(feeAmount)).div(totalSupply);
            require(
                tokenBalance.sub(tokenAmount) >= MIN_AMOUNT,
                "TOKEN_BALANCE_TOO_LOW"
            );
            token.safeTransfer(msg.sender, tokenAmount);
        }

        // If there is any fee that should go to the beneficiary mint it
        if (
            feeAmount != 0 &&
            bs.exitFeeBeneficiaryShare != 0 &&
            bs.feeBeneficiary != address(0)
        ) {
            uint256 feeBeneficiaryShare =
                feeAmount.mul(bs.exitFeeBeneficiaryShare).div(10**18);
            if (feeBeneficiaryShare != 0) {
                LibERC20.mint(bs.feeBeneficiary, feeBeneficiaryShare);
            }
        }

        require(
            totalSupply.sub(_amount) >= MIN_AMOUNT,
            "POOL_TOKEN_BALANCE_TOO_LOW"
        );
        LibERC20.burn(msg.sender, _amount);
        emit PoolExited(msg.sender, _amount, _referral);
    }

    function calcOutStandingAnnualizedFee()
        public
        view
        override
        returns (uint256)
    {
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();
        uint256 totalSupply = LibERC20Storage.erc20Storage().totalSupply;

        uint256 lastFeeClaimed = bs.lastAnnualizedFeeClaimed;
        uint256 annualizedFee = bs.annualizedFee;

        if (
            annualizedFee == 0 ||
            bs.feeBeneficiary == address(0) ||
            lastFeeClaimed == 0
        ) {
            return 0;
        }

        uint256 timePassed = block.timestamp.sub(lastFeeClaimed);

        return
            totalSupply.mul(annualizedFee).div(10**18).mul(timePassed).div(
                365 days
            );
    }

    function chargeOutstandingAnnualizedFee() public override {
        uint256 outStandingFee = calcOutStandingAnnualizedFee();
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();

        bs.lastAnnualizedFeeClaimed = block.timestamp;

        // if there is any fee to mint and the beneficiary is set
        // note: feeBeneficiary is already checked in calc function
        if (outStandingFee != 0) {
            LibERC20.mint(bs.feeBeneficiary, outStandingFee);
        }

        emit FeeCharged(outStandingFee);
    }

    // returns true when locked
    function getLock() external view override returns (bool) {
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();
        return bs.lockBlock == 0 || bs.lockBlock >= block.number;
    }

    function getTokenInPool(address _token)
        external
        view
        override
        returns (bool)
    {
        return LibBasketStorage.basketStorage().inPool[_token];
    }

    function getLockBlock() external view override returns (uint256) {
        return LibBasketStorage.basketStorage().lockBlock;
    }

    // lock up to and including _lock blocknumber
    function setLock(uint256 _lock) external override protectedCall {
        LibBasketStorage.basketStorage().lockBlock = _lock;
        emit LockSet(_lock);
    }

    function setCap(uint256 _maxCap) external override protectedCall {
        LibBasketStorage.basketStorage().maxCap = _maxCap;
        emit CapSet(_maxCap);
    }

    // Seperated balance function to allow yearn like strategies to be hooked up by inheriting from this contract and overriding
    function balance(address _token) public view override returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    function getTokens() external view override returns (address[] memory) {
        IERC20[] memory tokens = LibBasketStorage.basketStorage().tokens;
        address[] memory result = new address[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            result[i] = address(tokens[i]);
        }

        return (result);
    }

    function getCap() external view override returns (uint256) {
        return LibBasketStorage.basketStorage().maxCap;
    }

    function calcTokensForAmount(uint256 _amount)
        external
        view
        override
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();
        uint256 totalSupply =
            LibERC20Storage.erc20Storage().totalSupply.add(
                calcOutStandingAnnualizedFee()
            );

        tokens = new address[](bs.tokens.length);
        amounts = new uint256[](bs.tokens.length);

        for (uint256 i; i < bs.tokens.length; i++) {
            IERC20 token = bs.tokens[i];
            uint256 tokenBalance = balance(address(token));
            uint256 tokenAmount = tokenBalance.mul(_amount).div(totalSupply);
            // Add entry fee
            tokenAmount = tokenAmount.add(
                tokenAmount.mul(bs.entryFee).div(10**18)
            );

            tokens[i] = address(token);
            amounts[i] = tokenAmount;
        }

        return (tokens, amounts);
    }

    function calcTokensForAmountExit(uint256 _amount)
        external
        view
        override
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        LibBasketStorage.BasketStorage storage bs =
            LibBasketStorage.basketStorage();
        uint256 feeAmount = _amount.mul(bs.exitFee).div(10**18);
        uint256 totalSupply =
            LibERC20Storage.erc20Storage().totalSupply.add(
                calcOutStandingAnnualizedFee()
            );

        tokens = new address[](bs.tokens.length);
        amounts = new uint256[](bs.tokens.length);

        for (uint256 i; i < bs.tokens.length; i++) {
            IERC20 token = bs.tokens[i];
            uint256 tokenBalance = balance(address(token));
            uint256 tokenAmount =
                tokenBalance.mul(_amount.sub(feeAmount)).div(totalSupply);

            tokens[i] = address(token);
            amounts[i] = tokenAmount;
        }

        return (tokens, amounts);
    }
}
