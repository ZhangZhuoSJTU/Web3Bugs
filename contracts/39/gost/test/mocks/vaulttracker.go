// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package mocks

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

// VaultTrackerABI is the input ABI used to generate the binding from.
const VaultTrackerABI = "[{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"m\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"c\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"s\",\"type\":\"address\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"o\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"a\",\"type\":\"uint256\"}],\"name\":\"addNotional\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"name\":\"addNotionalCalled\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bool\",\"name\":\"b\",\"type\":\"bool\"}],\"name\":\"addNotionalReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"cTokenAddr\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"matureVault\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bool\",\"name\":\"b\",\"type\":\"bool\"}],\"name\":\"matureVaultReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"maturity\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"maturityReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"o\",\"type\":\"address\"}],\"name\":\"redeemInterest\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"redeemInterestCalled\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"a\",\"type\":\"uint256\"}],\"name\":\"redeemInterestReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"o\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"a\",\"type\":\"uint256\"}],\"name\":\"removeNotional\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"name\":\"removeNotionalCalled\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bool\",\"name\":\"b\",\"type\":\"bool\"}],\"name\":\"removeNotionalReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"swivel\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"f\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"a\",\"type\":\"uint256\"}],\"name\":\"transferNotionalFee\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"name\":\"transferNotionalFeeCalled\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bool\",\"name\":\"b\",\"type\":\"bool\"}],\"name\":\"transferNotionalFeeReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"f\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"t\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"a\",\"type\":\"uint256\"}],\"name\":\"transferNotionalFrom\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"name\":\"transferNotionalFromCalled\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bool\",\"name\":\"b\",\"type\":\"bool\"}],\"name\":\"transferNotionalFromReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]"

// VaultTrackerBin is the compiled bytecode used for deploying new contracts.
var VaultTrackerBin = "0x608060405234801561001057600080fd5b5060405161082238038061082283398101604081905261002f91610082565b600792909255600480546001600160a01b039283166001600160a01b031991821617909155600580549290931691161790556100bd565b80516001600160a01b038116811461007d57600080fd5b919050565b600080600060608486031215610096578283fd5b835192506100a660208501610066565b91506100b460408501610066565b90509250925092565b610756806100cc6000396000f3fe608060405234801561001057600080fd5b50600436106101775760003560e01c806382cac89c116100d8578063b7dd34831161008c578063d6cb2c0d11610066578063d6cb2c0d1461057c578063da3de9e91461058f578063e590c362146105ce57600080fd5b8063b7dd3483146104f5578063bbce238614610515578063d0b9d0321461053557600080fd5b8063a701da69116100bd578063a701da6914610453578063b326258d1461049b578063b4c4a4c8146104e257600080fd5b806382cac89c146103ef578063a01cfffb1461040f57600080fd5b80633dfa1f411161012f5780635dfe12ac116101145780635dfe12ac14610359578063613a28d11461039f5780636b868d51146103e457600080fd5b80633dfa1f41146102f25780635c70b7c11461031257600080fd5b8063177946731161016057806317794673146101f457806319caf46c14610291578063204f83f9146102ea57600080fd5b8063012b264a1461017c5780630aa93b9b146101c6575b600080fd5b60055461019c9073ffffffffffffffffffffffffffffffffffffffff1681565b60405173ffffffffffffffffffffffffffffffffffffffff90911681526020015b60405180910390f35b6101e66101d4366004610663565b60016020526000908152604090205481565b6040519081526020016101bd565b610281610202366004610684565b60408051808201825273ffffffffffffffffffffffffffffffffffffffff93841681526020808201938452948416600090815260029095529320925183547fffffffffffffffffffffffff0000000000000000000000000000000000000000169216919091178255516001909101556009546301000000900460ff1690565b60405190151581526020016101bd565b6101e661029f366004610663565b600680547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff9290921691909117905560085490565b6007546101e6565b6101e6610300366004610663565b60006020819052908152604090205481565b6103576103203660046106e8565b60098054911515610100027fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00ff909216919091179055565b005b6103576103673660046106e8565b6009805491151562010000027fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00ffff909216919091179055565b6102816103ad3660046106bf565b73ffffffffffffffffffffffffffffffffffffffff9190911660009081526001602052604090205560095462010000900460ff1690565b60095460ff16610281565b60065461019c9073ffffffffffffffffffffffffffffffffffffffff1681565b61028161041d3660046106bf565b73ffffffffffffffffffffffffffffffffffffffff91909116600090815260208190526040902055600954610100900460ff1690565b6103576104613660046106e8565b60098054911515640100000000027fffffffffffffffffffffffffffffffffffffffffffffffffffffff00ffffffff909216919091179055565b6102816104a93660046106bf565b73ffffffffffffffffffffffffffffffffffffffff91909116600090815260036020526040902055600954640100000000900460ff1690565b6103576104f0366004610708565b600755565b60045461019c9073ffffffffffffffffffffffffffffffffffffffff1681565b6101e6610523366004610663565b60036020526000908152604090205481565b6103576105433660046106e8565b600980549115156301000000027fffffffffffffffffffffffffffffffffffffffffffffffffffffffff00ffffff909216919091179055565b61035761058a366004610708565b600855565b61035761059d3660046106e8565b600980547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0016911515919091179055565b61060e6105dc366004610663565b6002602052600090815260409020805460019091015473ffffffffffffffffffffffffffffffffffffffff9091169082565b6040805173ffffffffffffffffffffffffffffffffffffffff90931683526020830191909152016101bd565b803573ffffffffffffffffffffffffffffffffffffffff8116811461065e57600080fd5b919050565b600060208284031215610674578081fd5b61067d8261063a565b9392505050565b600080600060608486031215610698578182fd5b6106a18461063a565b92506106af6020850161063a565b9150604084013590509250925092565b600080604083850312156106d1578182fd5b6106da8361063a565b946020939093013593505050565b6000602082840312156106f9578081fd5b8135801515811461067d578182fd5b600060208284031215610719578081fd5b503591905056fea26469706673582212202ce12b1980bd5f82baa5e2ebd47a5978b9f4251b48a4b88ed7b08f2685a21f8e64736f6c63430008040033"

