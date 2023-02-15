// TODO: Eventually avoid conditionally loading from hardhat
// using global web3 variable injected by truffle

import {web3} from "hardhat"
import {constants} from "../../utils/constants"

const DUMMY_TICKET_CREATION_ROUND = 10
const DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH = web3.utils.keccak256("foo")

const createTicket = ticketObj => {
    ticketObj = ticketObj ? ticketObj : {}

    return {
        recipient: isSet(ticketObj.recipient) ?
            ticketObj.recipient :
            constants.NULL_ADDRESS,
        sender: isSet(ticketObj.sender) ?
            ticketObj.sender :
            constants.NULL_ADDRESS,
        faceValue: isSet(ticketObj.faceValue) ? ticketObj.faceValue : 0,
        winProb: isSet(ticketObj.winProb) ? ticketObj.winProb : 0,
        senderNonce: isSet(ticketObj.senderNonce) ? ticketObj.senderNonce : 0,
        recipientRandHash: isSet(ticketObj.recipientRandHash) ?
            ticketObj.recipientRandHash :
            constants.NULL_BYTES,
        auxData: isSet(ticketObj.auxData) ? ticketObj.auxData : defaultAuxData()
    }
}

const createWinningTicket = (
    recipient,
    sender,
    recipientRand,
    faceValue = 0,
    auxData = defaultAuxData()
) => {
    const recipientRandHash = web3.utils.soliditySha3(recipientRand)
    const ticketObj = {
        recipient,
        sender,
        faceValue,
        winProb: constants.MAX_UINT256.toString(),
        recipientRandHash,
        auxData
    }

    return createTicket(ticketObj)
}

const getTicketHash = ticketObj => {
    return web3.utils.soliditySha3(
        ticketObj.recipient,
        ticketObj.sender,
        ticketObj.faceValue,
        ticketObj.winProb,
        ticketObj.senderNonce,
        ticketObj.recipientRandHash,
        ticketObj.auxData
    )
}

const defaultAuxData = () =>
    createAuxData(
        DUMMY_TICKET_CREATION_ROUND,
        DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH
    )

const createAuxData = (creationRound, blockHash) => {
    return web3.eth.abi.encodeParameters(
        ["uint256", "bytes32"],
        [creationRound, blockHash]
    )
}

const isSet = v => {
    return typeof v != undefined && v != null
}

module.exports = {
    createAuxData,
    createTicket,
    createWinningTicket,
    getTicketHash,
    DUMMY_TICKET_CREATION_ROUND,
    DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH
}
