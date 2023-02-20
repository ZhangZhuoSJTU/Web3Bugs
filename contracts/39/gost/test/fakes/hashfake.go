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

// HashOrder is an auto generated low-level Go binding around an user-defined struct.
type HashOrder struct {
	Key        [32]byte
	Maker      common.Address
	Underlying common.Address
	Vault      bool
	Exit       bool
	Principal  *big.Int
	Premium    *big.Int
	Maturity   *big.Int
	Expiry     *big.Int
}

// HashFakeABI is the input ABI used to generate the binding from.
const HashFakeABI = "[{\"inputs\":[{\"internalType\":\"string\",\"name\":\"n\",\"type\":\"string\"},{\"internalType\":\"string\",\"name\":\"version\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"c\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"verifier\",\"type\":\"address\"}],\"name\":\"domainTest\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"domainTypeHash\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"d\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"h\",\"type\":\"bytes32\"}],\"name\":\"messageTest\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[{\"components\":[{\"internalType\":\"bytes32\",\"name\":\"key\",\"type\":\"bytes32\"},{\"internalType\":\"address\",\"name\":\"maker\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"underlying\",\"type\":\"address\"},{\"internalType\":\"bool\",\"name\":\"vault\",\"type\":\"bool\"},{\"internalType\":\"bool\",\"name\":\"exit\",\"type\":\"bool\"},{\"internalType\":\"uint256\",\"name\":\"principal\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"premium\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maturity\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"expiry\",\"type\":\"uint256\"}],\"internalType\":\"structHash.Order\",\"name\":\"o\",\"type\":\"tuple\"}],\"name\":\"orderTest\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"orderTypeHash\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"permitTypeHash\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"}]"