// DeployVaultTracker deploys a new Ethereum contract, binding an instance of VaultTracker to it.
func DeployVaultTracker(auth *bind.TransactOpts, backend bind.ContractBackend, m *big.Int, c common.Address, s common.Address) (common.Address, *types.Transaction, *VaultTracker, error) {
	parsed, err := abi.JSON(strings.NewReader(VaultTrackerABI))
	if err != nil {
		return common.Address{}, nil, nil, err
	}

	address, tx, contract, err := bind.DeployContract(auth, parsed, common.FromHex(VaultTrackerBin), backend, m, c, s)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &VaultTracker{VaultTrackerCaller: VaultTrackerCaller{contract: contract}, VaultTrackerTransactor: VaultTrackerTransactor{contract: contract}, VaultTrackerFilterer: VaultTrackerFilterer{contract: contract}}, nil
}

// VaultTracker is an auto generated Go binding around an Ethereum contract.
type VaultTracker struct {
	VaultTrackerCaller     // Read-only binding to the contract
	VaultTrackerTransactor // Write-only binding to the contract
	VaultTrackerFilterer   // Log filterer for contract events
}

// VaultTrackerCaller is an auto generated read-only Go binding around an Ethereum contract.
type VaultTrackerCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// VaultTrackerTransactor is an auto generated write-only Go binding around an Ethereum contract.
type VaultTrackerTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// VaultTrackerFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type VaultTrackerFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// VaultTrackerSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type VaultTrackerSession struct {
	Contract     *VaultTracker     // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// VaultTrackerCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type VaultTrackerCallerSession struct {
	Contract *VaultTrackerCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts       // Call options to use throughout this session
}

// VaultTrackerTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type VaultTrackerTransactorSession struct {
	Contract     *VaultTrackerTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts       // Transaction auth options to use throughout this session
}

// VaultTrackerRaw is an auto generated low-level Go binding around an Ethereum contract.
type VaultTrackerRaw struct {
	Contract *VaultTracker // Generic contract binding to access the raw methods on
}

// VaultTrackerCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type VaultTrackerCallerRaw struct {
	Contract *VaultTrackerCaller // Generic read-only contract binding to access the raw methods on
}

// VaultTrackerTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type VaultTrackerTransactorRaw struct {
	Contract *VaultTrackerTransactor // Generic write-only contract binding to access the raw methods on
}

