/*
 * This is a specification file for the formal verification
 * of the DutchAuction using the Certora Prover. These rules take long
 * to run, so they are seperated from the main spec file.
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
	paymentCurrency() returns (address) envfree
	tokenBalanceOf(address, address) returns (uint256) envfree
	getCommitmentsTotal() returns (uint256) envfree

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

// commitTokensFrom is additive, meaning that first commiting x, then commiting
// y is same as commiting x + y in one go.
rule additivityOfCommitTokensFrom(uint256 x, uint256 y,
								  address from, bool agreement) {
	env e;

	require e.msg.sender != currentContract;

	// recording the entire state of the contract
	storage initStorage = lastStorage;
	
	// commiting x and y in two steps
	commitTokensFrom(e, from, x, agreement);
	commitTokensFrom(e, from, y, agreement);
	
	// recording state when commited using two steps
	uint256 splitScenarioCommitment = commitments(from);
	uint256 splitScenarioSenderBalanceOf = tokenBalanceOf(paymentCurrency(), e.msg.sender);
	uint256 splitTotalCommitments = getCommitmentsTotal();

	// overflow prevention
	require x + y <= MAX_UNSIGNED_INT();
	uint256 sum = x + y;

	// commiting x + y in one step using initStorage
	commitTokensFrom(e, from, sum, agreement) at initStorage;
	
	// recording state when commited using one step
	uint256 sumScenarioCommitment = commitments(from);
	uint256 sumScenarioSenderBalanceOf = tokenBalanceOf(paymentCurrency(), e.msg.sender);
	uint256 sumTotalCommitments = getCommitmentsTotal();

	// asserting that commiting using two steps is the same as commiting using
	// one step
	assert(splitScenarioCommitment == sumScenarioCommitment, 
		   "addCommitment not additive on commitment");

	assert(splitScenarioSenderBalanceOf == sumScenarioSenderBalanceOf, 
		   "addCommitment not additive on sender's balanceOf");
	
	assert(splitTotalCommitments == sumTotalCommitments, 
		   "addCommitment not additive on totalCommitments");
}