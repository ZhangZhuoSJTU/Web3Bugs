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

// CErc20ABI is the input ABI used to generate the binding from.
const CErc20ABI = "[{\"inputs\":[],\"name\":\"exchangeRateCurrent\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"exchangeRateCurrentReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"mint\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"mintCalled\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"mintReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"redeem\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"redeemCalled\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"redeemReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"redeemUnderlying\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"redeemUnderlyingCalled\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"n\",\"type\":\"uint256\"}],\"name\":\"redeemUnderlyingReturns\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]"

// CErc20Bin is the compiled bytecode used for deploying new contracts.
var CErc20Bin = "0x608060405234801561001057600080fd5b50610362806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c8063be6babbf11610071578063be6babbf14610164578063d4e7fdd414610182578063d6bcd7aa146101a0578063db006a75146101be578063de9d2a72146101ee578063e7a7b9ce1461020a576100a9565b806329d9ce3e146100ae578063852a12e3146100ca5780639ff9f1d4146100fa578063a0712d6814610116578063bd6d894d14610146575b600080fd5b6100c860048036038101906100c391906102b8565b610226565b005b6100e460048036038101906100df91906102b8565b610230565b6040516100f191906102f0565b60405180910390f35b610114600480360381019061010f91906102b8565b610243565b005b610130600480360381019061012b91906102b8565b61024d565b60405161013d91906102f0565b60405180910390f35b61014e610260565b60405161015b91906102f0565b60405180910390f35b61016c61026a565b60405161017991906102f0565b60405180910390f35b61018a610270565b60405161019791906102f0565b60405180910390f35b6101a8610276565b6040516101b591906102f0565b60405180910390f35b6101d860048036038101906101d391906102b8565b61027c565b6040516101e591906102f0565b60405180910390f35b610208600480360381019061020391906102b8565b61028f565b005b610224600480360381019061021f91906102b8565b610299565b005b8060048190555050565b6000816005819055506004549050919050565b8060068190555050565b6000816001819055506000549050919050565b6000600654905090565b60035481565b60015481565b60055481565b6000816003819055506002549050919050565b8060028190555050565b8060008190555050565b6000813590506102b281610315565b92915050565b6000602082840312156102ca57600080fd5b60006102d8848285016102a3565b91505092915050565b6102ea8161030b565b82525050565b600060208201905061030560008301846102e1565b92915050565b6000819050919050565b61031e8161030b565b811461032957600080fd5b5056fea2646970667358221220ddfaaf48e10553118ec44cd18879e4407f44441670b2f4daa8e5cfc9340a70d464736f6c63430008040033"

// DeployCErc20 deploys a new Ethereum contract, binding an instance of CErc20 to it.
func DeployCErc20(auth *bind.TransactOpts, backend bind.ContractBackend) (common.Address, *types.Transaction, *CErc20, error) {
	parsed, err := abi.JSON(strings.NewReader(CErc20ABI))
	if err != nil {
		return common.Address{}, nil, nil, err
	}

	address, tx, contract, err := bind.DeployContract(auth, parsed, common.FromHex(CErc20Bin), backend)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &CErc20{CErc20Caller: CErc20Caller{contract: contract}, CErc20Transactor: CErc20Transactor{contract: contract}, CErc20Filterer: CErc20Filterer{contract: contract}}, nil
}

// CErc20 is an auto generated Go binding around an Ethereum contract.
type CErc20 struct {
	CErc20Caller     // Read-only binding to the contract
	CErc20Transactor // Write-only binding to the contract
	CErc20Filterer   // Log filterer for contract events
}

// CErc20Caller is an auto generated read-only Go binding around an Ethereum contract.
type CErc20Caller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// CErc20Transactor is an auto generated write-only Go binding around an Ethereum contract.
type CErc20Transactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// CErc20Filterer is an auto generated log filtering Go binding around an Ethereum contract events.
type CErc20Filterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// CErc20Session is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type CErc20Session struct {
	Contract     *CErc20           // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// CErc20CallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type CErc20CallerSession struct {
	Contract *CErc20Caller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts // Call options to use throughout this session
}

// CErc20TransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type CErc20TransactorSession struct {
	Contract     *CErc20Transactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// CErc20Raw is an auto generated low-level Go binding around an Ethereum contract.