// NewVaultTracker creates a new instance of VaultTracker, bound to a specific deployed contract.
func NewVaultTracker(address common.Address, backend bind.ContractBackend) (*VaultTracker, error) {
	contract, err := bindVaultTracker(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &VaultTracker{VaultTrackerCaller: VaultTrackerCaller{contract: contract}, VaultTrackerTransactor: VaultTrackerTransactor{contract: contract}, VaultTrackerFilterer: VaultTrackerFilterer{contract: contract}}, nil
}

// NewVaultTrackerCaller creates a new read-only instance of VaultTracker, bound to a specific deployed contract.
func NewVaultTrackerCaller(address common.Address, caller bind.ContractCaller) (*VaultTrackerCaller, error) {
	contract, err := bindVaultTracker(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &VaultTrackerCaller{contract: contract}, nil
}

// NewVaultTrackerTransactor creates a new write-only instance of VaultTracker, bound to a specific deployed contract.
func NewVaultTrackerTransactor(address common.Address, transactor bind.ContractTransactor) (*VaultTrackerTransactor, error) {
	contract, err := bindVaultTracker(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &VaultTrackerTransactor{contract: contract}, nil
}

// NewVaultTrackerFilterer creates a new log filterer instance of VaultTracker, bound to a specific deployed contract.
func NewVaultTrackerFilterer(address common.Address, filterer bind.ContractFilterer) (*VaultTrackerFilterer, error) {
	contract, err := bindVaultTracker(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &VaultTrackerFilterer{contract: contract}, nil
}

// bindVaultTracker binds a generic wrapper to an already deployed contract.
func bindVaultTracker(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(VaultTrackerABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_VaultTracker *VaultTrackerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _VaultTracker.Contract.VaultTrackerCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_VaultTracker *VaultTrackerRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _VaultTracker.Contract.VaultTrackerTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_VaultTracker *VaultTrackerRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _VaultTracker.Contract.VaultTrackerTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_VaultTracker *VaultTrackerCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _VaultTracker.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_VaultTracker *VaultTrackerTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _VaultTracker.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_VaultTracker *VaultTrackerTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _VaultTracker.Contract.contract.Transact(opts, method, params...)
}

// AddNotionalCalled is a free data retrieval call binding the contract method 0x3dfa1f41.
//
// Solidity: function addNotionalCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerCaller) AddNotionalCalled(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "addNotionalCalled", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// AddNotionalCalled is a free data retrieval call binding the contract method 0x3dfa1f41.
//
// Solidity: function addNotionalCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerSession) AddNotionalCalled(arg0 common.Address) (*big.Int, error) {
	return _VaultTracker.Contract.AddNotionalCalled(&_VaultTracker.CallOpts, arg0)
}

// AddNotionalCalled is a free data retrieval call binding the contract method 0x3dfa1f41.
//
// Solidity: function addNotionalCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerCallerSession) AddNotionalCalled(arg0 common.Address) (*big.Int, error) {
	return _VaultTracker.Contract.AddNotionalCalled(&_VaultTracker.CallOpts, arg0)
}

// CTokenAddr is a free data retrieval call binding the contract method 0xb7dd3483.
//
// Solidity: function cTokenAddr() view returns(address)
func (_VaultTracker *VaultTrackerCaller) CTokenAddr(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "cTokenAddr")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// CTokenAddr is a free data retrieval call binding the contract method 0xb7dd3483.
//
// Solidity: function cTokenAddr() view returns(address)
func (_VaultTracker *VaultTrackerSession) CTokenAddr() (common.Address, error) {
	return _VaultTracker.Contract.CTokenAddr(&_VaultTracker.CallOpts)
}

// CTokenAddr is a free data retrieval call binding the contract method 0xb7dd3483.
//
// Solidity: function cTokenAddr() view returns(address)
func (_VaultTracker *VaultTrackerCallerSession) CTokenAddr() (common.Address, error) {
	return _VaultTracker.Contract.CTokenAddr(&_VaultTracker.CallOpts)
}

// MatureVault is a free data retrieval call binding the contract method 0x6b868d51.
//
// Solidity: function matureVault() view returns(bool)
func (_VaultTracker *VaultTrackerCaller) MatureVault(opts *bind.CallOpts) (bool, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "matureVault")

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// MatureVault is a free data retrieval call binding the contract method 0x6b868d51.
//
// Solidity: function matureVault() view returns(bool)
func (_VaultTracker *VaultTrackerSession) MatureVault() (bool, error) {
	return _VaultTracker.Contract.MatureVault(&_VaultTracker.CallOpts)
}

// MatureVault is a free data retrieval call binding the contract method 0x6b868d51.
//
// Solidity: function matureVault() view returns(bool)
func (_VaultTracker *VaultTrackerCallerSession) MatureVault() (bool, error) {
	return _VaultTracker.Contract.MatureVault(&_VaultTracker.CallOpts)
}

// Maturity is a free data retrieval call binding the contract method 0x204f83f9.
//
// Solidity: function maturity() view returns(uint256)
func (_VaultTracker *VaultTrackerCaller) Maturity(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "maturity")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Maturity is a free data retrieval call binding the contract method 0x204f83f9.
//
// Solidity: function maturity() view returns(uint256)
func (_VaultTracker *VaultTrackerSession) Maturity() (*big.Int, error) {
	return _VaultTracker.Contract.Maturity(&_VaultTracker.CallOpts)
}

// Maturity is a free data retrieval call binding the contract method 0x204f83f9.
//
// Solidity: function maturity() view returns(uint256)
func (_VaultTracker *VaultTrackerCallerSession) Maturity() (*big.Int, error) {
	return _VaultTracker.Contract.Maturity(&_VaultTracker.CallOpts)
}

// RedeemInterestCalled is a free data retrieval call binding the contract method 0x82cac89c.
//
// Solidity: function redeemInterestCalled() view returns(address)
func (_VaultTracker *VaultTrackerCaller) RedeemInterestCalled(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "redeemInterestCalled")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// RedeemInterestCalled is a free data retrieval call binding the contract method 0x82cac89c.
//
// Solidity: function redeemInterestCalled() view returns(address)
func (_VaultTracker *VaultTrackerSession) RedeemInterestCalled() (common.Address, error) {
	return _VaultTracker.Contract.RedeemInterestCalled(&_VaultTracker.CallOpts)
}

// RedeemInterestCalled is a free data retrieval call binding the contract method 0x82cac89c.
//
// Solidity: function redeemInterestCalled() view returns(address)
func (_VaultTracker *VaultTrackerCallerSession) RedeemInterestCalled() (common.Address, error) {
	return _VaultTracker.Contract.RedeemInterestCalled(&_VaultTracker.CallOpts)
}

// RemoveNotionalCalled is a free data retrieval call binding the contract method 0x0aa93b9b.
//
// Solidity: function removeNotionalCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerCaller) RemoveNotionalCalled(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "removeNotionalCalled", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// RemoveNotionalCalled is a free data retrieval call binding the contract method 0x0aa93b9b.
//
// Solidity: function removeNotionalCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerSession) RemoveNotionalCalled(arg0 common.Address) (*big.Int, error) {
	return _VaultTracker.Contract.RemoveNotionalCalled(&_VaultTracker.CallOpts, arg0)
}

// RemoveNotionalCalled is a free data retrieval call binding the contract method 0x0aa93b9b.
//
// Solidity: function removeNotionalCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerCallerSession) RemoveNotionalCalled(arg0 common.Address) (*big.Int, error) {
	return _VaultTracker.Contract.RemoveNotionalCalled(&_VaultTracker.CallOpts, arg0)
}

// Swivel is a free data retrieval call binding the contract method 0x012b264a.
//
// Solidity: function swivel() view returns(address)
func (_VaultTracker *VaultTrackerCaller) Swivel(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "swivel")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Swivel is a free data retrieval call binding the contract method 0x012b264a.
//
// Solidity: function swivel() view returns(address)
func (_VaultTracker *VaultTrackerSession) Swivel() (common.Address, error) {
	return _VaultTracker.Contract.Swivel(&_VaultTracker.CallOpts)
}

// Swivel is a free data retrieval call binding the contract method 0x012b264a.
//
// Solidity: function swivel() view returns(address)
func (_VaultTracker *VaultTrackerCallerSession) Swivel() (common.Address, error) {
	return _VaultTracker.Contract.Swivel(&_VaultTracker.CallOpts)
}

// TransferNotionalFeeCalled is a free data retrieval call binding the contract method 0xbbce2386.
//
// Solidity: function transferNotionalFeeCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerCaller) TransferNotionalFeeCalled(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "transferNotionalFeeCalled", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TransferNotionalFeeCalled is a free data retrieval call binding the contract method 0xbbce2386.
//
// Solidity: function transferNotionalFeeCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerSession) TransferNotionalFeeCalled(arg0 common.Address) (*big.Int, error) {
	return _VaultTracker.Contract.TransferNotionalFeeCalled(&_VaultTracker.CallOpts, arg0)
}

