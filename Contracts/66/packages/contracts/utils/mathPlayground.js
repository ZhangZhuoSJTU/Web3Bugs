// Hardhat script for interacting with ABDKMath functions

const FunctionCaller = artifacts.require("FunctionCaller");


const ABDKOperations = async () => {
    const functionCaller = await FunctionCaller.new("Hello, world!");

    console.log("FunctioCaller address:", functionCaller.address);

    // --- ABDK64 ---

    // // --- Testing max values ---
    // const maxVal = await functionCaller.abdkMath_fromUInt_view('18446744073709551615')
    // console.log(`max is ${maxVal}`)
    // const max_plus_1 = await functionCaller.abdkMath_fromUInt_view('18446744073709551616')
    // console.log(`${max_plus_1}`)

    // // --- Multiplication ---

    // 5 * 6
    // convert each uint to 64.64
    const res1 = await functionCaller.abdkMath_fromUInt_view(5)
    console.log(`5 as 64.64 fixed-point: ${res1}`)
    const res2 = await functionCaller.abdkMath_fromUInt_view(6)
    console.log(`6 as 64.64 fixed-point: ${res2}`)

    // perform mul operation in 64.64
    const res3 = await functionCaller.abdkMath_mul_view(res1, res2)
    const res4 = await functionCaller.abdkMath_toUInt_view(res3)
    console.log(`result of 5 * 6, performed in 64.64, converted back to uint64: ${res4}`)

    // 500 * 600
    // convert each uint to 64.64
    const res5 = await functionCaller.abdkMath_fromUInt_view(500)
    console.log(`5 as 64.64 fixed-point: ${res5}`)
    const res6 = await functionCaller.abdkMath_fromUInt_view(600)
    console.log(`6 as 64.64 fixed-point: ${res6}`)

    // perform mul operation in 64.64
    const res7 = await functionCaller.abdkMath_mul_view(res5, res6)
    const res8 = await functionCaller.abdkMath_toUInt_view(res7)
    console.log(`result of 500 * 600, performed in 64.64, converted back to uint64: ${res4}`)

    // // 0.5 * 6 
    // get 0.5 as 64.64dec
    const res9 = await functionCaller.abdkMath_divu_view(1, 2)
    console.log(`0.5 as 64.64 fixed-point: ${res9}`)
    // get 6 as 64.64dec
    const res10 = await functionCaller.abdkMath_fromUInt_view(6)
    console.log(`6 as 64.64 fixed-point: ${res10}`)

    // perform mul operation in 64.64
    const res11 = await functionCaller.abdkMath_mul_view(res9, res10)
    const res12 = await functionCaller.abdkMath_toUInt_view(res11)
    console.log(`result of 0.5 * 6, performed in 64.64, converted back to uint64: ${res12}`)

    // Example computaton: YUSD -> Ether price conversion

    // price = 200.12345678, stored as uint
    // convert 6123456700909.123456789123456789 YUSD to Ether
    // amount = 6123456700909.123456789123456789 YUSD / 200.12345678 

    // expect amount 30598395607.571232843807983401100033706903271291774255... Ether

    // 1)
    const storedPrice = '20012345678'
    // convert price to 64.64dec fraction
    const price = await functionCaller.abdkMath_divu_view(storedPrice, '100000000')
    const etherVal = await functionCaller.abdkMath_divu_view('6123456700909123456789123456789', price)
    console.log(`ether val is ${etherVal}`)

    // returns 30598395607571232843814242587

    // expected: 30598395607.571232843807983401100033706903271291774255... Ether
    //  actual:   30598395607.571232843814242587 Ether

    // accurate to 22 digits.  So with 99 billion ether, it's accurate to 1 gwei. 

    // Example computation: Stake computation

    // 1) 

    // reward = stake * S - S0

    // stake = 65032.123456789123456789 Ether
    // S = 0.005555555888888888 Ether per unit staked
    // S_0 = 0.003579246835792468 Ether per uint staked
    // S - S_0 = 0.001976309053096420 
    // r = s * S - S0
    // r =  128.523574329736396343 Ether

    let stake = '65032123456789123456789'
    let rewardPerUnitStaked = '1976309053096420'

    let fraction = await functionCaller.abdkMath_divu_view(rewardPerUnitStaked, '1000000000000000000')
    let reward = await functionCaller.abdkMath_mulu_view(fraction, stake)
    console.log(`${reward}`)

    // returns 128.523574329736395585
    // accurate to 18 digits

    // 2) 
    // reward = stake * S - S0

    /* stake = 5555565032.123456789123456789 Ether
    S = 0.005555555888888888 Ether per unit staked
    S_0 = 0.003579246835792468 Ether per uint staked
    S - S_0 = 0.001976309053096420 
    r = s * S - S0
    r = 10979513.468051491046396343 Ether
    */

    stake = '5555565032123456789123456789'
    rewardPerUnitStaked = '1976309053096420'

    fraction = await functionCaller.abdkMath_divu_view(rewardPerUnitStaked, '1000000000000000000')
    reward = await functionCaller.abdkMath_mulu_view(fraction, stake)
    console.log(`${reward}`)

    // returns 10979513.468051490981687838
    // accurate to 17 digits

    /* TODO: will L_ETH, L_YUSD overflow if stored as 64.64? Possibly need to store as uint, divide by 1e18, then use
    the resulting 64.64  */

    // // --- Ratio Multiplication ---
    const res13 = await functionCaller.abdkMath_divu_view(1, 2)
    console.log(`0.5 as 64.64 fixed-point: ${res13}`)

    // multiply the 64.64dec ratio by the uint, and convert result back to uint
    const res14 = await functionCaller.abdkMath_mulu_view(res13, 6)
    console.log(`result of 0.5 * 6, performed in 64.64, converted back to uint256: ${res14}`)
    // 

    // //--- Division ---

    const res16 = await functionCaller.abdkMath_divu_view(11, 10)
    console.log(`10/11 as 64.64 fixed-point: ${res16}`)

    const res17 = await functionCaller.abdkMath_mulu_view(res7, 1000)
    const res18 = await functionCaller.abdkMath_mulu_view(res7, 1000000)
    const res19 = await functionCaller.abdkMath_mulu_view(res7, 1000000000)
    const res20 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000')
    const res21 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000000')
    const res22 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000000000')
    const res23 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000000000000')
    const res24 = await functionCaller.abdkMath_mulu_view(res7,
        '100000000000000000000000000000000000000000000000')
    console.log(`log fraction to increasing precision`)
    console.log(`${res17}`)
    console.log(`${res18}`)
    console.log(`${res19}`)
    console.log(`${res20}`)
    console.log(`${res21}`)
    console.log(`${res22}`)
    console.log(`${res23}`)
    console.log(`${res24}`)

    // seems accurate to 18 digits

    /* 
    --- Using ABDK functions in Liquity ---
    
    ABDK.mulu is for: (64.64dec * uint)  -> uint.  i.e. for rewardPerUnitStaked  * stake -> reward
    
    ABDK.divu is for: (uint / uint)  -> 64.64dec.  i.e. for liquidatedETH / totalStakes 
    
    */
}

