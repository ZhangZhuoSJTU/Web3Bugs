package vaulttrackertesting

import (
	"crypto/ecdsa"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/accounts/abi/bind/backends"
	"github.com/ethereum/go-ethereum/core"
	"github.com/swivel-finance/gost/internal/helpers"
)

// Auth is a custom type which allows us easy access to the dynamically generated
// ecdsa.PrivateKey along with the bind.TransactOpts
type Auth struct {
	PK   *ecdsa.PrivateKey
	Opts *bind.TransactOpts
}

// Env, holds Auth objects capable of signing transactions.
// Also holds the Geth simulated backend.
type Env struct {
	Alloc core.GenesisAlloc
	// TODO maybe change to Admin to fit v2 contract terms...
	Owner      *Auth
	User1      *Auth
	User2      *Auth
	Blockchain *backends.SimulatedBackend
}

// NewEnv returns a hydrated Env struct, ready for use.
// Given a balance argument, it assigns this as the wallet balance for
// each authorization object in the Ctx
func NewEnv(b *big.Int) *Env {
	pk, owner := helpers.NewAuth()
	pk1, u1 := helpers.NewAuth()
	pk2, u2 := helpers.NewAuth()
	alloc := make(core.GenesisAlloc)
	alloc[owner.From] = core.GenesisAccount{Balance: b}
	alloc[u1.From] = core.GenesisAccount{Balance: b}
	alloc[u2.From] = core.GenesisAccount{Balance: b}
	// 2nd arg is a gas limit, a uint64. we'll use 4.7 million
	bc := backends.NewSimulatedBackend(alloc, 4700000)

	return &Env{
		Alloc:      alloc,
		Owner:      &Auth{PK: pk, Opts: owner},
		User1:      &Auth{PK: pk1, Opts: u1},
		User2:      &Auth{PK: pk2, Opts: u2},
		Blockchain: bc,
	}
}
