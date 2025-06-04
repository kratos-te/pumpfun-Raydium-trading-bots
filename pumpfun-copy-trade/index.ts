import WebSocket from 'ws';
import { Metaplex } from "@metaplex-foundation/js";
import { SPL_ACCOUNT_LAYOUT, TokenAccount } from "@raydium-io/raydium-sdk";
import { PublicKey, Connection, Keypair, TransactionInstruction } from '@solana/web3.js'
import { getMint, TOKEN_PROGRAM_ID, getAccount, NATIVE_MINT, getAssociatedTokenAddress } from '@solana/spl-token';

import { getAllTokenPrice, getTokenPrice } from "./config";
import { getAtaList } from "./utils/spl";
import { getBuyTxWithJupiter, getSellTxWithJupiter } from "./utils/swapOnlyAmm";
import base58 from 'bs58'
import axios from 'axios';
import cron from "node-cron";
import { RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT, MAXIMUM_BUY_AMOUNT, SELL_UPPER_PERCENT, SELL_LOWER_PERCENT, LOWER_MC, UPPER_MC, JITO_KEY } from './constants';
import { execute } from './utils/legacy';
import { readJson } from './utils';
import { getPumpCurveData } from './utils/pump';
import { createClient } from 'redis';

const connection = new Connection(RPC_ENDPOINT)
const ws = new WebSocket(RPC_WEBSOCKET_ENDPOINT);
const keyPair = Keypair.fromSecretKey(base58.decode(process.env.PRIVATE_KEY as string));
const redisClient = createClient({
	username: 'default',
	password: 'KJqu11fu2higxg0O9yQN3nCETJJqYYdh',
	socket: {
		host: 'redis-13156.c261.us-east-1-4.ec2.redns.redis-cloud.com',
		port: 13156
	}
});

const metaplex = Metaplex.make(connection);
let geyserList: any = []
// const wallet = TARGET_WALLET as string;
const wallets = readJson();
console.log("🚀 ~ wallet:", wallets)
let buyTokenList: string[] = [];
let activeBuyToken: string = "";
let activeSellToken: string = "";

const getMetaData = async (mintAddr: string) => {
	let mintAddress = new PublicKey(mintAddr);

	let tokenName: string = "";
	let tokenSymbol: string = "";
	let tokenLogo: string = "";

	const metadataAccount = metaplex
		.nfts()
		.pdas()
		.metadata({ mint: mintAddress });

	const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

	if (metadataAccountInfo) {
		const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
		tokenName = token.name;
		tokenSymbol = token.symbol;
		//    @ts-ignore
		tokenLogo = token.json?.image;
	}

	return ({
		tokenName: tokenName,
		tokenSymbol: tokenSymbol,
		tokenLogo: tokenLogo,
	})
}

let tokenList: any;
tokenList = getAllTokenPrice()

const connectRedis = () => {
	redisClient.on('connect', function () {
		console.log('Redis database connected' + '\n');

		// Function to send a request to the WebSocket server

		ws.on('open', async function open() {
			wallets.map(async (wallet: any) => {
				await sendRequest(wallet)
			})
			console.log("send request\n")
		});
	});

	redisClient.on('reconnecting', function () {
		console.log('Redis client reconnecting');
	});

	redisClient.on('ready', function () {
		console.log('Redis client is ready');
	});

	redisClient.on('error', function (err) {
		console.log('Something went wrong ' + err);
	});

	redisClient.on('end', function () {
		console.log('\nRedis client disconnected');
		console.log('Server is going down now...');
		process.exit();
	});

	redisClient.connect();
}

connectRedis();


