const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const chai = require('chai')
const { assert } = chai
const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");


//======== TOKEN ========//
const verifyBalance = async ({ token, address, expectedBalance }) => {
    const balance = await token.balanceOf(address)
    assert.equal(balance.toString(), expectedBalance.toString(), `token balance incorrect for ${token.address} with ${address}`)
}

const verifyBalances = async ({ token, userBalances }) => {
    const users = Object.keys(userBalances)
    for (i = 0; i < users.length; i++) {
      await verifyBalance({ token: token, address: users[i], expectedBalance: userBalances[users[i]]})
    }
}
const verifyAllowance = async ({ token, owner, spender, expectedAllowance }) => {
    const allowance = await token.allowance(owner, spender)
    assert.equal(+allowance, expectedAllowance, `allowance incorrect for ${token.address} owner ${owner} spender ${spender}`)
}


//======== UNIVARSAL POOLs========//
const verifyValueOfUnderlying = async({template, valueOfUnderlyingOf, valueOfUnderlying}) => {
    expect(await template.valueOfUnderlying(valueOfUnderlyingOf)).to.closeTo(valueOfUnderlying, 1); //rounding error
}

const verifyRate = async({template, rate}) => {
    expect(await template.rate()).to.equal(rate);
}



//======== POOLs ========//
const _verifyPoolStatus = async({pool, totalSupply, totalLiquidity, availableBalance, rate, utilizationRate, allInsuranceCount}) => {
    expect(await pool.totalSupply()).to.equal(totalSupply);
    expect(await pool.totalLiquidity()).to.equal(totalLiquidity);
    expect(await pool.availableBalance()).to.equal(availableBalance);
    expect(await pool.rate()).to.equal(rate);
    expect(await pool.utilizationRate()).to.equal(utilizationRate);
    expect(await pool.allInsuranceCount()).to.equal(allInsuranceCount);
}

const verifyPoolsStatus = async({pools}) => {
    for (i = 0; i < pools.length; i++) {
        await _verifyPoolStatus({ 
            pool: pools[i].pool,
            totalSupply: pools[i].totalSupply,
            totalLiquidity: pools[i].totalLiquidity,
            availableBalance: pools[i].availableBalance,
            rate: pools[i].rate,
            utilizationRate: pools[i].utilizationRate,
            allInsuranceCount: pools[i].allInsuranceCount
        })
    }
}

const _verifyPoolStatusForIndex = async({pool, indexAddress, allocatedCredit, pendingPremium}) => {
    expect(await pool.allocatedCredit(indexAddress)).to.equal(allocatedCredit);
    expect(await pool.pendingPremium(indexAddress)).to.equal(pendingPremium);
}

const verifyPoolsStatusForIndex = async({pools}) => {
    for (i = 0; i < pools.length; i++) {
        await _verifyPoolStatusForIndex({ 
            pool: pools[i].pool,
            indexAddress: pools[i].indexAddress,
            allocatedCredit: pools[i].allocatedCredit,
            pendingPremium: pools[i].pendingPremium
        })
    }
}


//those legacy functions are used for tests that are not refactored yet.
const _verifyPoolStatus_legacy = async({pool, totalLiquidity, availableBalance}) => {
    expect(await pool.totalLiquidity()).to.equal(totalLiquidity);
    expect(await pool.availableBalance()).to.equal(availableBalance);
}

const verifyPoolsStatus_legacy = async({pools}) => {
    for (i = 0; i < pools.length; i++) {
        await _verifyPoolStatus_legacy({ 
            pool: pools[i].pool,
            totalLiquidity: pools[i].totalLiquidity,
            availableBalance: pools[i].availableBalance
        })
    }
}

const _verifyPoolStatusForIndex_legacy = async({pool, allocatedCreditOf, allocatedCredit}) => {
    expect(await pool.allocatedCredit(allocatedCreditOf)).to.equal(allocatedCredit);
}

const verifyPoolsStatusForIndex_legacy = async({pools}) => {
    for (i = 0; i < pools.length; i++) {
        await _verifyPoolStatusForIndex_legacy({ 
            pool: pools[i].pool,
            allocatedCreditOf: pools[i].allocatedCreditOf,
            allocatedCredit: pools[i].allocatedCredit
        })
    }
}


