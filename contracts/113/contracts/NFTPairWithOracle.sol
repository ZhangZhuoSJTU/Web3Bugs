// SPDX-License-Identifier: UNLICENSED

// Private Pool (NFT collateral)

//    (                (   (
//    )\      )    (   )\  )\ )  (
//  (((_)  ( /(   ))\ ((_)(()/(  )(    (    (
//  )\___  )(_)) /((_) _   ((_))(()\   )\   )\ )
// ((/ __|((_)_ (_))( | |  _| |  ((_) ((_) _(_/(
//  | (__ / _` || || || |/ _` | | '_|/ _ \| ' \))
//   \___|\__,_| \_,_||_|\__,_| |_|  \___/|_||_|

// Copyright (c) 2021 BoringCrypto - All rights reserved
// Twitter: @Boring_Crypto

// Special thanks to:
// @0xKeno - for all his invaluable contributions
// @burger_crypto - for the idea of trying to let the LPs benefit from liquidations

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringMath.sol";
import "@boringcrypto/boring-solidity/contracts/BoringOwnable.sol";
import "@boringcrypto/boring-solidity/contracts/Domain.sol";
import "@boringcrypto/boring-solidity/contracts/interfaces/IMasterContract.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/BoringRebase.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
import "@sushiswap/bentobox-sdk/contracts/IBentoBoxV1.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/INFTOracle.sol";

struct TokenLoanParams {
    uint128 valuation; // How much will you get? OK to owe until expiration.
    uint64 duration; // Length of loan in seconds
    uint16 annualInterestBPS; // Variable cost of taking out the loan
    uint16 ltvBPS; // Required to avoid liquidation
    INFTOracle oracle; // oracle used
}

struct SignatureParams {
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

interface ILendingClub {
    // Per token settings.
    function willLend(uint256 tokenId, TokenLoanParams memory params) external view returns (bool);

    function lendingConditions(address nftPair, uint256 tokenId) external view returns (TokenLoanParams memory);
}

interface INFTPair {
    function collateral() external view returns (IERC721);

    function asset() external view returns (IERC20);

    function masterContract() external view returns (address);

    function bentoBox() external view returns (IBentoBoxV1);