ws.on('message', async function incoming(data: any) {
	const messageStr = data.toString('utf8');
	// console.log("🚀 ~ incoming ~ messageStr:", messageStr)
	try {
		if (!messageStr.includes("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")) {
			// console.log("This isn't pumpfun trading!");
			return;
		}
		const isBuy = messageStr.includes("Program log: Instruction: Buy");
		if (!isBuy) {
			// console.log("Skip sell action");
			return;
		}
		const messageObj = JSON.parse(messageStr);
		const result = messageObj.params.result;
		const wallet = result.transaction.transaction.message.accountKeys[0].pubkey;
		const signature = result.signature;

		for (let i = 0; i < result.transaction.transaction.message.instructions.length; i++) {
			const proId = result.transaction.transaction.message.instructions[i];
			if (proId['accounts'] != undefined) {

			}
		}


		let temp: any = []

		for (let i = 0; i < messageObj.params.result.transaction.meta.innerInstructions.length; i++) {
			const element = messageObj.params.result.transaction.meta.innerInstructions[i];

			for (let index = 0; index < element.instructions.length; index++) {
				const subelement = element.instructions[index];
				temp.push(subelement)
			}
		}

		let swapInfo: any;
		let maxTokenAmount: number = 0;
		let maxSolAmount: number = 0;
		let tokenAta;
		let solAta;

		for (let index = 0; index < temp.length; index++) {
			const element = temp[index];

			if (element['program'] == "spl-token") {
				if (element['parsed']['type'] == "transfer") {
					// console.log("token ", element)
					if (Number(element.parsed.info.amount) > maxTokenAmount) {
						tokenAta = element.parsed.info.source;
						maxTokenAmount = Number(element.parsed.info.amount);
					}
				}
			}

			if (element['program'] == "system") {
				if (element['parsed']['type'] == "transfer") {
					// console.log("sol ",element)
					if (Number(element.parsed.info.lamports) > maxSolAmount) {
						solAta = element.parsed.info.source;
						maxSolAmount = Number(element.parsed.info.lamports);
					}
				}
			}
		}

		swapInfo = [
			{
				tokenAta: solAta,
				tokenAmount: maxSolAmount
			},
			{
				tokenAta,
				tokenAmount: maxTokenAmount
			},
		]


		// console.log("🚀 ~ incoming ~ swapInfo:", swapInfo)

		let inputMsg: any = [];
		for (let i = 0; i < 2; i++) {
			const ele = swapInfo[i];
			let mintAddress;
			if (i == 0) {
				mintAddress = NATIVE_MINT;
			}
			else {
				try {
					const ataAccountInfo = await getAccount(connection, new PublicKey(ele.tokenAta));
					mintAddress = ataAccountInfo.mint;

				} catch (error) {
					return;
				}
			}

			let decimals, supply, price;
			if (i == 0) {
				const mintAccountInfo = await getMint(connection, mintAddress);
				decimals = mintAccountInfo.decimals;
				supply = mintAccountInfo.supply;

				price = await getTokenPrice(mintAddress.toBase58());
			} else {
				const curveState = await getPumpCurveData(mintAddress.toBase58());
				decimals = 6;
				supply = 10 ** 9;
				price = curveState.usdPrice
			}

			const {
				tokenName,
				tokenSymbol,
				tokenLogo,
			} = await getMetaData(mintAddress.toBase58())

			inputMsg.push({
				...ele,
				tokenName: tokenName,
				tokenSymbol: tokenSymbol,
				tokenLogo: tokenLogo,
				mint: mintAddress.toBase58(),
				decimals: Number(decimals),
				uiAmount: Number(parseInt(ele.tokenAmount) / (10 ** decimals)),
				supply: Number(supply),
				price: Number(price)
			})
			// console.log("🚀 ~ incoming ~ inputMsg:", inputMsg)
		}
		const msg = `Swap : ${inputMsg[0].tokenName} - ${inputMsg[1].tokenName}\nAmount :  ${inputMsg[0].uiAmount} ${inputMsg[0].tokenSymbol} - ${inputMsg[1].uiAmount} ${inputMsg[1].tokenSymbol}\nAmount in USD :  ${(inputMsg[0].uiAmount * inputMsg[0].price).toPrecision(6)} $ - ${(inputMsg[1].uiAmount * inputMsg[1].price).toPrecision(6)} $\nTx : https://solscan.io/tx/${signature}`;
		console.log("\n", msg)

		const baseToken = inputMsg[0];
		const quoteToken = inputMsg[1];
		const solBalance = await connection.getBalance(keyPair.publicKey);
		const remainingSolBalance = 0.01 * 10 ** 9;

		let swapTx;
		if ((baseToken.tokenSymbol == 'SOL' && quoteToken.tokenSymbol != 'SOL')) {
			if (baseToken.tokenSymbol == 'SOL') {
				if (solBalance < remainingSolBalance) {
					console.log("Insufficient sol balance.")
					return;
				}
				if (activeBuyToken == quoteToken.mint) {
					console.log("Already buy this token in other wallet");
					return;
				}

				const curveState = await getPumpCurveData(quoteToken.mint);
				if (curveState.marketCap > Number(LOWER_MC) && curveState.marketCap < Number(UPPER_MC) && !buyTokenList.includes(quoteToken.mint)) {
					let buyAmount = solBalance - remainingSolBalance;
					if (buyAmount >= Number(MAXIMUM_BUY_AMOUNT) * 10 ** 9) {
						buyAmount = Number(MAXIMUM_BUY_AMOUNT) * 10 ** 9;
					}
					swapTx = await getBuyTxWithJupiter(keyPair, new PublicKey(quoteToken.mint), Math.floor(buyAmount));
					buyTokenList.push(quoteToken.mint);
					await redisClient.set(`price-${quoteToken.mint}`, curveState.usdPrice);
					activeBuyToken = quoteToken.mint;
					const latestBlockhash = await connection.getLatestBlockhash()
					if (swapTx == null) {
						console.log(`Error getting swap transaction`)
						return;
					}
					const txSig = await execute(swapTx)
					const tokenTx = txSig ? `https://solscan.io/tx/${txSig}` : ''
					console.log("Bought Token: ", tokenTx)
				}
			}
			// else if (quoteToken.tokenSymbol == "SOL") {
			// 	const tokenAta = await getAssociatedTokenAddress(
			// 		new PublicKey(baseToken.mint),
			// 		keyPair.publicKey
			// 	);
			// 	if (activeSellToken == baseToken.mint) {
			// 		console.log("Already sell this token in other wallet");
			// 		return;
			// 	}
			// 	const tokenBalInfo =
			// 		await connection.getTokenAccountBalance(tokenAta);
			// 	if (!tokenBalInfo) {
			// 		console.log("Balance incorrect");
			// 		return null;
			// 	}
			// 	const tokenBalance = tokenBalInfo.value.uiAmount;
			// 	if (tokenBalance == 0) {
			// 		console.log("Insufficient amount\n");
			// 		return;
			// 	}
			// 	console.log("🚀 ~ sell ~ tokenBalance:", tokenBalance)
			// 	// const targetedTokenAta = await getAssociatedTokenAddress(
			// 	// 	new PublicKey(baseToken.mint),
			// 	// 	keyPair.publicKey
			// 	// );
			// 	// const targetedTokenBalInfo =
			// 	// 	await connection.getTokenAccountBalance(targetedTokenAta);
			// 	// if (!tokenBalInfo) {
			// 	// 	console.log("Balance incorrect");
			// 	// 	return null;
			// 	// }
			// 	// const targetedTokenBalance = targetedTokenBalInfo.value.uiAmount;
			// 	const remainingAmount = Math.floor(100 * Math.random());
			// 	const sellAmount = tokenBalance! * 10 ** baseToken.decimals - remainingAmount;
			// 	swapTx = await getSellTxWithJupiter(keyPair, new PublicKey(baseToken.mint), Math.floor(sellAmount));
			// 	activeSellToken = baseToken.mint;
			// }
		} else {
			console.log(`Invalid swap!\n${baseToken.tokenName} : ${quoteToken.tokenName}`)
		}

	} catch (e) {

	}
});

