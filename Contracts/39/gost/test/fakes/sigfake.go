// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package fakes

import (
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
)

// SigComponents is an auto generated low-level Go binding around an user-defined struct.
type SigComponents struct {
	V uint8
	R [32]byte
	S [32]byte
}

// SigFakeABI is the input ABI used to generate the binding from.
const SigFakeABI = "[{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"h\",\"type\":\"bytes32\"},{\"components\":[{\"internalType\":\"uint8\",\"name\":\"v\",\"type\":\"uint8\"},{\"internalType\":\"bytes32\",\"name\":\"r\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"s\",\"type\":\"bytes32\"}],\"internalType\":\"structSig.Components\",\"name\":\"c\",\"type\":\"tuple\"}],\"name\":\"recoverTest\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes\",\"name\":\"sig\",\"type\":\"bytes\"}],\"name\":\"splitTest\",\"outputs\":[{\"internalType\":\"uint8\",\"name\":\"v\",\"type\":\"uint8\"},{\"internalType\":\"bytes32\",\"name\":\"r\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"s\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"}]"

// SigFakeBin is the compiled bytecode used for deploying new contracts.
var SigFakeBin = "0x608060405234801561001057600080fd5b50610789806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063458b017a1461003b578063ecf888711461006d575b600080fd5b61005560048036038101906100509190610383565b61009d565b60405161006493929190610543565b60405180910390f35b61008760048036038101906100829190610347565b6100b8565b6040516100949190610483565b60405180910390f35b60008060006100ab846100cc565b9250925092509193909250565b60006100c48383610145565b905092915050565b60008060006041845114610115576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161010c90610503565b60405180910390fd5b60008060006020870151925060408701519150606087015160001a90508083839550955095505050509193909250565b60007f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0826040013560001c11156101b1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016101a890610523565b60405180910390fd5b601b8260000160208101906101c691906103c4565b60ff1614806101ea5750601c8260000160208101906101e591906103c4565b60ff16145b610229576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610220906104e3565b60405180910390fd5b60018383600001602081019061023f91906103c4565b8460200135856040013560405160008152602001604052604051610266949392919061049e565b6020604051602081039080840390855afa158015610288573d6000803e3d6000fd5b50505060206040510351905092915050565b60006102ad6102a88461059f565b61057a565b9050828152602081018484840111156102c557600080fd5b6102d084828561062a565b509392505050565b6000813590506102e781610725565b92915050565b600082601f8301126102fe57600080fd5b813561030e84826020860161029a565b91505092915050565b60006060828403121561032957600080fd5b81905092915050565b6000813590506103418161073c565b92915050565b6000806080838503121561035a57600080fd5b6000610368858286016102d8565b925050602061037985828601610317565b9150509250929050565b60006020828403121561039557600080fd5b600082013567ffffffffffffffff8111156103af57600080fd5b6103bb848285016102ed565b91505092915050565b6000602082840312156103d657600080fd5b60006103e484828501610332565b91505092915050565b6103f6816105e1565b82525050565b610405816105f3565b82525050565b6000610418601b836105d0565b9150610423826106aa565b602082019050919050565b600061043b6018836105d0565b9150610446826106d3565b602082019050919050565b600061045e601b836105d0565b9150610469826106fc565b602082019050919050565b61047d8161061d565b82525050565b600060208201905061049860008301846103ed565b92915050565b60006080820190506104b360008301876103fc565b6104c06020830186610474565b6104cd60408301856103fc565b6104da60608301846103fc565b95945050505050565b600060208201905081810360008301526104fc8161040b565b9050919050565b6000602082019050818103600083015261051c8161042e565b9050919050565b6000602082019050818103600083015261053c81610451565b9050919050565b60006060820190506105586000830186610474565b61056560208301856103fc565b61057260408301846103fc565b949350505050565b6000610584610595565b90506105908282610639565b919050565b6000604051905090565b600067ffffffffffffffff8211156105ba576105b961066a565b5b6105c382610699565b9050602081019050919050565b600082825260208201905092915050565b60006105ec826105fd565b9050919050565b6000819050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600060ff82169050919050565b82818337600083830152505050565b61064282610699565b810181811067ffffffffffffffff821117156106615761066061066a565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b7f696e76616c6964207369676e6174757265202276222076616c75650000000000600082015250565b7f696e76616c6964207369676e6174757265206c656e6774680000000000000000600082015250565b7f696e76616c6964207369676e6174757265202273222076616c75650000000000600082015250565b61072e816105f3565b811461073957600080fd5b50565b6107458161061d565b811461075057600080fd5b5056fea2646970667358221220e63deb792e476d2b8af6643e104292c4051f4dee40d035fb79165a90e45b2aa664736f6c63430008040033"

