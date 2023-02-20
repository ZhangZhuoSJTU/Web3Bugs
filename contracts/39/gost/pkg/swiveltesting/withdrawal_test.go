package swiveltesting

import (
	"math/big"
	"strings"
	test "testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/mocks"
	"github.com/swivel-finance/gost/test/swivel"
)

type withdrawalSuite struct {
	suite.Suite
	Env    *Env
	Dep    *Dep
	Erc20  *mocks.Erc20Session
	Swivel *swivel.SwivelSession
}

func (s *withdrawalSuite) SetupTest() {
	var err error

	s.Env = NewEnv(big.NewInt(ONE_ETH))
	s.Dep, err = Deploy(s.Env)

	if err != nil {
		panic(err)
	}

	// err = s.Env.Blockchain.AdjustTime(0) // set bc timestamp to 0
	// if err != nil {
	// 	panic(err)
	// }
	// s.Env.Blockchain.Commit()

	s.Erc20 = &mocks.Erc20Session{
		Contract: s.Dep.Erc20,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}

	s.Swivel = &swivel.SwivelSession{
		Contract: s.Dep.Swivel,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}
}

func (s *withdrawalSuite) TestScheduleWithdrawal() {
	assert := assert.New(s.T())

	tokenAddress := common.HexToAddress("0xiamatoken") // we don't need an actual token here

	tx, err := s.Swivel.ScheduleWithdrawal(tokenAddress)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	hold, _ := s.Swivel.Withdrawals(tokenAddress)
	assert.Equal(1, hold.Cmp(big.NewInt(259200))) // hold should be greater than the hold constant
}

func (s *withdrawalSuite) TestScheduleWithdrawalFails() {
	assert := assert.New(s.T())

	tokenAddress := common.HexToAddress("0xiamanothertoken")

	tx, err := s.Dep.Swivel.ScheduleWithdrawal(&bind.TransactOpts{From: s.Env.User1.Opts.From, Signer: s.Env.User1.Opts.Signer}, tokenAddress)

	assert.NotNil(err)
	assert.Nil(tx)
	assert.True(strings.Contains(err.Error(), "sender must be admin"))
	s.Env.Blockchain.Commit()

	hold, _ := s.Swivel.Withdrawals(tokenAddress)
	assert.Equal(0, hold.Cmp(big.NewInt(0)))
}

func (s *withdrawalSuite) TestWithdrawalFailsNotScheduled() {
	assert := assert.New(s.T())

	tokenAddress := common.HexToAddress("0xyomommastoken")

	tx, err := s.Swivel.Withdraw(tokenAddress)

	assert.NotNil(err)
	assert.Nil(tx)
	assert.True(strings.Contains(err.Error(), "no withdrawal scheduled"))
}

func (s *withdrawalSuite) TestWithdrawalFailsOnHold() {
	assert := assert.New(s.T())

	tokenAddress := common.HexToAddress("0xspamtoken")

	tx, err := s.Swivel.ScheduleWithdrawal(tokenAddress)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	tx, err = s.Swivel.Withdraw(tokenAddress)

	assert.NotNil(err)
	assert.Nil(tx)
	assert.True(strings.Contains(err.Error(), "withdrawal still on hold"))
}

func (s *withdrawalSuite) TestWithdrawal() {
	assert := assert.New(s.T())

	// reset time to 0
	err := s.Env.Blockchain.AdjustTime(0)
	if err != nil {
		panic(err)
	}

	s.Env.Blockchain.Commit()

	oneBill := big.NewInt(1000000000)

	// stub the balanceOf return
	tx, err := s.Erc20.BalanceOfReturns(oneBill)
	assert.NotNil(tx)
	assert.Nil(err)

	s.Env.Blockchain.Commit()

	// schedule it...
	tx, err = s.Swivel.ScheduleWithdrawal(s.Dep.Erc20Address)
	s.Env.Blockchain.Commit()

	// move, at least, to the hold time
	err = s.Env.Blockchain.AdjustTime(259200 * time.Second)
	if err != nil {
		panic(err)
	}
	s.Env.Blockchain.Commit()

	// now you should be able to withdraw
	tx, err = s.Swivel.Withdraw(s.Dep.Erc20Address)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// inspect the transfer amt
	amount, _ := s.Erc20.TransferCalled(s.Env.Owner.Opts.From)
	assert.Equal(amount, oneBill)
}

func TestWithdrawalSuite(t *test.T) {
	suite.Run(t, &withdrawalSuite{})
}
