/*
 * This is a specification file for the formal verification
 * of the DutchAuction using the Certora Prover.
 */

/*
 * Declaration of contracts used in the spec 
 */
using DummyERC20A as tokenA
using DummyERC20B as tokenB
using DummyWeth as wethTokenImpl
using Receiver as receiver 

/*
 * Declaration of methods that are used in the rules.
 * envfree indicates that the method is not dependent on the environment, eg:
 * msg.value, msg.sender, etc.
 * Methods that are not declared here are assumed to be dependent on env.
 */
methods {
	// envfree methods
	commitments(address) returns (uint256) envfree
	claimed(address) returns (uint256) envfree
	paymentCurrency() returns (address) envfree
	auctionToken() returns (address) envfree
	tokenBalanceOf(address, address) returns (uint256) envfree
	getCommitmentsTotal() returns (uint256) envfree
	isInitialized() returns (bool) envfree
	getStartPrice() returns (uint256) envfree

	// IERC20 methods to be called with one of the tokens (DummyERC20*, DummyWeth)
	balanceOf(address) => DISPATCHER(true) 
	totalSupply() => DISPATCHER(true)
	transferFrom(address from, address to, uint256 amount) => DISPATCHER(true)
	transfer(address to, uint256 amount) => DISPATCHER(true)
	permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) => NONDET
	decimals() => DISPATCHER(true)
	
	// receiver if weth
	sendTo() => DISPATCHER(true)

	// IPointList
	hasPoints(address account, uint256 amount) => NONDET
}

// Max uint256 value in hex
definition MAX_UNSIGNED_INT() returns uint256 =
 			0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

// A ghost function that tracks the sum of all commitments
ghost sumCommitments() returns uint256 {
	init_state axiom sumCommitments() == 0;
}

// On update to commitments, updates to the sumCommitments
hook Sstore commitments[KEY uint a] uint commit (uint oldCommit) STORAGE {
	havoc sumCommitments assuming sumCommitments@new() == sumCommitments@old() + commit - oldCommit; 
}

// When loading userCollateralShare[a] assume that the sum is more than the loaded value
hook Sload uint256 commit commitments[KEY uint a] STORAGE { 
	require sumCommitments() >= commit;
}

//////////////////////////////////////////////////////////////////////
//                            Invariants                            //
//////////////////////////////////////////////////////////////////////
// While the auction is open commitmentsTotal is always equal to the sum of commitments from all bidders.
invariant commitmentsTotal()
	sumCommitments() == getCommitmentsTotal()
	{
		preserved withdrawTokens() with (env e) {
			require isOpen(e);
		}

		preserved withdrawTokens(address a) with (env e) {
			require isOpen(e);
		}
	}

//in general cases the sum is less than the total
invariant sumLessThanTotal()
	sumCommitments() <= getCommitmentsTotal()
	
// Since we assume the following property in other rules we make to sure this is always true
rule initState(method f) filtered 
		{f -> (f.selector == initMarket(bytes).selector ||
			f.selector == initAuction(address, address, uint256, uint256,
									  uint256, address, uint256, uint256,
									  address, address, address).selector)} {
	env eF;
	env e;
	
	uint64 _startTime;
    uint64 _endTime;
    uint128 _totalTokens;
	uint128 _startPrice;
    uint128 _minimumPrice;

	calldataarg args;
	require eF.msg.sender == e.msg.sender && eF.block.timestamp == e.block.timestamp;
	f(eF, args);

	_startTime, _endTime, _totalTokens = marketInfo(e);
	_startPrice, _minimumPrice = marketPrice(e);
    assert (_startTime < _endTime && _minimumPrice > 0 && _startPrice > _minimumPrice);
}

// marketInfo and marketPrice structs should be unmodifiable after the
// auction has started.
rule marketInfoAndPriceModificationPolicy(method f) {
	env e;
	env eF;

	uint64 _startTime;
    uint64 _endTime;
    uint128 _totalTokens;
	uint128 _startPrice;
    uint128 _minimumPrice;

	// recording struct values before
    _startTime, _endTime, _totalTokens = marketInfo(e);
	_startPrice, _minimumPrice = marketPrice(e);
    
	require (f.selector != initMarket(bytes).selector &&
			f.selector != initAuction(address, address, uint256, uint256,
									  uint256, address, uint256, uint256, 
									  address, address, address).selector);

	// calling any method except initMarket and initAuction
	calldataarg args;
	require eF.msg.sender == e.msg.sender && eF.block.timestamp == e.block.timestamp;
	f(eF, args);
	
	uint64 startTime_;
    uint64 endTime_;
    uint128 totalTokens_;
	uint128 startPrice_;
    uint128 minimumPrice_;

	// recording struct values after
    startTime_, endTime_, totalTokens_ = marketInfo(e);
	startPrice_, minimumPrice_ = marketPrice(e);
	
	// making sure that before and after values are unchanged
	assert 	_totalTokens == totalTokens_ &&
			(getCommitmentsTotal() > 0 => (_startPrice == startPrice_ && 
			_minimumPrice == minimumPrice_ &&
			_endTime == endTime_ &&
			_startTime == startTime_)); 		
}

