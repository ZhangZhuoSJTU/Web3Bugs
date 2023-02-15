.PHONY: compile_solidity_mock_erc compile_go_mock_erc compile_mock_erc
.PHONY: compile_solidity_mock_cerc compile_go_mock_cerc compile_mock_cerc
.PHONY: compile_solidity_mock_marketplace compile_go_mock_marketplace
.PHONY: compile_go_mock_vaulttracker compile_go_mock_zctoken
.PHONY: compile_mocks

# TODO under? api-specific sol?

.PHONY: compile_solidity_zct compile_go_zct compile_zct
.PHONY: compile_tokens

.PHONY: compile_solidity_sig_fake compile_go_sig_fake compile_sig_fake
.PHONY: compile_solidity_hash_fake compile_go_hash_fake compile_hash_fake
.PHONY: compile_fakes

.PHONY: compile_solidity_swivel_test compile_go_swivel_test compile_swivel_test
.PHONY: compile_solidity_marketplace_test compile_go_marketplace_test compile_marketplace_test
.PHONY: compile_solidity_vaulttracker_test compile_go_vaulttracker_test compile_vaulttracker_test
.PHONY: compile_test

.PHONY: clean_test_abi clean_test_bin clean_test_go
.PHONY: clean_test

.PHONY: clean_build_sol clean_build_abi clean_build_bin clean_build_go
.PHONY: clean_build

.PHONY: copy_zctoken_to_build copy_vaulttracker_to_build copy_marketplace_to_build copy_swivel_to_build
.PHONY: copy_to_build
.PHONY: compile_marketplace_build compile_swivel_build compile_build

.PHONY: all

# Mocks
compile_solidity_mock_erc:
	@echo "compiling Mock ERC20 solidity source into abi and bin files"
	solc -o ./test/mocks --abi --bin --overwrite ./test/mocks/Erc20.sol

compile_go_mock_erc:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/mocks/Erc20.abi --bin ./test/mocks/Erc20.bin -pkg mocks -type Erc20 -out ./test/mocks/erc20.go 

compile_mock_erc: compile_solidity_mock_erc compile_go_mock_erc

compile_solidity_mock_cerc:
	@echo "compiling Mock CERC20 solidity source into abi and bin files"
	solc -o ./test/mocks --abi --bin --overwrite ./test/mocks/CErc20.sol

compile_go_mock_cerc:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/mocks/CErc20.abi --bin ./test/mocks/CErc20.bin -pkg mocks -type CErc20 -out ./test/mocks/cerc20.go 

compile_mock_cerc: compile_solidity_mock_cerc compile_go_mock_cerc

compile_solidity_mock_marketplace:
	@echo "compiling Mock MarketPlace solidity source into abi and bin files"
	solc -o ./test/mocks --abi --bin --overwrite ./test/mocks/MarketPlace.sol

compile_go_mock_marketplace:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/mocks/MarketPlace.abi --bin ./test/mocks/MarketPlace.bin -pkg mocks -type MarketPlace -out ./test/mocks/marketplace.go 

compile_mock_marketplace: compile_solidity_mock_marketplace compile_go_mock_marketplace

# vaulttracker and zctoken do not require a solidity compile step as they are directly imported by another contract which compiles them
compile_go_mock_vaulttracker:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/marketplace/VaultTracker.abi --bin ./test/marketplace/VaultTracker.bin -pkg mocks -type VaultTracker -out ./test/mocks/vaulttracker.go

compile_go_mock_zctoken:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/marketplace/ZcToken.abi --bin ./test/marketplace/ZcToken.bin -pkg mocks -type ZcToken -out ./test/mocks/zctoken.go

compile_mocks: compile_mock_erc compile_mock_cerc compile_mock_marketplace compile_go_mock_vaulttracker compile_go_mock_zctoken

# Real Tokens
compile_solidity_zct:
	@echo "compiling ZCT solidity source into abi and bin files"
	solc -o ./test/tokens --abi --bin --overwrite ./test/tokens/ZcToken.sol

compile_go_zct:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/tokens/ZcToken.abi --bin ./test/tokens/ZcToken.bin -pkg tokens -type ZcToken -out ./test/tokens/zctoken.go 

compile_zct: compile_solidity_zct compile_go_zct

compile_solidity_underlying:
	@echo "compiling Underlying solidity source into abi and bin files"
	solc -o ./test/tokens --abi --bin --overwrite ./test/tokens/Underlying.sol

compile_go_underlying:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/tokens/Underlying.abi --bin ./test/tokens/Underlying.bin -pkg tokens -type Underlying -out ./test/tokens/underlying.go

compile_underlying: compile_solidity_underlying compile_go_underlying


compile_tokens: compile_zct compile_underlying

# Fakes
compile_solidity_sig_fake:
	@echo "compiling Sig and Fake source into abi and bin files"
	solc -o ./test/fakes --abi --bin --overwrite ./test/fakes/SigFake.sol

compile_go_sig_fake:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/fakes/SigFake.abi --bin ./test/fakes/SigFake.bin -pkg fakes -type SigFake -out ./test/fakes/sigfake.go 

compile_sig_fake: compile_solidity_sig_fake compile_go_sig_fake

compile_solidity_hash_fake:
	@echo "compiling Hash and Fake solidity source into abi and bin files"
	solc -o ./test/fakes --abi --bin --overwrite ./test/fakes/HashFake.sol