// TransferNotionalFeeCalled is a free data retrieval call binding the contract method 0xbbce2386.
//
// Solidity: function transferNotionalFeeCalled(address ) view returns(uint256)
func (_VaultTracker *VaultTrackerCallerSession) TransferNotionalFeeCalled(arg0 common.Address) (*big.Int, error) {
	return _VaultTracker.Contract.TransferNotionalFeeCalled(&_VaultTracker.CallOpts, arg0)
}

// TransferNotionalFromCalled is a free data retrieval call binding the contract method 0xe590c362.
//
// Solidity: function transferNotionalFromCalled(address ) view returns(address to, uint256 amount)
func (_VaultTracker *VaultTrackerCaller) TransferNotionalFromCalled(opts *bind.CallOpts, arg0 common.Address) (struct {
	To     common.Address
	Amount *big.Int
}, error) {
	var out []interface{}
	err := _VaultTracker.contract.Call(opts, &out, "transferNotionalFromCalled", arg0)

	outstruct := new(struct {
		To     common.Address
		Amount *big.Int
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.To = out[0].(common.Address)
	outstruct.Amount = out[1].(*big.Int)

	return *outstruct, err

}

// TransferNotionalFromCalled is a free data retrieval call binding the contract method 0xe590c362.
//
// Solidity: function transferNotionalFromCalled(address ) view returns(address to, uint256 amount)
func (_VaultTracker *VaultTrackerSession) TransferNotionalFromCalled(arg0 common.Address) (struct {
	To     common.Address
	Amount *big.Int
}, error) {
	return _VaultTracker.Contract.TransferNotionalFromCalled(&_VaultTracker.CallOpts, arg0)
}

// TransferNotionalFromCalled is a free data retrieval call binding the contract method 0xe590c362.
//
// Solidity: function transferNotionalFromCalled(address ) view returns(address to, uint256 amount)
func (_VaultTracker *VaultTrackerCallerSession) TransferNotionalFromCalled(arg0 common.Address) (struct {
	To     common.Address
	Amount *big.Int
}, error) {
	return _VaultTracker.Contract.TransferNotionalFromCalled(&_VaultTracker.CallOpts, arg0)
}

// AddNotional is a paid mutator transaction binding the contract method 0xa01cfffb.
//
// Solidity: function addNotional(address o, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactor) AddNotional(opts *bind.TransactOpts, o common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "addNotional", o, a)
}

// AddNotional is a paid mutator transaction binding the contract method 0xa01cfffb.
//
// Solidity: function addNotional(address o, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerSession) AddNotional(o common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.AddNotional(&_VaultTracker.TransactOpts, o, a)
}

