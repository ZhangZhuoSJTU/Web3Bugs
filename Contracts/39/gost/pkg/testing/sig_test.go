package testing

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type sigTestSuite struct {
	suite.Suite
	Env *Env
	Dep *Dep
}

// SetupSuite serves as a 'beforeAll', hydrating both the Env and Dep objects
func (s *sigTestSuite) SetupSuite() {
	var err error

	s.Env = NewEnv(big.NewInt(ONE_ETH)) // each of the wallets in the env will begin with this balance
	s.Dep, err = Deploy(s.Env)

	if err != nil {
		panic(err)
	}
}

func (s *sigTestSuite) TestSplit() {
	assert := assert.New(s.T())

	msg := []byte("Yo Dawg, heard u liek unit tests")
	hash := crypto.Keccak256Hash(msg)

	// sign with user1...
	sig, err := crypto.Sign(hash.Bytes(), s.Env.User1.PK)

	assert.Nil(err)
	assert.NotNil(sig)

	vrs, err := s.Dep.SigFake.SplitTest(nil, sig)

	assert.Nil(err)
	assert.NotNil(vrs)
}

func (s *sigTestSuite) TestRecover() {
	assert := assert.New(s.T())

	msg := []byte("So we put tests in your tests so you can test while you test")
	hash := crypto.Keccak256Hash(msg)

	// sign with user1...
	sig, err := crypto.Sign(hash.Bytes(), s.Env.User1.PK)
	// the go bindings return a struct here -> { V: R: S: }
	vrs, err := s.Dep.SigFake.SplitTest(nil, sig)

	// crypto.Sign will produce a split whose V is 0 or 1
	// NOTE: 27 or 28 are acceptable
	if vrs.V < 27 {
		vrs.V += 27
	}

	addr, err := s.Dep.SigFake.RecoverTest(nil, hash, vrs)

	assert.Nil(err)
	assert.NotNil(addr)
	assert.Equal(addr, s.Env.User1.Opts.From)
}

func TestSigSuite(t *test.T) {
	suite.Run(t, &sigTestSuite{})
}