//======== INDEXs ========//
const verifyIndexStatus = async ({index, totalSupply, totalLiquidity, totalAllocatedCredit, totalAllocPoint, targetLev, leverage, withdrawable, rate}) => {
    expect(await index.totalSupply()).to.equal(totalSupply); //LP
    expect(await index.totalLiquidity()).to.equal(totalLiquidity); //USDC
    expect(await index.totalAllocatedCredit()).to.equal(totalAllocatedCredit); //leveraged
    expect(await index.totalAllocPoint()).to.equal(totalAllocPoint);
    expect(await index.targetLev()).to.equal(targetLev);
    expect(await index.leverage()).to.equal(leverage);
    expect(await index.withdrawable()).to.closeTo(withdrawable, 1);
    expect(await index.rate()).to.equal(rate);
}

const verifyIndexStatusOf = async({index, targetAddress, valueOfUnderlying, withdrawTimestamp, withdrawAmount}) => {
    expect(await index.valueOfUnderlying(targetAddress)).to.equal(valueOfUnderlying);
    expect((await index.withdrawalReq(targetAddress)).timestamp).to.equal(withdrawTimestamp);
    expect((await index.withdrawalReq(targetAddress)).amount).to.equal(withdrawAmount);
}

const verifyIndexStatusOfPool = async({index, poolAddress, allocPoints}) => {
    expect(await index.allocPoints(poolAddress)).to.equal(allocPoints);
}


//======== CDS ========//
const verifyCDSStatus = async({cds, surplusPool, crowdPool, totalSupply, totalLiquidity, rate}) => {
    expect(await cds.surplusPool()).to.equal(surplusPool);
    expect(await cds.crowdPool()).to.equal(crowdPool);
    expect(await cds.totalSupply()).to.equal(totalSupply);
    expect(await cds.totalLiquidity()).to.equal(totalLiquidity);
    expect(await cds.rate()).to.equal(rate);
}

const verifyCDSStatusOf = async({cds, targetAddress, valueOfUnderlying, withdrawTimestamp, withdrawAmount}) => {
    expect(await cds.valueOfUnderlying(targetAddress)).to.equal(valueOfUnderlying);
    expect((await cds.withdrawalReq(targetAddress)).timestamp).to.equal(withdrawTimestamp);
    expect((await cds.withdrawalReq(targetAddress)).amount).to.equal(withdrawAmount);
}

const verifyCDSStatus_legacy = async({cds, totalSupply, totalLiquidity, rate}) => {
    expect(await cds.totalSupply()).to.equal(totalSupply);
    expect(await cds.totalLiquidity()).to.equal(totalLiquidity);
    expect(await cds.rate()).to.equal(rate);
}


//======== VAULT ========//
const verifyVaultStatus = async({vault, balance, valueAll, totalAttributions, totalDebt}) => {
    expect(await vault.balance()).to.equal(balance);
    expect(await vault.valueAll()).to.equal(valueAll);
    expect(await vault.totalAttributions()).to.equal(totalAttributions);
    expect(await vault.totalDebt()).to.equal(totalDebt);
}

const verifyVaultStatusOf = async({vault, target, attributions, underlyingValue, debt}) => {
    expect(await vault.attributions(target)).to.equal(attributions);
    expect(await vault.underlyingValue(target)).to.equal(underlyingValue);
    expect(await vault.debts(target)).to.equal(debt);
}

const verifyVaultStatus_legacy = async({vault, valueAll, totalAttributions}) => {
    expect(await vault.valueAll()).to.equal(valueAll);
    expect(await vault.totalAttributions()).to.equal(totalAttributions);
}

const verifyVaultStatusOf_legacy = async({vault, target, attributions, underlyingValue}) => {
    expect(await vault.attributions(target)).to.equal(attributions);
    expect(await vault.underlyingValue(target)).to.equal(underlyingValue);
}

const verifyDebtOf = async({vault, target, debt}) => {
    expect(await vault.debts(target)).to.equal(debt);
}


//function
const insure = async({pool, insurer, amount, maxCost, span, target}) => {
    let tx = await pool.connect(insurer).insure(amount, maxCost, span, target);

    let receipt = await tx.wait()
    let premium = receipt.events[4].args[6]

    return premium
}



Object.assign(exports, {
    verifyBalance,
    verifyBalances,
    verifyAllowance,

    //univarsal
    verifyValueOfUnderlying,
    verifyRate,

    //pool
    verifyPoolsStatus,
    verifyPoolsStatus_legacy,
    verifyPoolsStatusForIndex,
    verifyPoolsStatusForIndex_legacy,

    //index
    verifyIndexStatus,
    verifyIndexStatusOf,
    verifyIndexStatusOfPool,

    //cds
    verifyCDSStatus,
    verifyCDSStatusOf,
    verifyCDSStatus_legacy,

    //vault
    verifyDebtOf,
    verifyVaultStatus_legacy,
    verifyVaultStatusOf_legacy,
    verifyVaultStatus,
    verifyVaultStatusOf,

    //function
    insure
})