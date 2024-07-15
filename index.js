const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
require('dotenv').config()
const { WebSocketProvider } = require('@ethersproject/providers')
const { Wallet } = require('@ethersproject/wallet')
const { ChainId, Token, WETH, Fetcher, Route } = require('@uniswap/sdk')
const {
  abi: IUniswapV2Router02ABI,
} = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const {
  abi: ERC20ABI,
} = require('@openzeppelin/contracts/build/contracts/ERC20.json')
const ArbData = require('./data/arbitrum.json')

const app = express()
app.use(cors())
app.get('/', (req, res) => {
  res.send('this is test router')
})

let botInterval

const config = {
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  WEBSOCKET_PROVIDER: process.env.WEBSOCKET_PROVIDER,
  ARB_CONTRACT: process.env.ARB_CONTRACT,
  DUCASWAP_ROUTER_ADDRESS: process.env.DUCASWAP_ROUTER_ADDRESS,
  LIMIT_TIME: process.env.LIMIT_TIME,
  INITIAL_USDC: process.env.INITIAL_USDC,
}

const provider = new WebSocketProvider(config.WEBSOCKET_PROVIDER)
const signer = new Wallet(config.PRIVATE_KEY, provider)

async function getPrice(tokenA, tokenB) {
  const pair = await Fetcher.fetchPairData(tokenA, tokenB, provider)
  console.log(pair)
  const route = new Route([pair], tokenA)
  return route.midPrice.toSignificant(6)
}

async function approveToken(tokenAddress, spenderAddress, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, signer)
  const tx = await tokenContract.approve(
    spenderAddress,
    ethers.utils.parseUnits(amount.toString(), 18)
  )
  console.log(`Approval transaction hash: ${tx.hash}`)
  await tx.wait()
  console.log(`Token approved`)
}

async function executeTrade(tokenIn, tokenOut, amountIn, amountOutMin, isETH) {
  const router = new ethers.Contract(
    config.DUCASWAP_ROUTER_ADDRESS,
    IUniswapV2Router02ABI,
    signer
  )

  const deadline = Math.floor(Date.now() / 1000) + 60 * config.LIMIT_TIME
  const path = [tokenIn, tokenOut]

  let tx
  if (isETH) {
    tx = await router.swapExactETHForTokens(
      ethers.utils.parseUnits(amountOutMin.toString(), tokenIn.decimals),
      path,
      wallet.address,
      deadline,
      { value: ethers.utils.parseUnits(amountIn.toString(), 'ether') }
    )
  } else {
    tx = await router.swapExactTokensForTokens(
      ethers.utils.parseUnits(amountIn.toString(), amountIn.decimals),
      ethers.utils.parseUnits(amountOutMin.toString(), amountOutMin.decimals),
      path,
      wallet.address,
      deadline
    )
  }

  console.log(`transaction hash: ${tx.hash}`)
  await tx.wait()
  console.log('Transaction confirmed')
}

async function startBot() {
  console.log('bot is started')
  const USDC = new Token(
    ChainId.MAINNET,
    ArbData.USDC.address,
    ArbData.USDC.Decimal
  )
  const DCM = new Token(
    ChainId.MAINNET,
    ArbData.DCM.address,
    ArbData.DCM.Decimal
  )
  const ETH = WETH[ChainId.MAINNET]
  const ethToUsdc = await getPrice(ETH, USDC)
   const dcmToUsdc = await getPrice(DCM, USDC)
   const ethToDcm = await getPrice(ETH, DCM)

   const ethAmount = INITIAL_USDC / ethToUsdc
   const dcmAmountFromEth = ethAmount / ethToDcm
   const finalUSDC = dcmAmountFromEth * dcmToUsdc

   const profit = finalUSDC - INITIAL_USDC
   if (profit > 0) {
     console.log('Arbitrage opportunity detected')
     await executeTrade(WETH.address, USDC.address, ethAmount, true)
     await approveToken(WETH.address, DUCASWAP_ROUTER_ADDRESS, ethAmount)
     await approveToken(DCM.address, DUCASWAP_ROUTER_ADDRESS, dcmAmountFromEth)
     await executeTrade(
       WETH.address,
       DCM.address,
       ethAmount,
       dcmAmountFromEth,
       false
     )
     await executeTrade(
       DCM.address,
       USDC.address,
       dcmAmountFromEth,
       finalUSDC,
       false
     )
   } else {
     console.log('No arbitrage opportunity found')
   }
}

 if (botInterval) clearInterval(botInterval)

startBot()

app.listen(process.env.PORT || 5000, function () {
  return console.log(`Server is running on ${process.env.PORT || 5000}`)
})