// DeploySigFake deploys a new Ethereum contract, binding an instance of SigFake to it.
func DeploySigFake(auth *bind.TransactOpts, backend bind.ContractBackend) (common.Address, *types.Transaction, *SigFake, error) {
	parsed, err := abi.JSON(strings.NewReader(SigFakeABI))
	if err != nil {
		return common.Address{}, nil, nil, err
	}

	address, tx, contract, err := bind.DeployContract(auth, parsed, common.FromHex(SigFakeBin), backend)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &SigFake{SigFakeCaller: SigFakeCaller{contract: contract}, SigFakeTransactor: SigFakeTransactor{contract: contract}, SigFakeFilterer: SigFakeFilterer{contract: contract}}, nil
}

// SigFake is an auto generated Go binding around an Ethereum contract.
type SigFake struct {
	SigFakeCaller     // Read-only binding to the contract
	SigFakeTransactor // Write-only binding to the contract
	SigFakeFilterer   // Log filterer for contract events
}

// SigFakeCaller is an auto generated read-only Go binding around an Ethereum contract.
type SigFakeCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// SigFakeTransactor is an auto generated write-only Go binding around an Ethereum contract.
type SigFakeTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// SigFakeFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type SigFakeFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// SigFakeSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type SigFakeSession struct {
	Contract     *SigFake          // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// SigFakeCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type SigFakeCallerSession struct {
	Contract *SigFakeCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts  // Call options to use throughout this session
}

// SigFakeTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type SigFakeTransactorSession struct {
	Contract     *SigFakeTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts  // Transaction auth options to use throughout this session
}

// SigFakeRaw is an auto generated low-level Go binding around an Ethereum contract.
type SigFakeRaw struct {
	Contract *SigFake // Generic contract binding to access the raw methods on
}

// SigFakeCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type SigFakeCallerRaw struct {
	Contract *SigFakeCaller // Generic read-only contract binding to access the raw methods on
}

// SigFakeTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type SigFakeTransactorRaw struct {
	Contract *SigFakeTransactor // Generic write-only contract binding to access the raw methods on
}

