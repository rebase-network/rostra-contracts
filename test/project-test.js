const { expect } = require("chai")
const { ethers } = require('hardhat')

describe("Project contract", function () {
    let projectContractFactory
    let projectContract
    let creator
    let donator1
    let donator2

    const sevenDays = 7 * 24 * 60 * 60

    beforeEach(async function () {
        [creator, donator1, donator2] = await ethers.getSigners()
        projectContractFactory = await ethers.getContractFactory("Project")

        const name = "Research Uni V3"
        const description = "We will produce 3 videos"
        const timeToSubmitWork = parseInt(new Date().getTime()/1000) + sevenDays

        projectContract = await projectContractFactory.deploy(
            creator.address,
            name,
            description,
            timeToSubmitWork
        )

        expect(projectContract.address).to.not.be.null

        const nftInfo = {
            name: "Research Uni V3",
            symbol: "RUV3",
            uri: "https://rostra.xyz/api/nft-uri?id=",
            price: 10, // dai
            limit: 100,
            creator: 20 // creator nft amount
        }

        await projectContract.setNFTInfo(
            nftInfo.name,
            nftInfo.symbol,
            nftInfo.uri,
            nftInfo.price,
            nftInfo.limit,
            nftInfo.creator
        )
    })

    it('Get project details', async function () {
        const projectDetail = await projectContract.getDetails()
        expect(projectDetail.creator).to.equal(creator.address)
        expect(projectDetail.description).to.equal(description)
        expect(projectDetail.timeToSubmitWork).to.equal(timeToSubmitWork)
    })

    it('Buy 10 NFTs', async function () {
        const nftContractAddress = await projectContract.getNFTAddress()
        expect(nftContractAddress).to.notEmpty()

        const nftTotalBefore = nftContractAddress.totalSupply()
        expect(nftTotalBefore).to.equal(1)

        const nftAmountToBuy = 10

        await projectContract.connect(donator1).contribute(nftAmountToBuy)

        expect(await projectContract.currentBalance()).to.equal(nftAmountToBuy * nftInfo.price) // 100

        const nftTotalAfter = nftContractAddress.totalSupply()
        expect(nftTotalAfter).to.equal(10)

    })

    xit('Funding failed, user get refund', async function () {
        await projectContract.connect(donator1).contribute({ value: 90 })

        expect(await projectContract.currentBalance()).to.equal(90)

        const blockNumBefore = await ethers.provider.getBlockNumber()
        const blockBefore = await ethers.provider.getBlock(blockNumBefore)
        const timestampBefore = blockBefore.timestamp

        await ethers.provider.send('evm_increaseTime', [sevenDays])
        await ethers.provider.send('evm_mine')

        const blockNumAfter = await ethers.provider.getBlockNumber()
        const blockAfter = await ethers.provider.getBlock(blockNumAfter)
        const timestampAfter = blockAfter.timestamp

        expect(blockNumAfter).to.be.equal(blockNumBefore + 1)
        expect(timestampAfter).to.be.equal(timestampBefore + sevenDays)

        await projectContract.connect(donator2).contribute({ value: 9 })

        expect(await projectContract.currentBalance()).to.equal(99)

        expect(await projectContract.state()).to.equal(1)

        await projectContract.connect(donator1).getRefund()

        expect(await projectContract.currentBalance()).to.equal(9)

        await projectContract.connect(donator2).getRefund()

        expect(await projectContract.currentBalance()).to.equal(0)
    })

    // todo
    xit('Creator does not submit work before deadline, investors get 100% refund', async function () {
        await projectContract.connect(donator1).contribute({ value: 100 })
        await projectContract.connect(donator2).contribute({ value: 100 })

        await ethers.provider.send('evm_increaseTime', [sevenDays])
        await ethers.provider.send('evm_mine')

        await projectContract.connect(donator1).getRefund() // donator1 get refund 50%(50)
        expect(await projectContract.currentBalance()).to.equal(100)

        await projectContract.connect(donator2).getRefund() // donator2 get refund 50%(50)
        expect(await projectContract.currentBalance()).to.equal(0)
    })


    // Funding succeeds, creator start to work automatically, count down time
    describe('Creator submit work before deadline', async function () {
        console.log('projectContract: ', projectContract)
        await projectContract.connect(donator1).contribute({ value: 100 })
        await projectContract.connect(donator2).contribute({ value: 100 })
        const workResult = {
            name: 'Uni V3 analysis video',
            desc: 'Hope you enjoy our work',
            url: 'https://rostra.xyz/projects/0'
        }

        // todo
        await projectContract.finishWork(workResult)

        expect(await projectContract.state()).to.equal(3)   // work submitted

        xit('Creator can get money after 7 days', async function () {
            // todo
            expect(await projectContract.checkIfFundingCompleteOrExpired()).revertedWithError(Error('Project is not complete'))

            await ethers.provider.send('evm_increaseTime', [sevenDays])
            await ethers.provider.send('evm_mine')

            expect(await projectContract.currentBalance()).to.equal(200)

            await projectContract.checkIfFundingCompleteOrExpired()

            expect(await projectContract.currentBalance()).to.equal(0)
        })

        // todo
        xit('Investors do not oppose, there will be a NFT minted', async function () {
            const nftContractAddress = await projectContract.getNFTAddress()
            expect(nftContractAddress).to.notEmpty()

            const nftTotal = nftContractAddress.totalSupply()
            expect(nftTotal).to.equal(1)
        })

        // todo
        xit('Investors do not oppose, they can claim erc20 token per investment', async function () {
            const creatorBalance = await projectContract.getUserERC20Balance(creator.address)
            expect(creatorBalance).to.be.equal(2000)

            const donator1Balance = await projectContract.getUserERC20Balance(donator1.address)
            expect(donator1Balance).to.be.equal(4000)

            const donator2Balance = await projectContract.getUserERC20Balance(donator2.address)
            expect(donator2Balance).to.be.equal(4000)

        })
    })

    // Funding succeeds, creator start to work automatically, count down time
    describe('Creator submit work before deadline, but get oppose', async function () {
        await projectContract.connect(donator1).contribute({ value: 100 })
        await projectContract.connect(donator2).contribute({ value: 100 })
        const workResult = {
            name: 'Uni V3 analysis video',
            desc: 'Hope you enjoy our work',
            url: 'https://rostra.xyz/projects/0'
        }

        // todo
        await projectContract.finishWork(workResult)

        expect(await projectContract.state()).to.equal(3)
        expect(await projectContract.currentBalance()).to.equal(200)

        // todo: oppose the work
        xit('Investors oppose, but do not reach 67% votes in 7 days, creator can get 100% money', async function () {
            await projectContract.connect(donator1).opposeWork()

            expect(await projectContract.state()).to.equal(4)  // in voting state

            expect(await projectContract.connect(donator1).getRefund()).revertedWithError(Error('Can not refund'))

            expect(await projectContract.checkIfFundingCompleteOrExpired()).revertedWithError(Error('Need to wait until appeal ends'))

            await ethers.provider.send('evm_increaseTime', [sevenDays])
            await ethers.provider.send('evm_mine')

            expect(await projectContract.connect(donator1).getRefund()).revertedWithError(Error('Can not refund'))

            await projectContract.checkIfFundingCompleteOrExpired()
            expect(await projectContract.currentBalance()).to.equal(0)
        })
    })

    // Funding succeeds, creator start to work automatically, count down time
    describe('Creator submit work before deadline, but get oppose', async function () {
        await projectContract.connect(donator1).contribute({ value: 100 })
        await projectContract.connect(donator2).contribute({ value: 100 })
        const workResult = {
            name: 'Uni V3 analysis video',
            desc: 'Hope you enjoy our work',
            url: 'https://rostra.xyz/projects/0'
        }

        // todo
        await projectContract.finishWork(workResult)

        expect(await projectContract.state()).to.equal(3)
        expect(await projectContract.currentBalance()).to.equal(200)

        // todo: oppose the work
        xit('Investors oppose, and reach 67% votes in 7 days, creator can get 50% money, investors get 50% refund', async function () {
            await projectContract.connect(donator1).opposeWork()

            expect(await projectContract.checkIfFundingCompleteOrExpired()).revertedWithError(Error('Need to wait until appeal ends'))

            await projectContract.connect(donator2).opposeWork()

            expect(await projectContract.state()).to.equal(5)  // in refunded state

            await projectContract.connect(donator1).getRefund() // donator1 get refund 50%(50)
            expect(await projectContract.currentBalance()).to.equal(150)

            await projectContract.connect(donator2).getRefund() // donator2 get refund 50%(50)
            expect(await projectContract.currentBalance()).to.equal(100)

            await projectContract.checkIfFundingCompleteOrExpired() // creator get left 50%(100)
            expect(await projectContract.currentBalance()).to.equal(0)
        })
    })
})