compile_go_hash_fake:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/fakes/HashFake.abi --bin ./test/fakes/HashFake.bin -pkg fakes -type HashFake -out ./test/fakes/hashfake.go 

compile_hash_fake: compile_solidity_hash_fake compile_go_hash_fake

compile_fakes: compile_sig_fake compile_hash_fake

# Contracts
compile_solidity_swivel_test:
	@echo "compiling Swivel solidity source into abi and bin files"
	solc -o ./test/swivel --optimize --optimize-runs=15000 --abi --bin --overwrite ./test/swivel/Swivel.sol

compile_go_swivel_test:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/swivel/Swivel.abi --bin ./test/swivel/Swivel.bin -pkg swivel -type Swivel -out ./test/swivel/swivel.go 

compile_swivel_test: compile_solidity_swivel_test compile_go_swivel_test

compile_solidity_marketplace_test:
	@echo "compiling MarketPlace solidity source into abi and bin files"
	solc -o ./test/marketplace --optimize --optimize-runs=100000 --abi --bin --overwrite ./test/marketplace/MarketPlace.sol

compile_go_marketplace_test:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/marketplace/MarketPlace.abi --bin ./test/marketplace/MarketPlace.bin -pkg marketplace -type MarketPlace -out ./test/marketplace/marketplace.go 

compile_marketplace_test: compile_solidity_marketplace_test compile_go_marketplace_test

compile_solidity_vaulttracker_test:
	@echo "compiling VaultTracker solidity source into abi and bin files"
	solc -o ./test/vaulttracker --abi --bin --overwrite ./test/vaulttracker/VaultTracker.sol

compile_go_vaulttracker_test:
	@echo "compiling abi and bin files to golang"
	abigen --abi ./test/vaulttracker/VaultTracker.abi --bin ./test/vaulttracker/VaultTracker.bin -pkg vaulttracker -type VaultTracker -out ./test/vaulttracker/vaulttracker.go 

compile_vaulttracker_test: compile_solidity_vaulttracker_test compile_go_vaulttracker_test

compile_test: compile_fakes compile_tokens compile_swivel_test compile_marketplace_test compile_vaulttracker_test compile_mocks

# Cleaning
clean_test_abi:
	@echo "removing abi files from test/ dirs"
	rm test/**/*.abi

clean_test_bin:
	@echo "removing bin files from test/ dirs"
	rm test/**/*.bin

clean_test_go:
	@echo "removing generated go bindings from test/ dirs"
	rm test/**/*.go

clean_test: clean_test_abi clean_test_bin clean_test_go

clean_build_sol:
	@echo "removing sol files from build/ dirs"
	rm build/**/*.sol

clean_build_abi:
	@echo "removing abi files from build/ dirs"
	rm build/**/*.abi

clean_build_bin:
	@echo "removing bin files from build/ dirs"
	rm build/**/*.bin

clean_build_go:
	@echo "removing go files from build/ dirs"
	rm build/**/*.go

clean_build: clean_build_sol clean_build_abi clean_build_bin clean_build_go

# Copying to build
copy_zctoken_to_build:
	@echo "copying ZcToken files to marketplace build"
	cp test/tokens/Hash.sol build/marketplace
	cp test/tokens/PErc20.sol build/marketplace
	cp test/tokens/IPErc20.sol build/marketplace
	cp test/tokens/Erc2612.sol build/marketplace
	cp test/tokens/IErc2612.sol build/marketplace
	cp test/tokens/ZcToken.sol build/marketplace
	cp test/tokens/IZcToken.sol build/marketplace

copy_vaulttracker_to_build:
	@echo "copying vaulttracker files to marketplace build"
	cp test/vaulttracker/VaultTracker.sol build/marketplace

copy_marketplace_to_build:
	@echo "copying marketplace files to marketplace build"
	cp test/marketplace/Abstracts.sol build/marketplace
	cp test/marketplace/MarketPlace.sol build/marketplace

copy_swivel_to_build:
	@echo "copying swivel files to marketplace build"
	cp test/swivel/Abstracts.sol build/swivel
	cp test/swivel/Hash.sol build/swivel
	cp test/swivel/Sig.sol build/swivel
	cp test/swivel/Swivel.sol build/swivel

copy_to_build: copy_zctoken_to_build copy_vaulttracker_to_build copy_marketplace_to_build copy_swivel_to_build

compile_marketplace_build:
	@echo "compiling MarketPlace solidity build source into deploy ready files"
	solc -o ./build/marketplace --optimize --optimize-runs=15000 --abi --bin --overwrite ./build/marketplace/MarketPlace.sol
	abigen --abi ./build/marketplace/MarketPlace.abi --bin ./build/marketplace/MarketPlace.bin -pkg marketplace -type MarketPlace -out ./build/marketplace/marketplace.go 

compile_swivel_build:
	@echo "compiling Swivel solidity build source into deploy ready files"
	solc -o ./build/swivel --optimize --optimize-runs=15000 --abi --bin --overwrite ./build/swivel/Swivel.sol
	abigen --abi ./build/swivel/Swivel.abi --bin ./build/swivel/Swivel.bin -pkg swivel -type Swivel -out ./build/swivel/swivel.go 

compile_build: compile_marketplace_build compile_swivel_build

all: clean_test compile_test clean_build copy_to_build compile_build