    function removeCollateral(uint256 tokenId, address to) external;
}

/// @title NFTPairWithOracle
/// @dev This contract allows contract calls to any contract (except BentoBox)
/// from arbitrary callers thus, don't trust calls from this contract in any circumstances.
contract NFTPairWithOracle is BoringOwnable, Domain, IMasterContract {
    using BoringMath for uint256;
    using BoringMath128 for uint128;
    using RebaseLibrary for Rebase;
    using BoringERC20 for IERC20;

    event LogRequestLoan(
        address indexed borrower,
        uint256 indexed tokenId,
        uint128 valuation,
        uint64 duration,
        uint16 annualInterestBPS,
        uint16 ltvBPS
    );
    event LogUpdateLoanParams(uint256 indexed tokenId, uint128 valuation, uint64 duration, uint16 annualInterestBPS, uint16 ltvBPS);
    // This automatically clears the associated loan, if any
    event LogRemoveCollateral(uint256 indexed tokenId, address recipient);
    // Details are in the loan request
    event LogLend(address indexed lender, uint256 indexed tokenId);
    event LogRepay(address indexed from, uint256 indexed tokenId);
    event LogFeeTo(address indexed newFeeTo);
    event LogWithdrawFees(address indexed feeTo, uint256 feeShare);

    // Immutables (for MasterContract and all clones)
    IBentoBoxV1 public immutable bentoBox;
    NFTPairWithOracle public immutable masterContract;

    // MasterContract variables
    address public feeTo;

    // Per clone variables
    // Clone init settings
    IERC721 public collateral;
    IERC20 public asset;

    // A note on terminology:
    // "Shares" are BentoBox shares.

    // Track assets we own. Used to allow skimming the excesss.
    uint256 public feesEarnedShare;

    // Per token settings.
    mapping(uint256 => TokenLoanParams) public tokenLoanParams;

    uint8 private constant LOAN_INITIAL = 0;
    uint8 private constant LOAN_REQUESTED = 1;
    uint8 private constant LOAN_OUTSTANDING = 2;
    struct TokenLoan {
        address borrower;
        address lender;
        uint64 startTime;
        uint8 status;
    }
    mapping(uint256 => TokenLoan) public tokenLoan;

    // Do not go over 100% on either of these..
    uint256 private constant PROTOCOL_FEE_BPS = 1000;
    uint256 private constant OPEN_FEE_BPS = 100;
    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR_BPS = 3600 * 24 * 365 * 10_000;

    // Highest order term in the Maclaurin series for exp used by
    // `calculateIntest`.
    // Intuitive interpretation: interest continuously accrues on the principal.
    // That interest, in turn, earns "second-order" interest-on-interest, which
    // itself earns "third-order" interest, etc. This constant determines how
    // far we take this until we stop counting.
    //
    // The error, in terms of the interest rate, is at least
    //
    //            ----- n                        ----- Infinity
    //             \           x^k                \              x^k
    //      e^x -   )          ---   , which is    )             --- ,
    //             /            k!                /               k!
    //            ----- k = 1       k            ----- k = n + 1
    //
    // where n = COMPOUND_INTEREST_TERMS, and x = rt is the total amount of
    // interest that is owed at rate r over time t. It makes no difference if
    // this is, say, 5%/year for 10 years, or 50% in one year; the calculation
    // is the same. Why "at least"? There are also rounding errors. See
    // `calculateInterest` for more detail.
    // The factorial in the denominator "wins"; for all reasonable (and quite
    // a few unreasonable) interest rates, the lower-order terms contribute the
    // most to the total. The following table lists some of the calculated
    // approximations for different values of n, along with the "true" result:
    //
    // Total:         10%    20%    50%    100%    200%      500%       1000%
    // -----------------------------------------------------------------------
    // n = 1:         10.0%  20.0%  50.0%  100.0%  200.0%    500.0%     1000.0%
    // n = 2:         10.5%  22.0%  62.5%  150.0%  400.0%   1750.0%     6000.0%
    // n = 3:         10.5%  22.1%  64.6%  166.7%  533.3%   3833.3%    22666.7%
    // n = 4:         10.5%  22.1%  64.8%  170.8%  600.0%   6437.5%    64333.3%
    // n = 5:         10.5%  22.1%  64.9%  171.7%  626.7%   9041.7%   147666.7%
    // n = 6:         10.5%  22.1%  64.9%  171.8%  635.6%  11211.8%   286555.6%
    // n = 7:         10.5%  22.1%  64.9%  171.8%  638.1%  12761.9%   484968.3%
    // n = 8:         10.5%  22.1%  64.9%  171.8%  638.7%  13730.7%   732984.1%
    // n = 9:         10.5%  22.1%  64.9%  171.8%  638.9%  14268.9%  1008557.3%
    // n = 10:        10.5%  22.1%  64.9%  171.8%  638.9%  14538.1%  1284130.5%
    //
    // (n=Infinity):  10.5%  22.1%  64.9%  171.8%  638.9%  14741.3%  2202546.6%
    //
    // For instance, calculating the compounding effects of 200% in "total"
    // interest to the sixth order results in 635.6%, whereas the true result
    // is 638.9%.
    // At 500% that difference is a little more dramatic, but it is still in
    // the same ballpark -- and of little practical consequence unless the
    // collateral can be expected to go up more than 112 times in value.
    // Still, for volatile tokens, or an asset that is somehow known to be very
    // inflationary, use a different number.
    // Zero (no interest at all) is ignored and treated as one (linear only).
    uint8 private constant COMPOUND_INTEREST_TERMS = 6;

    // For signed lend / borrow requests:
    mapping(address => uint256) public nonces;

    /// @notice The constructor is only used for the initial master contract.
    /// @notice Subsequent clones are initialised via `init`.
    constructor(IBentoBoxV1 bentoBox_) public {
        bentoBox = bentoBox_;
        masterContract = this;
    }

    /// @notice De facto constructor for clone contracts
    function init(bytes calldata data) public payable override {
        require(address(collateral) == address(0), "NFTPair: already initialized");
        (collateral, asset) = abi.decode(data, (IERC721, IERC20));
        require(address(collateral) != address(0), "NFTPair: bad pair");
    }

    function updateLoanParams(uint256 tokenId, TokenLoanParams memory params) public {
        TokenLoan memory loan = tokenLoan[tokenId];
        if (loan.status == LOAN_OUTSTANDING) {
            // The lender can change terms so long as the changes are strictly
            // the same or better for the borrower:
            require(msg.sender == loan.lender, "NFTPair: not the lender");
            TokenLoanParams memory cur = tokenLoanParams[tokenId];
            require(
                params.duration >= cur.duration &&
                    params.valuation <= cur.valuation &&
                    params.annualInterestBPS <= cur.annualInterestBPS &&
                    params.ltvBPS <= cur.ltvBPS,
                "NFTPair: worse params"
            );
        } else if (loan.status == LOAN_REQUESTED) {
            // The borrower has already deposited the collateral and can
            // change whatever they like
            require(msg.sender == loan.borrower, "NFTPair: not the borrower");
        } else {
            // The loan has not been taken out yet; the borrower needs to
            // provide collateral.
            revert("NFTPair: no collateral");
        }
        tokenLoanParams[tokenId] = params;
        emit LogUpdateLoanParams(tokenId, params.valuation, params.duration, params.annualInterestBPS, params.ltvBPS);
    }

    function _requestLoan(
        address collateralProvider,
        uint256 tokenId,
        TokenLoanParams memory params,
        address to,
        bool skim
    ) private {
        // Edge case: valuation can be zero. That effectively gifts the NFT and
        // is therefore a bad idea, but does not break the contract.
        require(tokenLoan[tokenId].status == LOAN_INITIAL, "NFTPair: loan exists");
        if (skim) {
            require(collateral.ownerOf(tokenId) == address(this), "NFTPair: skim failed");
        } else {
            collateral.transferFrom(collateralProvider, address(this), tokenId);
        }
        TokenLoan memory loan;
        loan.borrower = to;
        loan.status = LOAN_REQUESTED;
        tokenLoan[tokenId] = loan;
        tokenLoanParams[tokenId] = params;

        emit LogRequestLoan(to, tokenId, params.valuation, params.duration, params.annualInterestBPS, params.ltvBPS);
    }

    /// @notice Deposit an NFT as collateral and request a loan against it
    /// @param tokenId ID of the NFT
    /// @param to Address to receive the loan, or option to withdraw collateral
    /// @param params Loan conditions on offer
    /// @param skim True if the token has already been transfered
    function requestLoan(
        uint256 tokenId,
        TokenLoanParams memory params,
        address to,
        bool skim
    ) public {
        _requestLoan(msg.sender, tokenId, params, to, skim);
    }

    /// @notice Removes `tokenId` as collateral and transfers it to `to`.
    /// @notice This destroys the loan.
    /// @param tokenId The token
    /// @param to The receiver of the token.
    function removeCollateral(uint256 tokenId, address to) public {
        TokenLoan memory loan = tokenLoan[tokenId];
        if (loan.status == LOAN_REQUESTED) {
            // We are withdrawing collateral that is not in use:
            require(msg.sender == loan.borrower, "NFTPair: not the borrower");
        } else if (loan.status == LOAN_OUTSTANDING) {
            // We are seizing collateral towards the lender. The loan has to be
            // expired and not paid off, or underwater and not paid off:
            require(to == loan.lender, "NFTPair: not the lender");

            if (uint256(loan.startTime) + tokenLoanParams[tokenId].duration > block.timestamp) {
                TokenLoanParams memory loanParams = tokenLoanParams[tokenId];
                // No underflow: loan.startTime is only ever set to a block timestamp
                // Cast is safe: if this overflows, then all loans have expired anyway
                uint256 interest = calculateInterest(
                    loanParams.valuation,
                    uint64(block.timestamp - loan.startTime),
                    loanParams.annualInterestBPS
                ).to128();
                uint256 amount = loanParams.valuation + interest;
                (, uint256 rate) = loanParams.oracle.get(address(this), tokenId);
                require(rate.mul(loanParams.ltvBPS) / BPS < amount, "NFT is still valued");
            }
        }
        // If there somehow is collateral but no accompanying loan, then anyone
        // can claim it by first requesting a loan with `skim` set to true, and
        // then withdrawing. So we might as well allow it here..
        delete tokenLoan[tokenId];
        collateral.transferFrom(address(this), to, tokenId);
        emit LogRemoveCollateral(tokenId, to);
    }

    // Assumes the lender has agreed to the loan.
    function _lend(
        address lender,
        uint256 tokenId,
        TokenLoanParams memory accepted,
        bool skim
    ) internal {
        TokenLoan memory loan = tokenLoan[tokenId];
        require(loan.status == LOAN_REQUESTED, "NFTPair: not available");
        TokenLoanParams memory params = tokenLoanParams[tokenId];

        // Valuation has to be an exact match, everything else must be at least
        // as good for the lender as `accepted`.
        require(
            params.valuation == accepted.valuation &&
                params.duration <= accepted.duration &&
                params.annualInterestBPS >= accepted.annualInterestBPS &&
                params.ltvBPS >= accepted.ltvBPS,
            "NFTPair: bad params"
        );

        if (params.oracle != INFTOracle(0)) {
            (, uint256 rate) = params.oracle.get(address(this), tokenId);
            require(rate.mul(uint256(params.ltvBPS)) / BPS >= params.valuation, "Oracle: price too low.");
        }

        uint256 totalShare = bentoBox.toShare(asset, params.valuation, false);
        // No overflow: at most 128 + 16 bits (fits in BentoBox)
        uint256 openFeeShare = (totalShare * OPEN_FEE_BPS) / BPS;
        uint256 protocolFeeShare = (openFeeShare * PROTOCOL_FEE_BPS) / BPS;

        if (skim) {
            require(
                bentoBox.balanceOf(asset, address(this)) >= (totalShare - openFeeShare + protocolFeeShare + feesEarnedShare),
                "NFTPair: skim too much"
            );
        } else {
            bentoBox.transfer(asset, lender, address(this), totalShare - openFeeShare + protocolFeeShare);
        }
        // No underflow: follows from OPEN_FEE_BPS <= BPS
        uint256 borrowerShare = totalShare - openFeeShare;
        bentoBox.transfer(asset, address(this), loan.borrower, borrowerShare);
        // No overflow: addends (and result) must fit in BentoBox
        feesEarnedShare += protocolFeeShare;

        loan.lender = lender;
        loan.status = LOAN_OUTSTANDING;
        loan.startTime = uint64(block.timestamp); // Do not use in 12e10 years..
        tokenLoan[tokenId] = loan;

        emit LogLend(lender, tokenId);
    }

    /// @notice Lends with the parameters specified by the borrower.
    /// @param tokenId ID of the token that will function as collateral
    /// @param accepted Loan parameters as the lender saw them, for security
    /// @param skim True if the funds have been transfered to the contract
    function lend(
        uint256 tokenId,
        TokenLoanParams memory accepted,
        bool skim
    ) public {
        _lend(msg.sender, tokenId, accepted, skim);
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparator();
    }

    // NOTE on signature hashes: the domain separator only guarantees that the
    // chain ID and master contract are a match, so we explicitly include the
    // clone address (and the asset/collateral addresses):

    // keccak256("Lend(address contract,uint256 tokenId,bool anyTokenId,uint128 valuation,uint64 duration,uint16 annualInterestBPS,uint16 ltvBPS,address oracle,uint256 nonce,uint256 deadline)")
    bytes32 private constant LEND_SIGNATURE_HASH = 0x4bfd5d24664945f4bb81f6061bd624907d74ba338190bdd6aa37f65838a8a533;

    // keccak256("Borrow(address contract,uint256 tokenId,uint128 valuation,uint64 duration,uint16 annualInterestBPS,uint16 ltvBPS,address oracle,uint256 nonce,uint256 deadline)")
    bytes32 private constant BORROW_SIGNATURE_HASH = 0xfc58c7a8ea6a96e25d218e36759058a704bbf0bebb53a109a44ca82f025cb769;

    /// @notice Request and immediately borrow from a pre-committed lender

    /// @notice Caller provides collateral; loan can go to a different address.
    /// @param tokenId ID of the token that will function as collateral
    /// @param lender Lender, whose BentoBox balance the funds will come from
    /// @param recipient Address to receive the loan.
    /// @param params Loan parameters requested, and signed by the lender
    /// @param skimCollateral True if the collateral has already been transfered
    /// @param anyTokenId Set if lender agreed to any token. Must have tokenId 0 in signature.
    function requestAndBorrow(
        uint256 tokenId,
        address lender,
        address recipient,
        TokenLoanParams memory params,
        bool skimCollateral,
        bool anyTokenId,
        SignatureParams memory signature
    ) public {
        if (signature.v == 0 && signature.r == bytes32(0) && signature.s == bytes32(0)) {
            require(ILendingClub(lender).willLend(tokenId, params), "NFTPair: LendingClub does not like you");
        } else {
            require(block.timestamp <= signature.deadline, "NFTPair: signature expired");
            uint256 nonce = nonces[lender]++;
            bytes32 dataHash = keccak256(
                abi.encode(
                    LEND_SIGNATURE_HASH,
                    address(this),
                    anyTokenId ? 0 : tokenId,
                    anyTokenId,
                    params.valuation,
                    params.duration,
                    params.annualInterestBPS,
                    params.ltvBPS,
                    params.oracle,
                    nonce,
                    signature.deadline
                )
            );
            require(ecrecover(_getDigest(dataHash), signature.v, signature.r, signature.s) == lender, "NFTPair: signature invalid");
        }
        _requestLoan(msg.sender, tokenId, params, recipient, skimCollateral);
        _lend(lender, tokenId, params, false);
    }

    /// @notice Take collateral from a pre-commited borrower and lend against it
    /// @notice Collateral must come from the borrower, not a third party.
    /// @param tokenId ID of the token that will function as collateral
    /// @param borrower Address that provides collateral and receives the loan
    /// @param params Loan terms offered, and signed by the borrower
    /// @param skimFunds True if the funds have been transfered to the contract
    function takeCollateralAndLend(
        uint256 tokenId,
        address borrower,
        TokenLoanParams memory params,
        bool skimFunds,
        SignatureParams memory signature
    ) public {
        require(block.timestamp <= signature.deadline, "NFTPair: signature expired");
        uint256 nonce = nonces[borrower]++;
        bytes32 dataHash = keccak256(
            abi.encode(
                BORROW_SIGNATURE_HASH,
                address(this),
                tokenId,
                params.valuation,
                params.duration,
                params.annualInterestBPS,
                params.ltvBPS,
                params.oracle,
                nonce,
                signature.deadline
            )
        );
        require(ecrecover(_getDigest(dataHash), signature.v, signature.r, signature.s) == borrower, "NFTPair: signature invalid");
        _requestLoan(borrower, tokenId, params, borrower, false);
        _lend(msg.sender, tokenId, params, skimFunds);
    }

    /// Approximates continuous compounding. Uses Horner's method to evaluate
    /// the truncated Maclaurin series for exp - 1, accumulating rounding
    /// errors along the way. The following is always guaranteed:
    ///
    ///   principal * time * apr <= result <= principal * (e^(time * apr) - 1),
    ///
    /// where time = t/YEAR, up to at most the rounding error obtained in
    /// calculating linear interest.
    ///
    /// If the theoretical result that we are approximating (the rightmost part
    /// of the above inquality) fits in 128 bits, then the function is
    /// guaranteed not to revert (unless n > 250, which is way too high).
    /// If even the linear interest (leftmost part of the inequality) does not
    /// the function will revert.
    /// Otherwise, the function may revert, return a reasonable result, or
    /// return a very inaccurate result. Even then the above inequality is
    /// respected.
    function calculateInterest(
        uint256 principal,
        uint64 t,
        uint16 aprBPS
    ) public pure returns (uint256 interest) {
        // (NOTE: n is hardcoded as COMPOUND_INTEREST_TERMS)
        //
        // We calculate
        //
        //  ----- n                                       ----- n
        //   \           principal * (t * aprBPS)^k        \
        //    )          --------------------------   =:    )          term_k
        //   /                k! * YEAR_BPS^k              /
        //  ----- k = 1                                   ----- k = 1
        //
        // which approaches, but never exceeds the "theoretical" result,
        //
        //          M := principal * [ exp (t * aprBPS / YEAR_BPS) - 1
        //
        // as n goes to infinity. We use the fact that
        //
        //               principal * (t * aprBPS)^(k-1) * (t * aprBPS)
        //      term_k = ---------------------------------------------
        //                  (k-1)! * k * YEAR_BPS^(k-1) * YEAR_BPS
        //
        //                             t * aprBPS
        //             = term_{k-1} * ------------                          (*)
        //                            k * YEAR_BPS
        //
        // to calculate the terms one by one. The principal affords us the
        // precision to carry out the division without resorting to fixed-point
        // math. Any rounding error is downward, which we consider acceptable.
        //
        // Since all numbers involved are positive, each term is certainly
        // bounded above by M. From (*) we see that any intermediate results
        // are at most
        //
        //                      denom_k := k * YEAR_BPS.
        //
        // times M. Since YEAR_BPS fits in 38 bits, denom_k fits in 46 bits,
        // which proves that all calculations will certainly not overflow if M
        // fits in 128 bits.
        //
        // If M does not fit, then the intermediate results for some term may
        // eventually overflow, but this cannot happen at the first term, and
        // neither can the total overflow because it uses checked math.
        //
        // This constitutes a guarantee of specified behavior when M >= 2^128.
        uint256 x = uint256(t) * aprBPS;
        uint256 term_k = (principal * x) / YEAR_BPS;
        uint256 denom_k = YEAR_BPS;

        interest = term_k;
        for (uint256 k = 2; k <= COMPOUND_INTEREST_TERMS; k++) {
            denom_k += YEAR_BPS;
            term_k = (term_k * x) / denom_k;
            interest = interest.add(term_k); // <- Only overflow check we need
        }

        if (interest >= 2**128) {
            revert();
        }
    }

    function repay(uint256 tokenId, bool skim) public returns (uint256 amount) {
        TokenLoan memory loan = tokenLoan[tokenId];
        require(loan.status == LOAN_OUTSTANDING, "NFTPair: no loan");
        TokenLoanParams memory loanParams = tokenLoanParams[tokenId];
        require(
            // Addition is safe: both summands are smaller than 256 bits
            uint256(loan.startTime) + loanParams.duration > block.timestamp,
            "NFTPair: loan expired"
        );

        uint128 principal = loanParams.valuation;

        // No underflow: loan.startTime is only ever set to a block timestamp
        // Cast is safe: if this overflows, then all loans have expired anyway
        uint256 interest = calculateInterest(principal, uint64(block.timestamp - loan.startTime), loanParams.annualInterestBPS).to128();
        uint256 fee = (interest * PROTOCOL_FEE_BPS) / BPS;
        amount = principal + interest;

        uint256 totalShare = bentoBox.toShare(asset, amount, false);
        uint256 feeShare = bentoBox.toShare(asset, fee, false);

        address from;
        if (skim) {
            require(bentoBox.balanceOf(asset, address(this)) >= (totalShare + feesEarnedShare), "NFTPair: skim too much");
            from = address(this);
            // No overflow: result fits in BentoBox
        } else {
            bentoBox.transfer(asset, msg.sender, address(this), feeShare);
            from = msg.sender;
        }
        // No underflow: PROTOCOL_FEE_BPS < BPS by construction.
        feesEarnedShare += feeShare;
        delete tokenLoan[tokenId];

        bentoBox.transfer(asset, from, loan.lender, totalShare - feeShare);
        collateral.transferFrom(address(this), loan.borrower, tokenId);

        emit LogRepay(from, tokenId);
    }

    uint8 internal constant ACTION_REPAY = 2;
    uint8 internal constant ACTION_REMOVE_COLLATERAL = 4;

    uint8 internal constant ACTION_REQUEST_LOAN = 12;
    uint8 internal constant ACTION_LEND = 13;

    // Function on BentoBox
    uint8 internal constant ACTION_BENTO_DEPOSIT = 20;
    uint8 internal constant ACTION_BENTO_WITHDRAW = 21;
    uint8 internal constant ACTION_BENTO_TRANSFER = 22;
    uint8 internal constant ACTION_BENTO_TRANSFER_MULTIPLE = 23;
    uint8 internal constant ACTION_BENTO_SETAPPROVAL = 24;

    // Any external call (except to BentoBox)
    uint8 internal constant ACTION_CALL = 30;

    // Signed requests
    uint8 internal constant ACTION_REQUEST_AND_BORROW = 40;
    uint8 internal constant ACTION_TAKE_COLLATERAL_AND_LEND = 41;

    int256 internal constant USE_VALUE1 = -1;
    int256 internal constant USE_VALUE2 = -2;

    /// @dev Helper function for choosing the correct value (`value1` or `value2`) depending on `inNum`.
    function _num(
        int256 inNum,
        uint256 value1,
        uint256 value2
    ) internal pure returns (uint256 outNum) {
        outNum = inNum >= 0 ? uint256(inNum) : (inNum == USE_VALUE1 ? value1 : value2);
    }

    /// @dev Helper function for depositing into `bentoBox`.
    function _bentoDeposit(
        bytes memory data,
        uint256 value,
        uint256 value1,
        uint256 value2
    ) internal returns (uint256, uint256) {
        (IERC20 token, address to, int256 amount, int256 share) = abi.decode(data, (IERC20, address, int256, int256));
        amount = int256(_num(amount, value1, value2)); // Done this way to avoid stack too deep errors
        share = int256(_num(share, value1, value2));
        return bentoBox.deposit{value: value}(token, msg.sender, to, uint256(amount), uint256(share));
    }

    /// @dev Helper function to withdraw from the `bentoBox`.
    function _bentoWithdraw(
        bytes memory data,
        uint256 value1,
        uint256 value2
    ) internal returns (uint256, uint256) {
        (IERC20 token, address to, int256 amount, int256 share) = abi.decode(data, (IERC20, address, int256, int256));
        return bentoBox.withdraw(token, msg.sender, to, _num(amount, value1, value2), _num(share, value1, value2));
    }

    /// @dev Helper function to perform a contract call and eventually extracting revert messages on failure.
    /// Calls to `bentoBox` or `collateral` are not allowed for security reasons.
    /// This also means that calls made from this contract shall *not* be trusted.
    function _call(
        uint256 value,
        bytes memory data,
        uint256 value1,
        uint256 value2
    ) internal returns (bytes memory, uint8) {
        (address callee, bytes memory callData, bool useValue1, bool useValue2, uint8 returnValues) = abi.decode(
            data,
            (address, bytes, bool, bool, uint8)
        );

        if (useValue1 && !useValue2) {
            callData = abi.encodePacked(callData, value1);
        } else if (!useValue1 && useValue2) {
            callData = abi.encodePacked(callData, value2);
        } else if (useValue1 && useValue2) {
            callData = abi.encodePacked(callData, value1, value2);
        }

        require(callee != address(bentoBox) && callee != address(collateral) && callee != address(this), "NFTPair: can't call");

        (bool success, bytes memory returnData) = callee.call{value: value}(callData);
        require(success, "NFTPair: call failed");
        return (returnData, returnValues);
    }

    /// @notice Executes a set of actions and allows composability (contract calls) to other contracts.
    /// @param actions An array with a sequence of actions to execute (see ACTION_ declarations).
    /// @param values A one-to-one mapped array to `actions`. ETH amounts to send along with the actions.
    /// Only applicable to `ACTION_CALL`, `ACTION_BENTO_DEPOSIT`.
    /// @param datas A one-to-one mapped array to `actions`. Contains abi encoded data of function arguments.
    /// @return value1 May contain the first positioned return value of the last executed action (if applicable).
    /// @return value2 May contain the second positioned return value of the last executed action which returns 2 values (if applicable).
    function cook(
        uint8[] calldata actions,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external payable returns (uint256 value1, uint256 value2) {
        for (uint256 i = 0; i < actions.length; i++) {
            uint8 action = actions[i];
            if (action == ACTION_REPAY) {
                (uint256 tokenId, bool skim) = abi.decode(datas[i], (uint256, bool));
                repay(tokenId, skim);
            } else if (action == ACTION_REMOVE_COLLATERAL) {
                (uint256 tokenId, address to) = abi.decode(datas[i], (uint256, address));
                removeCollateral(tokenId, to);
            } else if (action == ACTION_REQUEST_LOAN) {
                (uint256 tokenId, TokenLoanParams memory params, address to, bool skim) = abi.decode(
                    datas[i],
                    (uint256, TokenLoanParams, address, bool)
                );
                requestLoan(tokenId, params, to, skim);
            } else if (action == ACTION_LEND) {
                (uint256 tokenId, TokenLoanParams memory params, bool skim) = abi.decode(datas[i], (uint256, TokenLoanParams, bool));
                lend(tokenId, params, skim);
            } else if (action == ACTION_BENTO_SETAPPROVAL) {
                (address user, address _masterContract, bool approved, uint8 v, bytes32 r, bytes32 s) = abi.decode(
                    datas[i],
                    (address, address, bool, uint8, bytes32, bytes32)
                );
                bentoBox.setMasterContractApproval(user, _masterContract, approved, v, r, s);
            } else if (action == ACTION_BENTO_DEPOSIT) {
                (value1, value2) = _bentoDeposit(datas[i], values[i], value1, value2);
            } else if (action == ACTION_BENTO_WITHDRAW) {
                (value1, value2) = _bentoWithdraw(datas[i], value1, value2);
            } else if (action == ACTION_BENTO_TRANSFER) {
                (IERC20 token, address to, int256 share) = abi.decode(datas[i], (IERC20, address, int256));
                bentoBox.transfer(token, msg.sender, to, _num(share, value1, value2));
            } else if (action == ACTION_BENTO_TRANSFER_MULTIPLE) {
                (IERC20 token, address[] memory tos, uint256[] memory shares) = abi.decode(datas[i], (IERC20, address[], uint256[]));
                bentoBox.transferMultiple(token, msg.sender, tos, shares);
            } else if (action == ACTION_CALL) {
                (bytes memory returnData, uint8 returnValues) = _call(values[i], datas[i], value1, value2);

                if (returnValues == 1) {
                    (value1) = abi.decode(returnData, (uint256));
                } else if (returnValues == 2) {
                    (value1, value2) = abi.decode(returnData, (uint256, uint256));
                }
            } else if (action == ACTION_REQUEST_AND_BORROW) {
                (
                    uint256 tokenId,
                    address lender,
                    address recipient,
                    TokenLoanParams memory params,
                    bool skimCollateral,
                    bool anyTokenId,
                    SignatureParams memory signature
                ) = abi.decode(datas[i], (uint256, address, address, TokenLoanParams, bool, bool, SignatureParams));
                requestAndBorrow(tokenId, lender, recipient, params, skimCollateral, anyTokenId, signature);
            } else if (action == ACTION_TAKE_COLLATERAL_AND_LEND) {
                (uint256 tokenId, address borrower, TokenLoanParams memory params, bool skimFunds, SignatureParams memory signature) = abi
                    .decode(datas[i], (uint256, address, TokenLoanParams, bool, SignatureParams));
                takeCollateralAndLend(tokenId, borrower, params, skimFunds, signature);
            }
        }
    }

    /// @notice Withdraws the fees accumulated.
    function withdrawFees() public {
        address to = masterContract.feeTo();

        uint256 _share = feesEarnedShare;
        if (_share > 0) {
            bentoBox.transfer(asset, address(this), to, _share);
            feesEarnedShare = 0;
        }

        emit LogWithdrawFees(to, _share);
    }

    /// @notice Sets the beneficiary of fees accrued in liquidations.
    /// MasterContract Only Admin function.
    /// @param newFeeTo The address of the receiver.
    function setFeeTo(address newFeeTo) public onlyOwner {
        feeTo = newFeeTo;
        emit LogFeeTo(newFeeTo);
    }
}
