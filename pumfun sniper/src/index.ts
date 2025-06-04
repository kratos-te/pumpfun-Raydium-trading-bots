import {
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import base58 from "bs58";
import dotnet from 'dotenv'
import { commitment, PUMP_FUN_PROGRAM } from "./constants";
import { convertHttpToWebSocket, formatDate } from "./utils/commonFunc";

import WebSocket = require("ws");
import buyToken from "./pumputils/utils/buyToken";
import { Metaplex } from "@metaplex-foundation/js";

dotnet.config();


const rpc = process.env.RPC_ENDPOINT;
console.log("🚀 RPC:", rpc)

const payer = process.env.PRIVATE_KEY;
console.log("🚀 Private Key:", `${payer?.slice(0, 6)}...`)

const isDevMode = process.env.DEV_MODE === 'true';
const devwallet = process.env.DEV_WALLET_ADDRESS;
if (isDevMode) {
    console.log("🚀 Dev Wallet:", devwallet)
}

const isTickerMode = process.env.TICKER_MODE === 'true';
const tokenTicker = process.env.TOKEN_TICKER;
if (isTickerMode) {
    console.log("🚀 Token Ticker:", tokenTicker)
}

const buyamount = process.env.BUY_AMOUNT;
console.log("🚀 Buy Amount:", buyamount)

const isGeyser = process.env.IS_GEYSER === 'true';

const init = async (rpcEndPoint: string, payer: string, solIn: number, devAddr: string) => {
    try {
        const payerKeypair = Keypair.fromSecretKey(base58.decode(payer));
        let isBuying = false;
        const connection = new Connection(rpcEndPoint, { wsEndpoint: convertHttpToWebSocket(rpcEndPoint), commitment: "confirmed" });
        const logConnection = new Connection(rpcEndPoint, { wsEndpoint: convertHttpToWebSocket(rpcEndPoint), commitment: "processed" });
        let globalLogListener: any;

        // Function to stop the listener
        const stopListener = async () => {
            if (globalLogListener !== undefined) {
                try {
                    await logConnection.removeOnLogsListener(globalLogListener);
                    isBuying = true
                } catch (err) {
                    console.log("Error stopping listener:", err);
                }
            }
        };

        console.log('--------------- Bot is Runnig Now ---------------')

        globalLogListener = logConnection.onLogs(
            PUMP_FUN_PROGRAM,
            async ({ logs, err, signature }) => {
                if (err) return
                const isMint = logs.filter(log => log.includes("MintTo")).length;
                if (isMint && !isBuying) {
                    const parsedTransaction = await logConnection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
                    if (!parsedTransaction) {
                        return;
                    }
                    console.log("New signature => ", `https://solscan.io/tx/${signature}`);
                    let dev = parsedTransaction?.transaction.message.accountKeys[0].pubkey.toString();
                    const mint = parsedTransaction?.transaction.message.accountKeys[1].pubkey;
                    if (isDevMode) {
                        console.log("Dev wallet => ", `https://solscan.io/address/${dev}`);
                    }
                    if (isDevMode && dev !== devAddr) return;

                    if (isTickerMode) {
                        if (!tokenTicker) return console.log("Token Ticker is not defiend!");
                        const tokenInfo = await getTokenMetadata(mint.toString(), connection);
                        if (!tokenInfo) return;
                        const isTarget = tokenInfo.symbol.toUpperCase().includes(tokenTicker.toUpperCase())
                        if (!isTarget) return
                        console.log(`Found $${tokenInfo.symbol} token.`)
                    }

                    console.log('New token => ', `https://solscan.io/token/${mint.toString()}`)
                    await stopListener()
                    isBuying = true;
                    const sig = await buyToken(mint, connection, payerKeypair, solIn, 1);
                    console.log('Buy Transaction => ', `https://solscan.io/tx/${sig}`)
                    if (!sig) {
                        isBuying = false;
                    } else {
                        console.log('🚀 Buy Success!!!');
                        console.log('Try to sell on pumpfun: ', `https://pump.fun/${mint.toString()}`)
                    }

                }
            },
            commitment
        );

    } catch (err) {
        console.log(err);
        return { stopListener: undefined };
    }
};

const withGaser = (rpcEndPoint: string, payer: string, solIn: number, devAddr: string) => {
    const GEYSER_RPC = process.env.GEYSER_RPC;
    if (!GEYSER_RPC) return console.log('Geyser RPC is not provided!');
    const ws = new WebSocket(GEYSER_RPC);
    const connection = new Connection(rpcEndPoint, { wsEndpoint: convertHttpToWebSocket(rpcEndPoint), commitment: "processed" });
    const payerKeypair = Keypair.fromSecretKey(base58.decode(payer))

    console.log('Your Pub Key => ', payerKeypair.publicKey.toString())

    function sendRequest(ws: WebSocket) {
        const request = {
            jsonrpc: "2.0",
            id: 420,
            method: "transactionSubscribe",
            params: [
                {
                    failed: false,
                    accountInclude: ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]
                },
                {
                    commitment: "confirmed",
                    encoding: "jsonParsed",
                    transactionDetails: "full",
                    maxSupportedTransactionVersion: 0
                }
            ]
        };
        ws.send(JSON.stringify(request));
    }

    ws.on('open', function open() {
        console.log('WebSocket is open');
        sendRequest(ws);  // Send a request once the WebSocket is open
    });

    ws.on('message', async function incoming(data) {
        const messageStr = data.toString('utf8');
        try {
            const messageObj = JSON.parse(messageStr);

            const result = messageObj.params.result;
            const logs = result.transaction.meta.logMessages;
            const signature = result.signature; // Extract the signature
            const accountKeys = result.transaction.transaction.message.accountKeys.map((ak: { pubkey: any; }) => ak.pubkey);

            if (logs && logs.some((log: string | string[]) => log.includes('Program log: Instruction: InitializeMint2'))) {
                const dev = accountKeys[0]
                const mint = accountKeys[1]

                console.log("New signature => ", `https://solscan.io/tx/${signature}`);
                if (isDevMode) {
                    console.log("Dev wallet => ", `https://solscan.io/address/${dev}`);
                }
                if (isDevMode && dev !== devAddr) return;

                if (isTickerMode) {
                    if (!tokenTicker) return console.log("Token Ticker is not defiend!");
                    const tokenInfo = await getTokenMetadata(mint.toString(), connection);
                    if (!tokenInfo) return;
                    const isTarget = tokenInfo.symbol.toUpperCase().includes(tokenTicker.toUpperCase())
                    if (!isTarget) return
                    console.log(`Found $${tokenInfo.symbol} token.`)
                }

                console.log('New token => ', `https://solscan.io/token/${mint.toString()}`)
                ws.close();
                const mintPub = new PublicKey(mint);
                const sig = await buyToken(mintPub, connection, payerKeypair, solIn, 1);
                console.log('Buy Transaction => ', `https://solscan.io/tx/${sig}`)
                if (!sig) {
                    ws.on('open', function open() {
                        console.log('WebSocket is open');
                        sendRequest(ws);  // Send a request once the WebSocket is open
                    });
                } else {
                    console.log('🚀 Buy Success!!!');
                    console.log('Try to sell on pumpfun: ', `https://pump.fun/${mint.toString()}`)
                }

            }
        } catch (e) {

        }
    });

}

const runBot = () => {
    if (isGeyser) {
        console.log('--------------- Geyser mode selected! ---------------\n');
        withGaser(rpc!, payer!, Number(buyamount!), devwallet!);
    } else {
        console.log("--------------- Common Mode selected! ---------------\n");
        init(rpc!, payer!, Number(buyamount!), devwallet!)
    }
}

const getTokenMetadata = async (mintAddress: string, connection: Connection) => {
    try {
        const metaplex = Metaplex.make(connection);
        const mintPublicKey = new PublicKey(mintAddress);
        const nft = await metaplex.nfts().findByMint({ mintAddress: mintPublicKey });
        return nft;  // Returns the token's ticker/symbol
    } catch (error) {
        //   console.error("Error fetching token metadata:", error);
        return false
    }
};

runBot()