//////////////////////////////////////////////////////////////////////
//                              Rules                               //
//////////////////////////////////////////////////////////////////////

// For all users, their external (balanceOf) and internal (commitments) is
// preserved during the commitEth and commitTokens operations
rule preserveTotalAssetsOnCommit(address user, uint256 amount, method f) {
	env e;

	require user == e.msg.sender;
	require e.msg.sender != currentContract; 

	// recording user's external and internal balance before they commit
	uint256 _userPaymentCurrencyBalance = tokenBalanceOf(paymentCurrency(), user);
	uint256 _userCommitments = commitments(user);
	
	// limiting f to just test for commitEth and commitTokens operations
        require f.selector == commitEth(address, bool).selector ||
		        f.selector == commitTokens(uint256, bool).selector  || 
			f.selector == batchCommitEth(address,bool,address,bool).selector ;

	if (f.selector == commitTokens(uint256, bool).selector && !f.isFallback ) {
		commitTokens(e, amount, true);
	} else if (f.selector == commitEth(address, bool).selector && !f.isFallback )  {
		require e.msg.value == amount;
		commitEth(e, user, true);
	} else if (f.selector == batchCommitEth(address,bool,address,bool).selector && !f.isFallback) {
		require tokenBalanceOf(paymentCurrency(), currentContract) >= sumCommitments();
		require isOpen(e) => sumCommitments() == getCommitmentsTotal();
		require user == receiver;
		require e.msg.value == amount;
		batchCommitEth(e, user, true, user, true);
	} else {
		calldataarg args;
		f(e,args);
	}

	// recording user's external and internal balance after they commit
	uint256 userPaymentCurrencyBalance_ = tokenBalanceOf(paymentCurrency(), user);
	uint256 userCommitments_ = commitments(user);

	assert(_userPaymentCurrencyBalance + _userCommitments == userPaymentCurrencyBalance_ + userCommitments_);
}

// The payamentToken balance of the systems is at least as the sum of
// commitments until the auction is successfully finalized
rule commitmentsLeqPaymentTokensBalance(bool auctionSuccess, method f) {
	env eF;
	env e;

	require eF.msg.sender != currentContract; // needed for commitTokens and commitTokensFrom
	require e.block.timestamp == eF.block.timestamp;
	require auctionSuccess == auctionSuccessful(e);

	// need to do this for initialization methods since they change the paymentCurrency
	// and the auctionToken.
	address paymentToken = paymentCurrency();
	address auctionCurrency = auctionToken();
	require auctionCurrency != paymentToken;
	//safe assumption - proven 
	require sumCommitments() <= getCommitmentsTotal();

	// finalize reduces the system's balance in case of a successful auction
	require(f.selector != finalize().selector || !auctionSuccess);

	require tokenBalanceOf(paymentToken, currentContract) >= sumCommitments();
	
	calldataarg args;
	f(eF, args);
	
	assert tokenBalanceOf(paymentToken, currentContract) >= sumCommitments();
}

// If auction is successful, assets and state is preserved by withdraw operation
rule auctionSuccessfulWithdraw() {
	env e;
	env eF;

	require auctionToken() != paymentCurrency();
	require auctionSuccessful(e) == true;
	require e.msg.sender == receiver;

	// recording assets and state before withdraw
	uint256 _userPaymentCurrencyBalance = tokenBalanceOf(paymentCurrency(), e.msg.sender);
	uint256 _userAuctionTokenBalance = tokenBalanceOf(auctionToken(), e.msg.sender);
	uint256 _userClaimed = claimed(e.msg.sender);
	uint256 claimableTokens = tokensClaimable(e, e.msg.sender);

	require eF.msg.sender == e.msg.sender && eF.block.timestamp == e.block.timestamp;
	withdrawTokens(eF);

	// recording assets and state after withdraw
	uint256 userPaymentCurrencyBalance_ = tokenBalanceOf(paymentCurrency(), e.msg.sender);
	uint256 userAuctionTokenBalance_ = tokenBalanceOf(auctionToken(), e.msg.sender);
	uint256 userClaimed_ = claimed(e.msg.sender);

	// user's paymentCurrency's balance shouldn't change
	assert(_userPaymentCurrencyBalance == userPaymentCurrencyBalance_);
	// user's auctionToken's balance should increase by claimableTokens
	assert(userAuctionTokenBalance_ == _userAuctionTokenBalance + claimableTokens);
	// claimed(user) (internal state) should be correctly updated to reflect that
	// user has claimed claimableTokens
	assert(userClaimed_ == _userClaimed + claimableTokens);
}