// AddNotional is a paid mutator transaction binding the contract method 0xa01cfffb.
//
// Solidity: function addNotional(address o, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactorSession) AddNotional(o common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.AddNotional(&_VaultTracker.TransactOpts, o, a)
}

// AddNotionalReturns is a paid mutator transaction binding the contract method 0x5c70b7c1.
//
// Solidity: function addNotionalReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactor) AddNotionalReturns(opts *bind.TransactOpts, b bool) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "addNotionalReturns", b)
}

// AddNotionalReturns is a paid mutator transaction binding the contract method 0x5c70b7c1.
//
// Solidity: function addNotionalReturns(bool b) returns()
func (_VaultTracker *VaultTrackerSession) AddNotionalReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.AddNotionalReturns(&_VaultTracker.TransactOpts, b)
}

// AddNotionalReturns is a paid mutator transaction binding the contract method 0x5c70b7c1.
//
// Solidity: function addNotionalReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactorSession) AddNotionalReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.AddNotionalReturns(&_VaultTracker.TransactOpts, b)
}

// MatureVaultReturns is a paid mutator transaction binding the contract method 0xda3de9e9.
//
// Solidity: function matureVaultReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactor) MatureVaultReturns(opts *bind.TransactOpts, b bool) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "matureVaultReturns", b)
}

// MatureVaultReturns is a paid mutator transaction binding the contract method 0xda3de9e9.
//
// Solidity: function matureVaultReturns(bool b) returns()
func (_VaultTracker *VaultTrackerSession) MatureVaultReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.MatureVaultReturns(&_VaultTracker.TransactOpts, b)
}

