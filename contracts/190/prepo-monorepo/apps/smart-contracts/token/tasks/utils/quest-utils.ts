import axios from "axios"
import { BigNumberish, Signer } from "ethers"
import { arrayify, solidityKeccak256 } from "ethers/lib/utils"

const questBookUrl = "https://europe-west1-mstable-questbook.cloudfunctions.net/questbook"

export const signUserQuests = async (user: string, questIds: BigNumberish[], questSigner: Signer): Promise<string> => {
    const messageHash = solidityKeccak256(["address", "uint256[]"], [user, questIds])
    const signature = await questSigner.signMessage(arrayify(messageHash))
    return signature
}

export const signQuestUsers = async (questId: BigNumberish, users: string[], questSigner: Signer): Promise<string> => {
    const messageHash = solidityKeccak256(["uint256", "address[]"], [questId, users])
    const signature = await questSigner.signMessage(arrayify(messageHash))
    return signature
}

export const getQueuedUsersForQuest = async (questId: number): Promise<string[]> => {
    // get users who have completed quests from the queue
    const response = await axios.post(questBookUrl, {
        query: `query { queue { userId ethereumId } }`,
    })
    const { queue } = response?.data?.data
    if (!queue) {
        console.log(response?.data)
        throw Error(`Failed to get quests from queue`)
    }
    // filter users to just the requested quest identifier
    const usersInQueue = queue.filter((quest) => quest.ethereumId === questId)
    const usersForQuest = usersInQueue.map((quest) => quest.userId)

    return usersForQuest
}

export const hasUserCompletedQuest = async (user: string, questName: string): Promise<boolean> => {
    const response = await axios.post(questBookUrl, {
        query: `query { user(userId: "${user}") { quests {
            id
            complete
            progress
          } } }`,
    })
    const quests = response?.data?.data?.user?.quests
    if (!quests) {
        console.log(response?.data)
        throw Error(`Failed to get quests for user ${user}`)
    }

    // Filter user's quest for the named quest. eg theGreatMigration
    const quest = quests.find((q) => q.id === `${questName}.${user}`)

    return quest?.complete
}
