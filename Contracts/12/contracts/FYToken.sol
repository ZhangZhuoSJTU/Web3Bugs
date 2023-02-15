// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";
import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "./utils/token/ERC20Permit.sol";
import "./interfaces/vault/IFYToken.sol";
import "./interfaces/vault/IJoin.sol";
import "./interfaces/vault/IOracle.sol";
import "./utils/access/AccessControl.sol";
import "./math/WMul.sol";
import "./math/WDiv.sol";
import "./math/CastU256U128.sol";
import "./math/CastU256U32.sol";


contract FYToken is IFYToken, IERC3156FlashLender, AccessControl(), ERC20Permit {
    using WMul for uint256;
    using WDiv for uint256;
    using CastU256U128 for uint256;
    using CastU256U32 for uint256;

    event SeriesMatured(uint256 chiAtMaturity);
    event Redeemed(address indexed from, address indexed to, uint256 amount, uint256 redeemed);
    event OracleSet(address indexed oracle);

    bytes32 constant CHI = "chi";

    uint256 constant internal MAX_TIME_TO_MATURITY = 126144000; // seconds in four years
    bytes32 constant internal FLASH_LOAN_RETURN = keccak256("ERC3156FlashBorrower.onFlashLoan");

    IOracle public oracle;                                      // Oracle for the savings rate.
    IJoin public immutable join;                                // Source of redemption funds.
    address public immutable override underlying;
    bytes6 public immutable underlyingId;                             // Needed to access the oracle
    uint256 public immutable override maturity;
    uint256 public chiAtMaturity = type(uint256).max;           // Spot price (exchange rate) between the base and an interest accruing token at maturity 

    constructor(
        bytes6 underlyingId_,
        IOracle oracle_, // Underlying vs its interest-bearing version
        IJoin join_,
        uint256 maturity_,
        string memory name,
        string memory symbol
    ) ERC20Permit(name, symbol, IERC20Metadata(address(IJoin(join_).asset())).decimals()) { // The join asset is this fyToken's underlying, from which we inherit the decimals
        uint256 now_ = block.timestamp;
        require(
            maturity_ > now_ &&
            maturity_ < now_ + MAX_TIME_TO_MATURITY &&
            maturity_ < type(uint32).max,
            "Invalid maturity"
        );

        underlyingId = underlyingId_;
        join = join_;
        maturity = maturity_;
        underlying = address(IJoin(join_).asset());
        setOracle(oracle_);
    }

    modifier afterMaturity() {
        require(
            uint32(block.timestamp) >= maturity,
            "Only after maturity"
        );
        _;
    }

    modifier beforeMaturity() {
        require(
            uint32(block.timestamp) < maturity,
            "Only before maturity"
        );
        _;
    }

    /// @dev Set the oracle parameter
    function setOracle(IOracle oracle_)
        public
        auth    
    {
        oracle = oracle_;
        emit OracleSet(address(oracle_));
    }

    /// @dev Mature the fyToken by recording the chi.
    /// If called more than once, it will revert.
    function mature()
        external override
        afterMaturity
    {
        require (chiAtMaturity == type(uint256).max, "Already matured");
        _mature();
    }

    /// @dev Mature the fyToken by recording the chi.
    function _mature() 
        private
        returns (uint256 _chiAtMaturity)
    {
        (_chiAtMaturity,) = oracle.get(underlyingId, CHI, 1e18);
        chiAtMaturity = _chiAtMaturity;
        emit SeriesMatured(_chiAtMaturity);
    }

    /// @dev Retrieve the chi accrual since maturity, maturing if necessary.
    function accrual()
        external
        afterMaturity
        returns (uint256)
    {
        return _accrual();
    }

    /// @dev Retrieve the chi accrual since maturity, maturing if necessary.
    /// Note: Call only after checking we are past maturity
    function _accrual()
        private
        returns (uint256 accrual_)
    {
        if (chiAtMaturity == type(uint256).max) {  // After maturity, but chi not yet recorded. Let's record it, and accrual is then 1.
            _mature();
        } else {
            (uint256 chi,) = oracle.get(underlyingId, CHI, 1e18);
            accrual_ = chi.wdiv(chiAtMaturity);
        }
        accrual_ = accrual_ >= 1e18 ? accrual_ : 1e18;     // The accrual can't be below 1 (with 18 decimals)
    }

    /// @dev Burn the fyToken after maturity for an amount that increases according to `chi`
    function redeem(address to, uint256 amount)
        external override
        afterMaturity
        returns (uint256 redeemed)
    {
        _burn(msg.sender, amount);
        redeemed = amount.wmul(_accrual());
        join.exit(to, redeemed.u128());
        
        emit Redeemed(msg.sender, to, amount, redeemed);
        return amount;
    }

    /// @dev Mint fyTokens.
    function mint(address to, uint256 amount)
        external override
        beforeMaturity
        auth
    {
        _mint(to, amount);
    }

    /// @dev Burn fyTokens. The user needs to have either transferred the tokens to this contract, or have approved this contract to take them. 
    function burn(address from, uint256 amount)
        external override
        auth
    {
        _burn(from, amount);
    }

    /// @dev Burn fyTokens. 
    /// Any tokens locked in this contract will be burned first and subtracted from the amount to burn from the user's wallet.
    /// This feature allows someone to transfer fyToken to this contract to enable a `burn`, potentially saving the cost of `approve` or `permit`.
    function _burn(address from, uint256 amount)
        internal override
        returns (bool)
    {
        // First use any tokens locked in this contract
        uint256 available = _balanceOf[address(this)];
        if (available >= amount) {
            unchecked { return super._burn(address(this), amount); }
        } else {
            if (available > 0 ) super._burn(address(this), available);
            unchecked { _decreaseAllowance(from, amount - available); }
            unchecked { return super._burn(from, amount - available); }
        }
    }

    /**
     * @dev From ERC-3156. The amount of currency available to be lended.
     * @param token The loan currency. It must be a FYDai contract.
     * @return The amount of `token` that can be borrowed.
     */
    function maxFlashLoan(address token)
        external view override
        beforeMaturity
        returns (uint256)
    {
        return token == address(this) ? type(uint256).max - _totalSupply : 0;
    }

    /**
     * @dev From ERC-3156. The fee to be charged for a given loan.
     * @param token The loan currency. It must be a FYDai.
     * param amount The amount of tokens lent.
     * @return The amount of `token` to be charged for the loan, on top of the returned principal.
     */
    function flashFee(address token, uint256)
        external view override
        beforeMaturity
        returns (uint256)
    {
        require(token == address(this), "Unsupported currency");
        return 0;
    }

    /**
     * @dev From ERC-3156. Loan `amount` fyDai to `receiver`, which needs to return them plus fee to this contract within the same transaction.
     * Note that if the initiator and the borrower are the same address, no approval is needed for this contract to take the principal + fee from the borrower.
     * If the borrower transfers the principal + fee to this contract, they will be burnt here instead of pulled from the borrower.
     * @param receiver The contract receiving the tokens, needs to implement the `onFlashLoan(address user, uint256 amount, uint256 fee, bytes calldata)` interface.
     * @param token The loan currency. Must be a fyDai contract.
     * @param amount The amount of tokens lent.
     * @param data A data parameter to be passed on to the `receiver` for any custom use.
     */
    function flashLoan(IERC3156FlashBorrower receiver, address token, uint256 amount, bytes memory data)
        external override
        beforeMaturity
        returns(bool)
    {
        require(token == address(this), "Unsupported currency");
        _mint(address(receiver), amount);
        require(receiver.onFlashLoan(msg.sender, token, amount, 0, data) == FLASH_LOAN_RETURN, "Non-compliant borrower");
        _burn(address(receiver), amount);
        return true;
    }
}