// MatureVaultReturns is a paid mutator transaction binding the contract method 0xda3de9e9.
//
// Solidity: function matureVaultReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactorSession) MatureVaultReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.MatureVaultReturns(&_VaultTracker.TransactOpts, b)
}

// MaturityReturns is a paid mutator transaction binding the contract method 0xb4c4a4c8.
//
// Solidity: function maturityReturns(uint256 n) returns()
func (_VaultTracker *VaultTrackerTransactor) MaturityReturns(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "maturityReturns", n)
}

// MaturityReturns is a paid mutator transaction binding the contract method 0xb4c4a4c8.
//
// Solidity: function maturityReturns(uint256 n) returns()
func (_VaultTracker *VaultTrackerSession) MaturityReturns(n *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.MaturityReturns(&_VaultTracker.TransactOpts, n)
}

// MaturityReturns is a paid mutator transaction binding the contract method 0xb4c4a4c8.
//
// Solidity: function maturityReturns(uint256 n) returns()
func (_VaultTracker *VaultTrackerTransactorSession) MaturityReturns(n *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.MaturityReturns(&_VaultTracker.TransactOpts, n)
}

// RedeemInterest is a paid mutator transaction binding the contract method 0x19caf46c.
//
// Solidity: function redeemInterest(address o) returns(uint256)
func (_VaultTracker *VaultTrackerTransactor) RedeemInterest(opts *bind.TransactOpts, o common.Address) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "redeemInterest", o)
}

// RedeemInterest is a paid mutator transaction binding the contract method 0x19caf46c.
//
// Solidity: function redeemInterest(address o) returns(uint256)
func (_VaultTracker *VaultTrackerSession) RedeemInterest(o common.Address) (*types.Transaction, error) {
	return _VaultTracker.Contract.RedeemInterest(&_VaultTracker.TransactOpts, o)
}

// RedeemInterest is a paid mutator transaction binding the contract method 0x19caf46c.
//
// Solidity: function redeemInterest(address o) returns(uint256)
func (_VaultTracker *VaultTrackerTransactorSession) RedeemInterest(o common.Address) (*types.Transaction, error) {
	return _VaultTracker.Contract.RedeemInterest(&_VaultTracker.TransactOpts, o)
}

// RedeemInterestReturns is a paid mutator transaction binding the contract method 0xd6cb2c0d.
//
// Solidity: function redeemInterestReturns(uint256 a) returns()
func (_VaultTracker *VaultTrackerTransactor) RedeemInterestReturns(opts *bind.TransactOpts, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "redeemInterestReturns", a)
}

// RedeemInterestReturns is a paid mutator transaction binding the contract method 0xd6cb2c0d.
//
// Solidity: function redeemInterestReturns(uint256 a) returns()
func (_VaultTracker *VaultTrackerSession) RedeemInterestReturns(a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.RedeemInterestReturns(&_VaultTracker.TransactOpts, a)
}

// RedeemInterestReturns is a paid mutator transaction binding the contract method 0xd6cb2c0d.
//
// Solidity: function redeemInterestReturns(uint256 a) returns()
func (_VaultTracker *VaultTrackerTransactorSession) RedeemInterestReturns(a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.RedeemInterestReturns(&_VaultTracker.TransactOpts, a)
}

// RemoveNotional is a paid mutator transaction binding the contract method 0x613a28d1.
//
// Solidity: function removeNotional(address o, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactor) RemoveNotional(opts *bind.TransactOpts, o common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "removeNotional", o, a)
}

// RemoveNotional is a paid mutator transaction binding the contract method 0x613a28d1.
//
// Solidity: function removeNotional(address o, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerSession) RemoveNotional(o common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.RemoveNotional(&_VaultTracker.TransactOpts, o, a)
}

// RemoveNotional is a paid mutator transaction binding the contract method 0x613a28d1.
//
// Solidity: function removeNotional(address o, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactorSession) RemoveNotional(o common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.RemoveNotional(&_VaultTracker.TransactOpts, o, a)
}

// RemoveNotionalReturns is a paid mutator transaction binding the contract method 0x5dfe12ac.
//
// Solidity: function removeNotionalReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactor) RemoveNotionalReturns(opts *bind.TransactOpts, b bool) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "removeNotionalReturns", b)
}