// HashFakeBin is the compiled bytecode used for deploying new contracts.
var HashFakeBin = "0x608060405234801561001057600080fd5b50611008806100206000396000f3fe608060405234801561001057600080fd5b50600436106100625760003560e01c806310ce43bd146100675780634c05b2a11461008557806391c2600f146100b557806397995ecb146100d3578063af1ef90b146100f1578063e2711de414610121575b600080fd5b61006f610151565b60405161007c9190610a06565b60405180910390f35b61009f600480360381019061009a91906104a9565b61017d565b6040516100ac9190610a06565b60405180910390f35b6100bd610191565b6040516100ca9190610a06565b60405180910390f35b6100db6101bd565b6040516100e89190610a06565b60405180910390f35b61010b600480360381019061010691906104e5565b6101e9565b6040516101189190610a06565b60405180910390f35b61013b60048036038101906101369190610578565b610201565b6040516101489190610a06565b60405180910390f35b600060405160200161016290610963565b60405160208183030381529060405280519060200120905090565b60006101898383610213565b905092915050565b60006040516020016101a2906108e0565b60405160208183030381529060405280519060200120905090565b60006040516020016101ce906109ba565b60405160208183030381529060405280519060200120905090565b60006101f785858585610259565b9050949350505050565b600061020c826102bd565b9050919050565b6000806040517f19010000000000000000000000000000000000000000000000000000000000008152846002820152836022820152604281209150508091505092915050565b60008085516020870120855160208701206040517f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f815282602082015281604082015286606082015285608082015260a08120935050505080915050949350505050565b60007f7ddd38ab5ed1c16b61ca90eeb9579e29da1ba821cf42d8cdef8f30a31a6a414660001b82600001358360200160208101906102fb9190610457565b84604001602081019061030e9190610457565b8560600160208101906103219190610480565b8660800160208101906103349190610480565b8760a001358860c001358960e001358a61010001356040516020016103629a99989796959493929190610a21565b604051602081830303815290604052805190602001209050919050565b600061039261038d84610ae2565b610abd565b9050828152602081018484840111156103aa57600080fd5b6103b5848285610b70565b509392505050565b6000813590506103cc81610f76565b92915050565b6000813590506103e181610f8d565b92915050565b6000813590506103f681610fa4565b92915050565b600082601f83011261040d57600080fd5b813561041d84826020860161037f565b91505092915050565b6000610120828403121561043957600080fd5b81905092915050565b60008135905061045181610fbb565b92915050565b60006020828403121561046957600080fd5b6000610477848285016103bd565b91505092915050565b60006020828403121561049257600080fd5b60006104a0848285016103d2565b91505092915050565b600080604083850312156104bc57600080fd5b60006104ca858286016103e7565b92505060206104db858286016103e7565b9150509250929050565b600080600080608085870312156104fb57600080fd5b600085013567ffffffffffffffff81111561051557600080fd5b610521878288016103fc565b945050602085013567ffffffffffffffff81111561053e57600080fd5b61054a878288016103fc565b935050604061055b87828801610442565b925050606061056c878288016103bd565b91505092959194509250565b6000610120828403121561058b57600080fd5b600061059984828501610426565b91505092915050565b6105ab81610b1e565b82525050565b6105ba81610b30565b82525050565b6105c981610b3c565b82525050565b60006105dc600c83610b13565b91506105e782610bf0565b600c82019050919050565b60006105ff600c83610b13565b915061060a82610c19565b600c82019050919050565b6000610622600e83610b13565b915061062d82610c42565b600e82019050919050565b6000610645600683610b13565b915061065082610c6b565b600682019050919050565b6000610668601083610b13565b915061067382610c94565b601082019050919050565b600061068b601383610b13565b915061069682610cbd565b601382019050919050565b60006106ae601983610b13565b91506106b982610ce6565b601982019050919050565b60006106d1601183610b13565b91506106dc82610d0f565b601182019050919050565b60006106f4601083610b13565b91506106ff82610d38565b601082019050919050565b6000610717601183610b13565b915061072282610d61565b601182019050919050565b600061073a600e83610b13565b915061074582610d8a565b600e82019050919050565b600061075d600183610b13565b915061076882610db3565b600182019050919050565b6000610780600f83610b13565b915061078b82610ddc565b600f82019050919050565b60006107a3601083610b13565b91506107ae82610e05565b601082019050919050565b60006107c6600783610b13565b91506107d182610e2e565b600782019050919050565b60006107e9600e83610b13565b91506107f482610e57565b600e82019050919050565b600061080c600e83610b13565b915061081782610e80565b600e82019050919050565b600061082f600b83610b13565b915061083a82610ea9565b600b82019050919050565b6000610852601283610b13565b915061085d82610ed2565b601282019050919050565b6000610875600a83610b13565b915061088082610efb565b600a82019050919050565b6000610898600e83610b13565b91506108a382610f24565b600e82019050919050565b60006108bb600d83610b13565b91506108c682610f4d565b600d82019050919050565b6108da81610b66565b82525050565b60006108eb82610638565b91506108f6826105f2565b9150610901826107ff565b915061090c8261067e565b915061091782610822565b915061092282610868565b915061092d82610845565b91506109388261065b565b9150610943826106c4565b915061094e8261072d565b915061095982610750565b9150819050919050565b600061096e826107b9565b9150610979826107dc565b915061098482610796565b915061098f8261088b565b915061099a82610615565b91506109a58261070a565b91506109b082610750565b9150819050919050565b60006109c5826108ae565b91506109d0826105cf565b91506109db82610773565b91506109e6826106e7565b91506109f1826106a1565b91506109fc82610750565b9150819050919050565b6000602082019050610a1b60008301846105c0565b92915050565b600061014082019050610a37600083018d6105c0565b610a44602083018c6105c0565b610a51604083018b6105a2565b610a5e606083018a6105a2565b610a6b60808301896105b1565b610a7860a08301886105b1565b610a8560c08301876108d1565b610a9260e08301866108d1565b610aa06101008301856108d1565b610aae6101208301846108d1565b9b9a5050505050505050505050565b6000610ac7610ad8565b9050610ad38282610b7f565b919050565b6000604051905090565b600067ffffffffffffffff821115610afd57610afc610bb0565b5b610b0682610bdf565b9050602081019050919050565b600081905092915050565b6000610b2982610b46565b9050919050565b60008115159050919050565b6000819050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b82818337600083830152505050565b610b8882610bdf565b810181811067ffffffffffffffff82111715610ba757610ba6610bb0565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b7f737472696e67206e616d652c0000000000000000000000000000000000000000600082015250565b7f62797465733332206b65792c0000000000000000000000000000000000000000600082015250565b7f75696e74323536206e6f6e63652c000000000000000000000000000000000000600082015250565b7f4f72646572280000000000000000000000000000000000000000000000000000600082015250565b7f75696e74323536207072656d69756d2c00000000000000000000000000000000600082015250565b7f6164647265737320756e6465726c79696e672c00000000000000000000000000600082015250565b7f6164647265737320766572696679696e67436f6e747261637400000000000000600082015250565b7f75696e74323536206d617475726974792c000000000000000000000000000000600082015250565b7f75696e7432353620636861696e49642c00000000000000000000000000000000600082015250565b7f75696e7432353620646561646c696e652c000000000000000000000000000000600082015250565b7f75696e7432353620657870697279000000000000000000000000000000000000600082015250565b7f2900000000000000000000000000000000000000000000000000000000000000600082015250565b7f737472696e672076657273696f6e2c0000000000000000000000000000000000600082015250565b7f61646472657373207370656e6465722c00000000000000000000000000000000600082015250565b7f5065726d69742800000000000000000000000000000000000000000000000000600082015250565b7f61646472657373206f776e65722c000000000000000000000000000000000000600082015250565b7f61646472657373206d616b65722c000000000000000000000000000000000000600082015250565b7f626f6f6c207661756c742c000000000000000000000000000000000000000000600082015250565b7f75696e74323536207072696e636970616c2c0000000000000000000000000000600082015250565b7f626f6f6c20657869742c00000000000000000000000000000000000000000000600082015250565b7f75696e743235362076616c75652c000000000000000000000000000000000000600082015250565b7f454950373132446f6d61696e2800000000000000000000000000000000000000600082015250565b610f7f81610b1e565b8114610f8a57600080fd5b50565b610f9681610b30565b8114610fa157600080fd5b50565b610fad81610b3c565b8114610fb857600080fd5b50565b610fc481610b66565b8114610fcf57600080fd5b5056fea264697066735822122058fb74935accb8eaea7bf389dce878ecfc8be1490b20b6d10307988c0bb533ca64736f6c63430008040033"

