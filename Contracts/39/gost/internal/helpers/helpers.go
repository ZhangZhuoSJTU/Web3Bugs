// this file can be split up into foo_helper, bar_helpers etc to prevent ye olde monolith

package helpers

import (
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/swivel-finance/gost/test/fakes"
)

func NewAuth() (*ecdsa.PrivateKey, *bind.TransactOpts) {
	pk, _ := crypto.GenerateKey()
	return pk, bind.NewKeyedTransactor(pk)
}

// GenBytes32 is a convenience function for some tests where a "GetHash" method is not available.
// Returns a type compatible with bytes32, given a string 32 chars or less.
func GenBytes32(s string) [32]byte {
	bytes := [32]byte{}
	copy(bytes[:], []byte(s))
	return bytes
}

// NewCallOpts is a function which allows us to more succinctly place Call options
func NewCallOpts(a common.Address) *bind.CallOpts {
	return &bind.CallOpts{
		// TODO: Should this be a settable argument?
		Pending: false,
		From:    a,
	}
}

// NewTxOpts is a function which allows us to more succintly get a hydrated TransactOpts object
func NewTransactOpts(a *bind.TransactOpts, v *big.Int, p *big.Int, l uint64) *bind.TransactOpts {
	return &bind.TransactOpts{
		From:     a.From,
		Signer:   a.Signer,
		Value:    v,
		GasPrice: p,
		GasLimit: l,
	}
}

// Commafy will take a big integer and return a string with commas so that logging
// big integers is human readable
func Commafy(n *big.Int) string {
	in := fmt.Sprintf("%d", n)
	out := make([]byte, len(in)+(len(in)-2+int(in[0]/'0'))/3)

	for i, j, k := len(in)-1, len(out)-1, 0; ; i, j = i-1, j-1 {
		out[j] = in[i]
		if i == 0 {
			return string(out)
		}
		if k++; k == 3 {
			j, k = j-1, 0
			out[j] = ','
		}
	}
}

// NewHashOrder will take args to hydrate a Hash.Order and return it
func NewHashOrder(
	k [32]byte,
	maker common.Address,
	u common.Address,
	v bool,
	exit bool,
	principal int64,
	premium int64,
	maturity int64,
	expiry int64,
) fakes.HashOrder {
	return fakes.HashOrder{
		Key:        k,
		Maker:      maker,
		Underlying: u,
		Vault:      v,
		Exit:       exit,
		Principal:  big.NewInt(principal),
		Premium:    big.NewInt(premium),
		Maturity:   big.NewInt(maturity),
		Expiry:     big.NewInt(expiry),
	}
}