// RemoveNotionalReturns is a paid mutator transaction binding the contract method 0x5dfe12ac.
//
// Solidity: function removeNotionalReturns(bool b) returns()
func (_VaultTracker *VaultTrackerSession) RemoveNotionalReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.RemoveNotionalReturns(&_VaultTracker.TransactOpts, b)
}

// RemoveNotionalReturns is a paid mutator transaction binding the contract method 0x5dfe12ac.
//
// Solidity: function removeNotionalReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactorSession) RemoveNotionalReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.RemoveNotionalReturns(&_VaultTracker.TransactOpts, b)
}

// TransferNotionalFee is a paid mutator transaction binding the contract method 0xb326258d.
//
// Solidity: function transferNotionalFee(address f, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactor) TransferNotionalFee(opts *bind.TransactOpts, f common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "transferNotionalFee", f, a)
}

// TransferNotionalFee is a paid mutator transaction binding the contract method 0xb326258d.
//
// Solidity: function transferNotionalFee(address f, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerSession) TransferNotionalFee(f common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFee(&_VaultTracker.TransactOpts, f, a)
}

// TransferNotionalFee is a paid mutator transaction binding the contract method 0xb326258d.
//
// Solidity: function transferNotionalFee(address f, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactorSession) TransferNotionalFee(f common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFee(&_VaultTracker.TransactOpts, f, a)
}

// TransferNotionalFeeReturns is a paid mutator transaction binding the contract method 0xa701da69.
//
// Solidity: function transferNotionalFeeReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactor) TransferNotionalFeeReturns(opts *bind.TransactOpts, b bool) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "transferNotionalFeeReturns", b)
}

// TransferNotionalFeeReturns is a paid mutator transaction binding the contract method 0xa701da69.
//
// Solidity: function transferNotionalFeeReturns(bool b) returns()
func (_VaultTracker *VaultTrackerSession) TransferNotionalFeeReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFeeReturns(&_VaultTracker.TransactOpts, b)
}

// TransferNotionalFeeReturns is a paid mutator transaction binding the contract method 0xa701da69.
//
// Solidity: function transferNotionalFeeReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactorSession) TransferNotionalFeeReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFeeReturns(&_VaultTracker.TransactOpts, b)
}

// TransferNotionalFrom is a paid mutator transaction binding the contract method 0x17794673.
//
// Solidity: function transferNotionalFrom(address f, address t, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactor) TransferNotionalFrom(opts *bind.TransactOpts, f common.Address, t common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "transferNotionalFrom", f, t, a)
}

// TransferNotionalFrom is a paid mutator transaction binding the contract method 0x17794673.
//
// Solidity: function transferNotionalFrom(address f, address t, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerSession) TransferNotionalFrom(f common.Address, t common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFrom(&_VaultTracker.TransactOpts, f, t, a)
}

// TransferNotionalFrom is a paid mutator transaction binding the contract method 0x17794673.
//
// Solidity: function transferNotionalFrom(address f, address t, uint256 a) returns(bool)
func (_VaultTracker *VaultTrackerTransactorSession) TransferNotionalFrom(f common.Address, t common.Address, a *big.Int) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFrom(&_VaultTracker.TransactOpts, f, t, a)
}

// TransferNotionalFromReturns is a paid mutator transaction binding the contract method 0xd0b9d032.
//
// Solidity: function transferNotionalFromReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactor) TransferNotionalFromReturns(opts *bind.TransactOpts, b bool) (*types.Transaction, error) {
	return _VaultTracker.contract.Transact(opts, "transferNotionalFromReturns", b)
}

// TransferNotionalFromReturns is a paid mutator transaction binding the contract method 0xd0b9d032.
//
// Solidity: function transferNotionalFromReturns(bool b) returns()
func (_VaultTracker *VaultTrackerSession) TransferNotionalFromReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFromReturns(&_VaultTracker.TransactOpts, b)
}

// TransferNotionalFromReturns is a paid mutator transaction binding the contract method 0xd0b9d032.
//
// Solidity: function transferNotionalFromReturns(bool b) returns()
func (_VaultTracker *VaultTrackerTransactorSession) TransferNotionalFromReturns(b bool) (*types.Transaction, error) {
	return _VaultTracker.Contract.TransferNotionalFromReturns(&_VaultTracker.TransactOpts, b)
}