// DeployHashFake deploys a new Ethereum contract, binding an instance of HashFake to it.
func DeployHashFake(auth *bind.TransactOpts, backend bind.ContractBackend) (common.Address, *types.Transaction, *HashFake, error) {
	parsed, err := abi.JSON(strings.NewReader(HashFakeABI))
	if err != nil {
		return common.Address{}, nil, nil, err
	}

	address, tx, contract, err := bind.DeployContract(auth, parsed, common.FromHex(HashFakeBin), backend)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &HashFake{HashFakeCaller: HashFakeCaller{contract: contract}, HashFakeTransactor: HashFakeTransactor{contract: contract}, HashFakeFilterer: HashFakeFilterer{contract: contract}}, nil
}

// HashFake is an auto generated Go binding around an Ethereum contract.
type HashFake struct {
	HashFakeCaller     // Read-only binding to the contract
	HashFakeTransactor // Write-only binding to the contract
	HashFakeFilterer   // Log filterer for contract events
}

// HashFakeCaller is an auto generated read-only Go binding around an Ethereum contract.
type HashFakeCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// HashFakeTransactor is an auto generated write-only Go binding around an Ethereum contract.
type HashFakeTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// HashFakeFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type HashFakeFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// HashFakeSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type HashFakeSession struct {
	Contract     *HashFake         // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// HashFakeCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type HashFakeCallerSession struct {
	Contract *HashFakeCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts   // Call options to use throughout this session
}

// HashFakeTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type HashFakeTransactorSession struct {
	Contract     *HashFakeTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts   // Transaction auth options to use throughout this session
}

// HashFakeRaw is an auto generated low-level Go binding around an Ethereum contract.
type HashFakeRaw struct {
	Contract *HashFake // Generic contract binding to access the raw methods on
}

// HashFakeCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type HashFakeCallerRaw struct {
	Contract *HashFakeCaller // Generic read-only contract binding to access the raw methods on
}

// HashFakeTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type HashFakeTransactorRaw struct {
	Contract *HashFakeTransactor // Generic write-only contract binding to access the raw methods on
}