// If auction is unsuccessful, withdraw operation should return all user's 
// commitments
rule auctionUnsuccessfulWithdraw() {
	env e;
	env eF;

	require auctionSuccessful(e) == false;
	require e.msg.sender != currentContract;

	uint256 _userPaymentCurrencyBalance = tokenBalanceOf(paymentCurrency(), e.msg.sender);
	uint256 _userCommitments = commitments(e.msg.sender);

	require eF.msg.sender == e.msg.sender && eF.block.timestamp == e.block.timestamp;
	withdrawTokens(eF);

	uint256 userPaymentCurrencyBalance_ = tokenBalanceOf(paymentCurrency(), e.msg.sender);
	uint256 userCommitments_ = commitments(e.msg.sender);

	assert(userPaymentCurrencyBalance_ == _userPaymentCurrencyBalance + _userCommitments);
	assert(userCommitments_ == 0);
}

// Other users' assets shouldn't be affected by operations unless they are a
// part of the operation.
rule noChangeToOthersAssets(method f, address other, address from) {
	env e;

	assumeInitState();

	require e.msg.sender != other && other == receiver;
	require paymentCurrency() != auctionToken();

	uint256 _otherPaymentCurrencyBalance = tokenBalanceOf(paymentCurrency(), other);
	uint256 _otherAuctionTokenBalance = tokenBalanceOf(auctionToken(), other);
	uint256 _otherCommitment = commitments(other);
	uint256 _otherClaimed = claimed(other);

	uint256 amount;
	callFunction(e.msg.sender, from, receiver, amount, f);

	uint256 otherPaymentCurrencyBalance_ = tokenBalanceOf(paymentCurrency(), other);
	uint256 otherAuctionTokenBalance_ = tokenBalanceOf(auctionToken(), other);
	uint256 otherCommitment_ = commitments(other);
	uint256 otherClaimed_ = claimed(other);

	assert(_otherPaymentCurrencyBalance <= otherPaymentCurrencyBalance_,
		    "other's payment balance decreased");

	assert(_otherAuctionTokenBalance <= otherAuctionTokenBalance_,
		       "other's auction balance decreased");

	// if other is receiver, it is expected that after withdraw, their
	// commitment decreases and claimed increases
	if (f.selector == withdrawTokens(address).selector) {
		assert(_otherCommitment >= otherCommitment_, "other's commitment increased");
		assert(_otherClaimed <= otherClaimed_, "other's claimed didn't update");
		
	} else {
		assert(_otherCommitment <= otherCommitment_, "other's commitment decreased");
		assert(_otherClaimed == otherClaimed_, "other's claimed changed");
	}
}

// Once the auction is successful, no more commitments are possible
rule auctionSuccessfulSteadyState(method f) {
	env e;
	env eF;

	assumeInitState();

	uint256 commitmentsBefore = getCommitmentsTotal();
	
	require (isInitialized() && auctionSuccessful(e) && getCommitmentsTotal() > 0);

	calldataarg args;
	require eF.msg.sender == e.msg.sender && eF.block.timestamp == e.block.timestamp;
	f(eF, args);

	uint256 commitmentsAfter = getCommitmentsTotal();

	assert (auctionSuccessful(e) && commitmentsAfter == commitmentsBefore);
}

// No commitments are possible before the auction starts
rule noCommitmentsBeforeOpen(method f) 
				filtered {f -> (f.selector == commitEth(address, bool).selector ||
								f.selector == commitTokens(uint256, bool).selector)} 
{
	env e;

	address sender;
	address user; 
	uint256 amount;
	bool b;

	require (commitments(user) == 0);

	if (f.selector == commitEth(address, bool).selector) {
		require (e.msg.sender == user && e.msg.value == amount);
		commitEth(e, user, b);
	}
	else {
		require (e.msg.sender == user);
		commitTokens(e, amount, b);
	}

	uint64 startTime_;
    uint64 endTime_;
    uint128 totalTokens_;

	startTime_, endTime_, totalTokens_ = marketInfo(e);

	// if a user has some commitments, then the curr time has to be greater
	// than the start time of the auction
	assert (commitments(user) > 0 => e.block.timestamp >= startTime_);
}

rule beneficiaryClaimableTokensShouldDecrease() {
    env e;
    address user;

	require user != currentContract;
    assumeInitState();

    require isInitialized() && auctionSuccessful(e) && tokensClaimable(e, user) != 0;

    uint256 _userClaimableTokens = tokensClaimable(e, user);

    withdrawTokens(e, user);

    uint256 userClaimableTokens_ = tokensClaimable(e, user);

    assert(auctionSuccessful(e) && userClaimableTokens_ < _userClaimableTokens);
}