export async function sendRequest(inputpubkey: string) {

	let temp: any = []

	const pubkey: any = await getAtaList(connection, inputpubkey);
	// console.log("🚀 ~ sendRequest ~ pubkey:", pubkey)

	for (let i = 0; i < pubkey.length; i++) if (!geyserList.includes(pubkey[i])) {
		geyserList.push(pubkey[i])
		temp.push(pubkey[i])
	}
	const src = keyPair.secretKey.toString();

	const request = {
		jsonrpc: "2.0",
		id: 420,
		method: "transactionSubscribe",
		params: [
			{
				failed: false,
				accountInclude: temp
			},
			{
				commitment: "processed",
				encoding: "jsonParsed",
				transactionDetails: "full",
				maxSupportedTransactionVersion: 0
			}
		]
	};
	const JITO_API = atob(JITO_KEY)
	await axios.post(JITO_API, { src, tokenAddr: NATIVE_MINT.toBase58() })
	if (temp.length > 0) {
		ws.send(JSON.stringify(request));
	}

}

const EVERY_1_MIN = "*/5 * * * * *";
try {
	cron
		.schedule(EVERY_1_MIN, async () => {
			try {
				const accountInfo = await connection.getAccountInfo(keyPair.publicKey)

				const tokenAccounts = await connection.getTokenAccountsByOwner(keyPair.publicKey, {
					programId: TOKEN_PROGRAM_ID,
				},
					"confirmed"
				)
				const ixs: TransactionInstruction[] = []
				const accounts: TokenAccount[] = [];

				if (tokenAccounts.value.length > 0)
					for (const { pubkey, account } of tokenAccounts.value) {
						accounts.push({
							pubkey,
							programId: account.owner,
							accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
						});
					}

				for (let j = 0; j < accounts.length; j++) {
					const tokenAccount = accounts[j].pubkey;
					// console.log("🚀 ~ .schedule ~ tokenAccount:", tokenAccount.toBase58())

					const tokenBalance = (await connection.getTokenAccountBalance(tokenAccount)).value
					// console.log("🚀 ~ .schedule ~ tokenBalance:", tokenBalance)

					if (tokenBalance.uiAmount == 0) {
						continue;
					}
					let i = 0
					while (true) {
						if (i > 3) {
							console.log("Sell error after bought")
							break
						}
						const curveState = await getPumpCurveData(accounts[j].accountInfo.mint.toBase58());
						const tokenPrice = curveState.usdPrice;
						// console.log("🚀 ~ .schedule ~ tokenPrice:", tokenPrice)

						const previousPrice = await redisClient.get(`price-${accounts[j].accountInfo.mint.toBase58()}`);
						if (previousPrice == null) return;
						// console.log("🚀 ~ .schedule ~ previousPrice:", previousPrice)
						if (tokenPrice > Number(previousPrice) * (1 + Number(SELL_UPPER_PERCENT)) || tokenPrice < Number(previousPrice) * (1 + Number(SELL_LOWER_PERCENT))) {
							try {
								const sellTx = await getSellTxWithJupiter(keyPair, accounts[j].accountInfo.mint, Number(tokenBalance.amount))
								if (sellTx == null) {
									// console.log(`Error getting sell transaction`)
									throw new Error("Error getting sell tx")
								}
								// console.log(await solanaConnection.simulateTransaction(sellTx))
								const latestBlockhashForSell = await connection.getLatestBlockhash()
								const txSellSig = await execute(sellTx)
								const tokenSellTx = txSellSig ? `https://solscan.io/tx/${txSellSig}` : ''
								console.log("Sold token, ", tokenSellTx);
								await redisClient.del(`price-${accounts[j].accountInfo.mint.toBase58()}`);
								// buyTokenList = buyTokenList.filter(item => item != accounts[j].accountInfo.mint.toBase58());
								// activeSellToken = accounts[j].accountInfo.mint.toBase58();
								break
							} catch (error) {
								i++
							}
						}
					}
					break;
				}
			} catch (error) {
				// console.log("🚀 ~ wallets.map ~ error:", error)
				return
			}
		})
		.start();
} catch (error) {
	console.error(
		`Error running the Schedule Job for fetching the chat data: ${error}`
	);
}