// NewHashFake creates a new instance of HashFake, bound to a specific deployed contract.
func NewHashFake(address common.Address, backend bind.ContractBackend) (*HashFake, error) {
	contract, err := bindHashFake(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &HashFake{HashFakeCaller: HashFakeCaller{contract: contract}, HashFakeTransactor: HashFakeTransactor{contract: contract}, HashFakeFilterer: HashFakeFilterer{contract: contract}}, nil
}

// NewHashFakeCaller creates a new read-only instance of HashFake, bound to a specific deployed contract.
func NewHashFakeCaller(address common.Address, caller bind.ContractCaller) (*HashFakeCaller, error) {
	contract, err := bindHashFake(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &HashFakeCaller{contract: contract}, nil
}

// NewHashFakeTransactor creates a new write-only instance of HashFake, bound to a specific deployed contract.
func NewHashFakeTransactor(address common.Address, transactor bind.ContractTransactor) (*HashFakeTransactor, error) {
	contract, err := bindHashFake(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &HashFakeTransactor{contract: contract}, nil
}

// NewHashFakeFilterer creates a new log filterer instance of HashFake, bound to a specific deployed contract.
func NewHashFakeFilterer(address common.Address, filterer bind.ContractFilterer) (*HashFakeFilterer, error) {
	contract, err := bindHashFake(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &HashFakeFilterer{contract: contract}, nil
}

// bindHashFake binds a generic wrapper to an already deployed contract.
func bindHashFake(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(HashFakeABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_HashFake *HashFakeRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _HashFake.Contract.HashFakeCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_HashFake *HashFakeRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _HashFake.Contract.HashFakeTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_HashFake *HashFakeRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _HashFake.Contract.HashFakeTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_HashFake *HashFakeCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _HashFake.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_HashFake *HashFakeTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _HashFake.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_HashFake *HashFakeTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _HashFake.Contract.contract.Transact(opts, method, params...)
}

// DomainTest is a free data retrieval call binding the contract method 0xaf1ef90b.
//
// Solidity: function domainTest(string n, string version, uint256 c, address verifier) pure returns(bytes32)
func (_HashFake *HashFakeCaller) DomainTest(opts *bind.CallOpts, n string, version string, c *big.Int, verifier common.Address) ([32]byte, error) {
	var out []interface{}
	err := _HashFake.contract.Call(opts, &out, "domainTest", n, version, c, verifier)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// DomainTest is a free data retrieval call binding the contract method 0xaf1ef90b.
//
// Solidity: function domainTest(string n, string version, uint256 c, address verifier) pure returns(bytes32)
func (_HashFake *HashFakeSession) DomainTest(n string, version string, c *big.Int, verifier common.Address) ([32]byte, error) {
	return _HashFake.Contract.DomainTest(&_HashFake.CallOpts, n, version, c, verifier)
}

// DomainTest is a free data retrieval call binding the contract method 0xaf1ef90b.
//
// Solidity: function domainTest(string n, string version, uint256 c, address verifier) pure returns(bytes32)
func (_HashFake *HashFakeCallerSession) DomainTest(n string, version string, c *big.Int, verifier common.Address) ([32]byte, error) {
	return _HashFake.Contract.DomainTest(&_HashFake.CallOpts, n, version, c, verifier)
}

// DomainTypeHash is a free data retrieval call binding the contract method 0x97995ecb.
//
// Solidity: function domainTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeCaller) DomainTypeHash(opts *bind.CallOpts) ([32]byte, error) {
	var out []interface{}
	err := _HashFake.contract.Call(opts, &out, "domainTypeHash")

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// DomainTypeHash is a free data retrieval call binding the contract method 0x97995ecb.
//
// Solidity: function domainTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeSession) DomainTypeHash() ([32]byte, error) {
	return _HashFake.Contract.DomainTypeHash(&_HashFake.CallOpts)
}

// DomainTypeHash is a free data retrieval call binding the contract method 0x97995ecb.
//
// Solidity: function domainTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeCallerSession) DomainTypeHash() ([32]byte, error) {
	return _HashFake.Contract.DomainTypeHash(&_HashFake.CallOpts)
}

// MessageTest is a free data retrieval call binding the contract method 0x4c05b2a1.
//
// Solidity: function messageTest(bytes32 d, bytes32 h) pure returns(bytes32)
func (_HashFake *HashFakeCaller) MessageTest(opts *bind.CallOpts, d [32]byte, h [32]byte) ([32]byte, error) {
	var out []interface{}
	err := _HashFake.contract.Call(opts, &out, "messageTest", d, h)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// MessageTest is a free data retrieval call binding the contract method 0x4c05b2a1.
//
// Solidity: function messageTest(bytes32 d, bytes32 h) pure returns(bytes32)
func (_HashFake *HashFakeSession) MessageTest(d [32]byte, h [32]byte) ([32]byte, error) {
	return _HashFake.Contract.MessageTest(&_HashFake.CallOpts, d, h)
}

// MessageTest is a free data retrieval call binding the contract method 0x4c05b2a1.
//
// Solidity: function messageTest(bytes32 d, bytes32 h) pure returns(bytes32)
func (_HashFake *HashFakeCallerSession) MessageTest(d [32]byte, h [32]byte) ([32]byte, error) {
	return _HashFake.Contract.MessageTest(&_HashFake.CallOpts, d, h)
}

// OrderTest is a free data retrieval call binding the contract method 0xe2711de4.
//
// Solidity: function orderTest((bytes32,address,address,bool,bool,uint256,uint256,uint256,uint256) o) pure returns(bytes32)
func (_HashFake *HashFakeCaller) OrderTest(opts *bind.CallOpts, o HashOrder) ([32]byte, error) {
	var out []interface{}
	err := _HashFake.contract.Call(opts, &out, "orderTest", o)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// OrderTest is a free data retrieval call binding the contract method 0xe2711de4.
//
// Solidity: function orderTest((bytes32,address,address,bool,bool,uint256,uint256,uint256,uint256) o) pure returns(bytes32)
func (_HashFake *HashFakeSession) OrderTest(o HashOrder) ([32]byte, error) {
	return _HashFake.Contract.OrderTest(&_HashFake.CallOpts, o)
}

// OrderTest is a free data retrieval call binding the contract method 0xe2711de4.
//
// Solidity: function orderTest((bytes32,address,address,bool,bool,uint256,uint256,uint256,uint256) o) pure returns(bytes32)
func (_HashFake *HashFakeCallerSession) OrderTest(o HashOrder) ([32]byte, error) {
	return _HashFake.Contract.OrderTest(&_HashFake.CallOpts, o)
}

// OrderTypeHash is a free data retrieval call binding the contract method 0x91c2600f.
//
// Solidity: function orderTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeCaller) OrderTypeHash(opts *bind.CallOpts) ([32]byte, error) {
	var out []interface{}
	err := _HashFake.contract.Call(opts, &out, "orderTypeHash")

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// OrderTypeHash is a free data retrieval call binding the contract method 0x91c2600f.
//
// Solidity: function orderTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeSession) OrderTypeHash() ([32]byte, error) {
	return _HashFake.Contract.OrderTypeHash(&_HashFake.CallOpts)
}

// OrderTypeHash is a free data retrieval call binding the contract method 0x91c2600f.
//
// Solidity: function orderTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeCallerSession) OrderTypeHash() ([32]byte, error) {
	return _HashFake.Contract.OrderTypeHash(&_HashFake.CallOpts)
}

// PermitTypeHash is a free data retrieval call binding the contract method 0x10ce43bd.
//
// Solidity: function permitTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeCaller) PermitTypeHash(opts *bind.CallOpts) ([32]byte, error) {
	var out []interface{}
	err := _HashFake.contract.Call(opts, &out, "permitTypeHash")

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// PermitTypeHash is a free data retrieval call binding the contract method 0x10ce43bd.
//
// Solidity: function permitTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeSession) PermitTypeHash() ([32]byte, error) {
	return _HashFake.Contract.PermitTypeHash(&_HashFake.CallOpts)
}

// PermitTypeHash is a free data retrieval call binding the contract method 0x10ce43bd.
//
// Solidity: function permitTypeHash() pure returns(bytes32)
func (_HashFake *HashFakeCallerSession) PermitTypeHash() ([32]byte, error) {
	return _HashFake.Contract.PermitTypeHash(&_HashFake.CallOpts)
}