// Rules that are timing out.
/*
rule additivityOfCommitEth(address user, address beneficiary, uint256 x, uint256 y) {
	env ex;
	env ey;
	env exy;
	bool agreement;
		
	require x + y <= MAX_UNSIGNED_INT();
	uint256 sum = x + y;

	require user != currentContract;
	require ex.msg.sender == user && ey.msg.sender == user && exy.msg.sender == user;
	require ex.msg.value == x && ey.msg.sender == y && exy.msg.sender == sum;
	require beneficiary == receiver;

	storage initStorage = lastStorage;
	
	commitEth(ex, beneficiary, agreement);
	commitEth(ey, beneficiary, agreement);
	
	
	uint256 splitScenarioCommitment = commitments(beneficiary);
	uint256 splitScenarioSenderBalanceOf = tokenBalanceOf(paymentCurrency(), user);

	
	commitEth(exy, beneficiary, agreement) at initStorage;
	
	uint256 sumScenarioCommitment = commitments(beneficiary);
	uint256 sumScenarioSenderBalanceOf = tokenBalanceOf(paymentCurrency(), user);

	assert(splitScenarioCommitment == sumScenarioCommitment, 
		   "addCommitment not additive on commitment");

	assert(splitScenarioSenderBalanceOf == sumScenarioSenderBalanceOf, 
		   "addCommitment not additive on sender's balanceOf");
	
}
*/

/*
rule noFrontRunningOnWithdraw(method f) 
		// this methods can cause the withdraw to fail, since the auction can be now successful or finalized
		filtered { f-> (f.selector != commitEth(address, bool).selector &&
						f.selector != commitTokensFrom(address, uint256, bool).selector &&
						f.selector != commitTokens(uint256, bool).selector &&
						f.selector != finalize().selector)}
	
{
	env e;
	env eW;
	env eF;
	calldataarg argsF;
	uint64 startTime_;
    uint64 endTime_;
    uint128 totalTokens_;

	startTime_, endTime_, totalTokens_ = marketInfo(e);
	assumeInitState();
	uint256 commitments_ = commitments(e.msg.sender);
	address other;
	require(other != e.msg.sender);
	require (eF.msg.sender != currentContract && e.msg.sender != currentContract);
	require (eF.msg.sender != e.msg.sender || f.selector != withdrawTokens().selector);
	require (commitments_ <= getCommitmentsTotal());
	require (commitments_ > 0 => e.block.timestamp >= startTime_);
	require (commitments_ > 0);
	storage initStorage = lastStorage;
	
	//first scenario: user can call withdrawTokens
	require eW.msg.sender == e.msg.sender && eW.block.timestamp == e.block.timestamp;
	withdrawTokens(eW);

	//second scenario: someone else calls another function (or same user calls another function beside withdraw) 
	if (f.selector != withdrawTokens(address).selector) {
		withdrawTokens(eF, other) at initStorage;
	}
	else {
		f(eF, argsF) at initStorage;
	}
	//Verify that user can call withdrawTokens
	withdrawTokens@withrevert(e);
	assert !lastReverted;
}
*/

//////////////////////////////////////////////////////////////////////
//                         Helper Functions                         //
//////////////////////////////////////////////////////////////////////

// Helper function to call DutchAuction methods with some specific arguments
function callFunction(address sender, address from, address beneficiary,
			          uint256 amount, method f) {
	env e;

	bool agreementAccepted;

	require e.msg.sender == sender;

	if (f.selector == commitEth(address, bool).selector) {
		require e.msg.value == amount;
		commitEth(e, beneficiary, agreementAccepted);
	} else if (f.selector == withdrawTokens(address).selector) {
		withdrawTokens(e, beneficiary);
	} else if (f.selector == commitTokensFrom(address, uint256, bool).selector) {
		commitTokensFrom(e, from, amount, agreementAccepted);
	} else if (f.selector == commitTokens(uint256, bool).selector) {
		commitTokens(e, amount, agreementAccepted);
	} else {
		calldataarg args;
		f(e,args);
	}
}

function assumeInitState() {
	env e;

	uint128 startPrice__;
    uint128 minimumPrice__;
	uint64 startTime__;
    uint64 endTime__;
    uint128 totalTokens__;

	startTime__, endTime__, totalTokens__ = marketInfo(e);
	startPrice__, minimumPrice__ = marketPrice(e);
	
	require (startTime__ < endTime__ && minimumPrice__ > 0 && startPrice__ > minimumPrice__ && isInitialized());
}