const basicOperations = async () => {
}

const checkGasFromSSTORE = async () => {
    const functionCaller = await FunctionCaller.new();

    const tx1 = await functionCaller.repeatedlySetVal(1)
    const tx2 = await functionCaller.repeatedlySetVal(2)
    const tx9 = await functionCaller.repeatedlySetVal(3)
    const tx3 = await functionCaller.repeatedlySetVal(5)
    const tx4 = await functionCaller.repeatedlySetVal(10)
    const tx5 = await functionCaller.repeatedlySetVal(20)
    const tx6 = await functionCaller.repeatedlySetVal(30)
    const tx7 = await functionCaller.repeatedlySetVal(40)
    const tx8 = await functionCaller.repeatedlySetVal(50)

    const gasUsed1 = (tx1.receipt.gasUsed - 21000)
    const gasUsed2 = (tx2.receipt.gasUsed - 21000)/2
    const gasUsed9 = (tx9.receipt.gasUsed - 21000)/3
    const gasUsed3 = (tx3.receipt.gasUsed - 21000)/5
    const gasUsed4 = (tx4.receipt.gasUsed - 21000)/10
    const gasUsed5 = (tx5.receipt.gasUsed - 21000)/20
    const gasUsed6 = (tx6.receipt.gasUsed - 21000)/30
    const gasUsed7 = (tx7.receipt.gasUsed - 21000)/40
    const gasUsed8 = (tx8.receipt.gasUsed - 21000)/50

    console.log(`gas used per write, setting val once: ${gasUsed1}`)
    console.log(`gas used per write, setting val 2 times: ${gasUsed2}`)
    console.log(`gas used per write, setting val 3 times: ${gasUsed9}`)
    console.log(`gas used per write, setting val 5 times: ${gasUsed3}`)
    console.log(`gas used per write, setting val 10 times: ${gasUsed4}`)
    console.log(`gas used per write, setting val 20 times: ${gasUsed5}`)
    console.log(`gas used per write, setting val 30 times: ${gasUsed6}`)
    console.log(`gas used per write, setting val 40 times: ${gasUsed7}`)
    console.log(`gas used per write, setting val 50 times: ${gasUsed8}`)
}

const checkGasFromInternalCall = async() => {
    const functionCaller = await FunctionCaller.new();

    const tx1 = await functionCaller.callInternalStorageCheck();
    const tx2 = await functionCaller.rawStorageCheck();

    const gasUsed1 = tx1.receipt.gasUsed - 21000
    const gasUsed2 = tx2.receipt.gasUsed - 21000
    const diff = gasUsed1 - gasUsed2

    console.log(`Gas cost from internal function call inside public function: ${gasUsed1}`)
    console.log(`Gas cost from raw code inside public function: ${gasUsed2}`)
    console.log(`Gas cost difference between an internal call and raw code: ${diff}`)
}

async function main() {
    // await ABDKOperations()
    // await basicOperations()
    // await checkGasFromSSTORE()
    await checkGasFromInternalCall()
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });