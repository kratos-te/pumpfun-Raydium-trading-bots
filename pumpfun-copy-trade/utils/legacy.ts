import { Connection, VersionedTransaction } from "@solana/web3.js";
import { RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "../constants";


interface Blockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}

export const execute = async (transaction: VersionedTransaction) => {
  const solanaConnection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
  })

  // const signature = await solanaConnection.sendRawTransaction(transaction.serialize(), {
  //   skipPreflight: true,
  //   maxRetries: 3,
  //   preflightCommitment: 'confirmed',
  // })
  const signature = await solanaConnection.sendTransaction(transaction);
  // console.log("🚀 ~ execute ~ signature:", `https://solscan.io/tx/${signature}`)
  // const confirmation = await solanaConnection.confirmTransaction(signature);
  // console.log("🚀 ~ execute ~ confirmation:", confirmation)

  // if (confirmation.value.err) {
  //   console.log("Confrimtaion error")
  //   return ""
  // } else {
  // if (isBuy)
  //   console.log(`Success in buy transaction: https://solscan.io/tx/${signature}`)
  // else
  //   console.log(`Success in Sell transaction: https://solscan.io/tx/${signature}`)
  // // }
  return signature
}