// NewSigFake creates a new instance of SigFake, bound to a specific deployed contract.
func NewSigFake(address common.Address, backend bind.ContractBackend) (*SigFake, error) {
	contract, err := bindSigFake(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &SigFake{SigFakeCaller: SigFakeCaller{contract: contract}, SigFakeTransactor: SigFakeTransactor{contract: contract}, SigFakeFilterer: SigFakeFilterer{contract: contract}}, nil
}

// NewSigFakeCaller creates a new read-only instance of SigFake, bound to a specific deployed contract.
func NewSigFakeCaller(address common.Address, caller bind.ContractCaller) (*SigFakeCaller, error) {
	contract, err := bindSigFake(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &SigFakeCaller{contract: contract}, nil
}

// NewSigFakeTransactor creates a new write-only instance of SigFake, bound to a specific deployed contract.
func NewSigFakeTransactor(address common.Address, transactor bind.ContractTransactor) (*SigFakeTransactor, error) {
	contract, err := bindSigFake(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &SigFakeTransactor{contract: contract}, nil
}

// NewSigFakeFilterer creates a new log filterer instance of SigFake, bound to a specific deployed contract.
func NewSigFakeFilterer(address common.Address, filterer bind.ContractFilterer) (*SigFakeFilterer, error) {
	contract, err := bindSigFake(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &SigFakeFilterer{contract: contract}, nil
}

// bindSigFake binds a generic wrapper to an already deployed contract.
func bindSigFake(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(SigFakeABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_SigFake *SigFakeRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _SigFake.Contract.SigFakeCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_SigFake *SigFakeRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SigFake.Contract.SigFakeTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_SigFake *SigFakeRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _SigFake.Contract.SigFakeTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_SigFake *SigFakeCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _SigFake.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_SigFake *SigFakeTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SigFake.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_SigFake *SigFakeTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _SigFake.Contract.contract.Transact(opts, method, params...)
}

// RecoverTest is a free data retrieval call binding the contract method 0xecf88871.
//
// Solidity: function recoverTest(bytes32 h, (uint8,bytes32,bytes32) c) pure returns(address)
func (_SigFake *SigFakeCaller) RecoverTest(opts *bind.CallOpts, h [32]byte, c SigComponents) (common.Address, error) {
	var out []interface{}
	err := _SigFake.contract.Call(opts, &out, "recoverTest", h, c)

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// RecoverTest is a free data retrieval call binding the contract method 0xecf88871.
//
// Solidity: function recoverTest(bytes32 h, (uint8,bytes32,bytes32) c) pure returns(address)
func (_SigFake *SigFakeSession) RecoverTest(h [32]byte, c SigComponents) (common.Address, error) {
	return _SigFake.Contract.RecoverTest(&_SigFake.CallOpts, h, c)
}

// RecoverTest is a free data retrieval call binding the contract method 0xecf88871.
//
// Solidity: function recoverTest(bytes32 h, (uint8,bytes32,bytes32) c) pure returns(address)
func (_SigFake *SigFakeCallerSession) RecoverTest(h [32]byte, c SigComponents) (common.Address, error) {
	return _SigFake.Contract.RecoverTest(&_SigFake.CallOpts, h, c)
}

// SplitTest is a free data retrieval call binding the contract method 0x458b017a.
//
// Solidity: function splitTest(bytes sig) pure returns(uint8 v, bytes32 r, bytes32 s)
func (_SigFake *SigFakeCaller) SplitTest(opts *bind.CallOpts, sig []byte) (struct {
	V uint8
	R [32]byte
	S [32]byte
}, error) {
	var out []interface{}
	err := _SigFake.contract.Call(opts, &out, "splitTest", sig)

	outstruct := new(struct {
		V uint8
		R [32]byte
		S [32]byte
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.V = out[0].(uint8)
	outstruct.R = out[1].([32]byte)
	outstruct.S = out[2].([32]byte)

	return *outstruct, err

}

// SplitTest is a free data retrieval call binding the contract method 0x458b017a.
//
// Solidity: function splitTest(bytes sig) pure returns(uint8 v, bytes32 r, bytes32 s)
func (_SigFake *SigFakeSession) SplitTest(sig []byte) (struct {
	V uint8
	R [32]byte
	S [32]byte
}, error) {
	return _SigFake.Contract.SplitTest(&_SigFake.CallOpts, sig)
}

// SplitTest is a free data retrieval call binding the contract method 0x458b017a.
//
// Solidity: function splitTest(bytes sig) pure returns(uint8 v, bytes32 r, bytes32 s)
func (_SigFake *SigFakeCallerSession) SplitTest(sig []byte) (struct {
	V uint8
	R [32]byte
	S [32]byte
}, error) {
	return _SigFake.Contract.SplitTest(&_SigFake.CallOpts, sig)
}