type CErc20Raw struct {
	Contract *CErc20 // Generic contract binding to access the raw methods on
}

// CErc20CallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type CErc20CallerRaw struct {
	Contract *CErc20Caller // Generic read-only contract binding to access the raw methods on
}

// CErc20TransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type CErc20TransactorRaw struct {
	Contract *CErc20Transactor // Generic write-only contract binding to access the raw methods on
}

// NewCErc20 creates a new instance of CErc20, bound to a specific deployed contract.
func NewCErc20(address common.Address, backend bind.ContractBackend) (*CErc20, error) {
	contract, err := bindCErc20(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &CErc20{CErc20Caller: CErc20Caller{contract: contract}, CErc20Transactor: CErc20Transactor{contract: contract}, CErc20Filterer: CErc20Filterer{contract: contract}}, nil
}

// NewCErc20Caller creates a new read-only instance of CErc20, bound to a specific deployed contract.
func NewCErc20Caller(address common.Address, caller bind.ContractCaller) (*CErc20Caller, error) {
	contract, err := bindCErc20(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &CErc20Caller{contract: contract}, nil
}

// NewCErc20Transactor creates a new write-only instance of CErc20, bound to a specific deployed contract.
func NewCErc20Transactor(address common.Address, transactor bind.ContractTransactor) (*CErc20Transactor, error) {
	contract, err := bindCErc20(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &CErc20Transactor{contract: contract}, nil
}

// NewCErc20Filterer creates a new log filterer instance of CErc20, bound to a specific deployed contract.
func NewCErc20Filterer(address common.Address, filterer bind.ContractFilterer) (*CErc20Filterer, error) {
	contract, err := bindCErc20(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &CErc20Filterer{contract: contract}, nil
}

// bindCErc20 binds a generic wrapper to an already deployed contract.
func bindCErc20(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(CErc20ABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_CErc20 *CErc20Raw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _CErc20.Contract.CErc20Caller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_CErc20 *CErc20Raw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _CErc20.Contract.CErc20Transactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_CErc20 *CErc20Raw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _CErc20.Contract.CErc20Transactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_CErc20 *CErc20CallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _CErc20.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_CErc20 *CErc20TransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _CErc20.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_CErc20 *CErc20TransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _CErc20.Contract.contract.Transact(opts, method, params...)
}

// ExchangeRateCurrent is a free data retrieval call binding the contract method 0xbd6d894d.
//
// Solidity: function exchangeRateCurrent() view returns(uint256)
func (_CErc20 *CErc20Caller) ExchangeRateCurrent(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _CErc20.contract.Call(opts, &out, "exchangeRateCurrent")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// ExchangeRateCurrent is a free data retrieval call binding the contract method 0xbd6d894d.
//
// Solidity: function exchangeRateCurrent() view returns(uint256)
func (_CErc20 *CErc20Session) ExchangeRateCurrent() (*big.Int, error) {
	return _CErc20.Contract.ExchangeRateCurrent(&_CErc20.CallOpts)
}

// ExchangeRateCurrent is a free data retrieval call binding the contract method 0xbd6d894d.
//
// Solidity: function exchangeRateCurrent() view returns(uint256)
func (_CErc20 *CErc20CallerSession) ExchangeRateCurrent() (*big.Int, error) {
	return _CErc20.Contract.ExchangeRateCurrent(&_CErc20.CallOpts)
}

// MintCalled is a free data retrieval call binding the contract method 0xd4e7fdd4.
//
// Solidity: function mintCalled() view returns(uint256)
func (_CErc20 *CErc20Caller) MintCalled(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _CErc20.contract.Call(opts, &out, "mintCalled")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MintCalled is a free data retrieval call binding the contract method 0xd4e7fdd4.
//
// Solidity: function mintCalled() view returns(uint256)
func (_CErc20 *CErc20Session) MintCalled() (*big.Int, error) {
	return _CErc20.Contract.MintCalled(&_CErc20.CallOpts)
}

// MintCalled is a free data retrieval call binding the contract method 0xd4e7fdd4.
//
// Solidity: function mintCalled() view returns(uint256)
func (_CErc20 *CErc20CallerSession) MintCalled() (*big.Int, error) {
	return _CErc20.Contract.MintCalled(&_CErc20.CallOpts)
}

// RedeemCalled is a free data retrieval call binding the contract method 0xbe6babbf.
//
// Solidity: function redeemCalled() view returns(uint256)
func (_CErc20 *CErc20Caller) RedeemCalled(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _CErc20.contract.Call(opts, &out, "redeemCalled")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// RedeemCalled is a free data retrieval call binding the contract method 0xbe6babbf.
//
// Solidity: function redeemCalled() view returns(uint256)
func (_CErc20 *CErc20Session) RedeemCalled() (*big.Int, error) {
	return _CErc20.Contract.RedeemCalled(&_CErc20.CallOpts)
}

// RedeemCalled is a free data retrieval call binding the contract method 0xbe6babbf.
//
// Solidity: function redeemCalled() view returns(uint256)
func (_CErc20 *CErc20CallerSession) RedeemCalled() (*big.Int, error) {
	return _CErc20.Contract.RedeemCalled(&_CErc20.CallOpts)
}

// RedeemUnderlyingCalled is a free data retrieval call binding the contract method 0xd6bcd7aa.
//
// Solidity: function redeemUnderlyingCalled() view returns(uint256)
func (_CErc20 *CErc20Caller) RedeemUnderlyingCalled(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _CErc20.contract.Call(opts, &out, "redeemUnderlyingCalled")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// RedeemUnderlyingCalled is a free data retrieval call binding the contract method 0xd6bcd7aa.
//
// Solidity: function redeemUnderlyingCalled() view returns(uint256)
func (_CErc20 *CErc20Session) RedeemUnderlyingCalled() (*big.Int, error) {
	return _CErc20.Contract.RedeemUnderlyingCalled(&_CErc20.CallOpts)
}

// RedeemUnderlyingCalled is a free data retrieval call binding the contract method 0xd6bcd7aa.
//
// Solidity: function redeemUnderlyingCalled() view returns(uint256)
func (_CErc20 *CErc20CallerSession) RedeemUnderlyingCalled() (*big.Int, error) {
	return _CErc20.Contract.RedeemUnderlyingCalled(&_CErc20.CallOpts)
}

// ExchangeRateCurrentReturns is a paid mutator transaction binding the contract method 0x9ff9f1d4.
//
// Solidity: function exchangeRateCurrentReturns(uint256 n) returns()
func (_CErc20 *CErc20Transactor) ExchangeRateCurrentReturns(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _CErc20.contract.Transact(opts, "exchangeRateCurrentReturns", n)
}

// ExchangeRateCurrentReturns is a paid mutator transaction binding the contract method 0x9ff9f1d4.
//
// Solidity: function exchangeRateCurrentReturns(uint256 n) returns()
func (_CErc20 *CErc20Session) ExchangeRateCurrentReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.ExchangeRateCurrentReturns(&_CErc20.TransactOpts, n)
}

// ExchangeRateCurrentReturns is a paid mutator transaction binding the contract method 0x9ff9f1d4.
//
// Solidity: function exchangeRateCurrentReturns(uint256 n) returns()
func (_CErc20 *CErc20TransactorSession) ExchangeRateCurrentReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.ExchangeRateCurrentReturns(&_CErc20.TransactOpts, n)
}

// Mint is a paid mutator transaction binding the contract method 0xa0712d68.
//
// Solidity: function mint(uint256 n) returns(uint256)
func (_CErc20 *CErc20Transactor) Mint(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _CErc20.contract.Transact(opts, "mint", n)
}

// Mint is a paid mutator transaction binding the contract method 0xa0712d68.
//
// Solidity: function mint(uint256 n) returns(uint256)
func (_CErc20 *CErc20Session) Mint(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.Mint(&_CErc20.TransactOpts, n)
}

// Mint is a paid mutator transaction binding the contract method 0xa0712d68.
//
// Solidity: function mint(uint256 n) returns(uint256)
func (_CErc20 *CErc20TransactorSession) Mint(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.Mint(&_CErc20.TransactOpts, n)
}

// MintReturns is a paid mutator transaction binding the contract method 0xe7a7b9ce.
//
// Solidity: function mintReturns(uint256 n) returns()
func (_CErc20 *CErc20Transactor) MintReturns(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _CErc20.contract.Transact(opts, "mintReturns", n)
}

// MintReturns is a paid mutator transaction binding the contract method 0xe7a7b9ce.
//
// Solidity: function mintReturns(uint256 n) returns()
func (_CErc20 *CErc20Session) MintReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.MintReturns(&_CErc20.TransactOpts, n)
}

// MintReturns is a paid mutator transaction binding the contract method 0xe7a7b9ce.
//
// Solidity: function mintReturns(uint256 n) returns()
func (_CErc20 *CErc20TransactorSession) MintReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.MintReturns(&_CErc20.TransactOpts, n)
}

// Redeem is a paid mutator transaction binding the contract method 0xdb006a75.
//
// Solidity: function redeem(uint256 n) returns(uint256)
func (_CErc20 *CErc20Transactor) Redeem(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _CErc20.contract.Transact(opts, "redeem", n)
}

// Redeem is a paid mutator transaction binding the contract method 0xdb006a75.
//
// Solidity: function redeem(uint256 n) returns(uint256)
func (_CErc20 *CErc20Session) Redeem(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.Redeem(&_CErc20.TransactOpts, n)
}

// Redeem is a paid mutator transaction binding the contract method 0xdb006a75.
//
// Solidity: function redeem(uint256 n) returns(uint256)
func (_CErc20 *CErc20TransactorSession) Redeem(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.Redeem(&_CErc20.TransactOpts, n)
}

// RedeemReturns is a paid mutator transaction binding the contract method 0xde9d2a72.
//
// Solidity: function redeemReturns(uint256 n) returns()
func (_CErc20 *CErc20Transactor) RedeemReturns(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _CErc20.contract.Transact(opts, "redeemReturns", n)
}

// RedeemReturns is a paid mutator transaction binding the contract method 0xde9d2a72.
//
// Solidity: function redeemReturns(uint256 n) returns()
func (_CErc20 *CErc20Session) RedeemReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.RedeemReturns(&_CErc20.TransactOpts, n)
}

// RedeemReturns is a paid mutator transaction binding the contract method 0xde9d2a72.
//
// Solidity: function redeemReturns(uint256 n) returns()
func (_CErc20 *CErc20TransactorSession) RedeemReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.RedeemReturns(&_CErc20.TransactOpts, n)
}

// RedeemUnderlying is a paid mutator transaction binding the contract method 0x852a12e3.
//
// Solidity: function redeemUnderlying(uint256 n) returns(uint256)
func (_CErc20 *CErc20Transactor) RedeemUnderlying(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _CErc20.contract.Transact(opts, "redeemUnderlying", n)
}

// RedeemUnderlying is a paid mutator transaction binding the contract method 0x852a12e3.
//
// Solidity: function redeemUnderlying(uint256 n) returns(uint256)
func (_CErc20 *CErc20Session) RedeemUnderlying(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.RedeemUnderlying(&_CErc20.TransactOpts, n)
}

// RedeemUnderlying is a paid mutator transaction binding the contract method 0x852a12e3.
//
// Solidity: function redeemUnderlying(uint256 n) returns(uint256)
func (_CErc20 *CErc20TransactorSession) RedeemUnderlying(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.RedeemUnderlying(&_CErc20.TransactOpts, n)
}

// RedeemUnderlyingReturns is a paid mutator transaction binding the contract method 0x29d9ce3e.
//
// Solidity: function redeemUnderlyingReturns(uint256 n) returns()
func (_CErc20 *CErc20Transactor) RedeemUnderlyingReturns(opts *bind.TransactOpts, n *big.Int) (*types.Transaction, error) {
	return _CErc20.contract.Transact(opts, "redeemUnderlyingReturns", n)
}

// RedeemUnderlyingReturns is a paid mutator transaction binding the contract method 0x29d9ce3e.
//
// Solidity: function redeemUnderlyingReturns(uint256 n) returns()
func (_CErc20 *CErc20Session) RedeemUnderlyingReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.RedeemUnderlyingReturns(&_CErc20.TransactOpts, n)
}

// RedeemUnderlyingReturns is a paid mutator transaction binding the contract method 0x29d9ce3e.
//
// Solidity: function redeemUnderlyingReturns(uint256 n) returns()
func (_CErc20 *CErc20TransactorSession) RedeemUnderlyingReturns(n *big.Int) (*types.Transaction, error) {
	return _CErc20.Contract.RedeemUnderlyingReturns(&_CErc20.TransactOpts, n)
}
