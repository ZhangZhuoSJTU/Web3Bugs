certoraRun spec/harness/DutchAuctionHarness.sol spec/harness/DummyERC20A.sol \
spec/harness/DummyERC20B.sol spec/harness/DummyWeth.sol spec/harness/Receiver.sol spec/harness/Wallet.sol:Wallet \
	--verify DutchAuctionHarness:spec/dutchAuctionAdditional.spec \
	--link DutchAuctionHarness:wallet=Wallet \
	--settings -assumeUnwindCond,-ignoreViewFunctions,-enableStorageAnalysis=true,-depth=15 \
	--solc solc6.12 \
	--cloud --msg "dutch auction : additional rules"