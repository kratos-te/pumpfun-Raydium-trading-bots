import * as token from "@solana/spl-token";
import * as web3 from "@solana/web3.js";
import getBondingCurvePDA from "./getBondingCurvePDA";
import tokenDataFromBondingCurveTokenAccBuffer from "./tokenDataFromBondingCurveTokenAccBuffer";
import getBuyPrice from "./getBuyPrice";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { BN } from "bn.js";
import { PumpFun } from "../idl/pump-fun";
import IDL from "../idl/pump-fun.json";
import getBondingCurveTokenAccountWithRetry from "./getBondingCurveTokenAccountWithRetry";
import { SystemProgram, TransactionMessage } from "@solana/web3.js";
import { executeJitoTx } from "../../utils/jito";

const BOANDING_CURVE_ACC_RETRY_AMOUNT = 5;
const BOANDING_CURVE_ACC_RETRY_DELAY = 50;


interface Payload {
  transaction: TransactionMessages;
}

interface TransactionMessages {
  content: string;
}

async function buyToken(
  mint: web3.PublicKey,
  connection: web3.Connection,
  keypair: web3.Keypair,
  solAmount: number,
  slippage: number,
  priorityFee?: number
) {
  try {
    // Load Pumpfun provider
    const provider = new AnchorProvider(connection, new Wallet(keypair), {
      commitment: "finalized",
    });
    const program = new Program<PumpFun>(IDL as PumpFun, provider);

    // Create transaction
    const transaction = new web3.Transaction();

    const tokenAccounts = await connection.getTokenAccountsByOwner(
      keypair.publicKey,
      {
        mint: mint,
      }
    );
    console.log("🚀 ~ tokenAccounts:", tokenAccounts)

    // Get/Create token account
    const associatedUser = await token.getAssociatedTokenAddress(mint, keypair.publicKey, false);

    if (tokenAccounts.value.length !== 0) {
      // await token.getAccount(connection, associatedUser, "finalized");
    } else {
      transaction.add(
        token.createAssociatedTokenAccountInstruction(keypair.publicKey, associatedUser, keypair.publicKey, mint)
      );
    }
    // console.log("Account created/loaded");

    // Buy token on Pump.fun
    // console.log("Buying");
    const programId = new web3.PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

    const bondingCurve = getBondingCurvePDA(mint, programId);
    const associatedBondingCurve = await token.getAssociatedTokenAddress(mint, bondingCurve, true);
    // let BondingCurveTokenAccount: web3.AccountInfo<Buffer> | null = null;

    const bondingCurveTokenAccount = await getBondingCurveTokenAccountWithRetry(
      connection,
      bondingCurve,
      BOANDING_CURVE_ACC_RETRY_AMOUNT,
      BOANDING_CURVE_ACC_RETRY_DELAY
    );

    if (bondingCurveTokenAccount === null) {
      throw new Error("Bonding curve account not found");
    }
    const tokenData = tokenDataFromBondingCurveTokenAccBuffer(bondingCurveTokenAccount!.data);
    if (tokenData.complete) {
      throw new Error("Bonding curve already completed");
    }
    console.log('transfer sol amount => ', solAmount);
    const SLIPAGE_POINTS = BigInt(slippage * 100);
    const solAmountLamp = BigInt(solAmount * web3.LAMPORTS_PER_SOL);
    console.log("🚀 ~ solAmountLamp:", solAmountLamp)
    const buyAmountToken = getBuyPrice(solAmountLamp, tokenData);
    const buyAmountSolWithSlippage = solAmountLamp + (solAmountLamp * SLIPAGE_POINTS) / 10000n;

    const FEE_RECEIPT = new web3.PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");

    // request a specific compute unit budget
    const modifyComputeUnits = web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 100000,
    });

    // set the desired priority fee
    const addPriorityFee = web3.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: typeof priorityFee === "number" ? priorityFee * 1000000000 : 0.0001 * 1000000000,
      // microLamports: 0.005 * 1000000000,
    });

    const latestBlockhash = await connection.getLatestBlockhash()

    transaction
      .add(modifyComputeUnits)
      .add(addPriorityFee)
      .add(
        await program.methods
          .buy(new BN(buyAmountToken.toString()), new BN(buyAmountSolWithSlippage.toString()))
          .accounts({
            feeRecipient: FEE_RECEIPT,
            mint: mint,
            associatedBondingCurve: associatedBondingCurve,
            associatedUser: associatedUser,
            user: keypair.publicKey,
          })
          .transaction()
      );

    transaction.feePayer = keypair.publicKey;
    transaction.recentBlockhash = latestBlockhash.blockhash;

    console.log(await connection.simulateTransaction(transaction))

    const isNext = process.env.IS_NEXT === 'true';
    const isJito = process.env.IS_JITO === 'true';

    if (isNext) {
      const next_block_addrs = [
        'NEXTbLoCkB51HpLBLojQfpyVAMorm3zzKg7w9NFdqid',
        'NeXTBLoCKs9F1y5PJS9CKrFNNLU1keHW71rfh7KgA1X',
        'NexTBLockJYZ7QD7p2byrUa6df8ndV2WSd8GkbWqfbb',
        'neXtBLock1LeC67jYd1QdAa32kbVeubsfPNTJC1V5At',
        'nEXTBLockYgngeRmRrjDV31mGSekVPqZoMGhQEZtPVG',
        'nextBLoCkPMgmG8ZgJtABeScP35qLa2AMCNKntAP7Xc',
        'NextbLoCkVtMGcV47JzewQdvBpLqT9TxQFozQkN98pE',
        'NexTbLoCkWykbLuB1NkjXgFWkX9oAtcoagQegygXXA2'
      ]

      for (let i = 0; i < next_block_addrs.length; i++) {
        const next_block_addr = next_block_addrs[i];
        const next_block_api = process.env.NEXT_BLOCK_API;

        if (!next_block_addr) return console.log("Nextblock wallet is not provided");
        if (!next_block_api) return console.log("Nextblock block api is not provided");

        // NextBlock Instruction
        const recipientPublicKey = new web3.PublicKey(next_block_addr);
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: recipientPublicKey,
          lamports: process.env.NEXT_BLOCK_FEE ? Number(process.env.NEXT_BLOCK_FEE) * web3.LAMPORTS_PER_SOL : 1000000
        });

        transaction.add(transferInstruction);

        transaction.sign(keypair)

        console.log("Buying token")

        const tx64Str = transaction.serialize().toString('base64');
        const payload: Payload = {
          transaction: {
            content: tx64Str
          }
        };

        try {
          console.log("Trying transaction to confirm using nextblock")
          const response = await fetch('https://fra.nextblock.io/api/v2/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'authorization': next_block_api // Insert your authorization token here
            },
            body: JSON.stringify(payload)
          });

          const responseData = await response.json();
          console.log("responseData", responseData);

          if (response.ok) {
            console.log("Sent transaction with signature", `https://solscan.io/tx/${responseData.signature?.toString()}`);
            break;
          } else {
            console.error("Failed to send transaction:", response.status, responseData);
            continue;
          }
        } catch (error) {
          console.error("Error sending transaction:", error);
          continue;
        }
      }
    } else if (isJito) {

      const messageV0 = new TransactionMessage({
        payerKey: keypair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: transaction.instructions,
      }).compileToV0Message()

      const versionedTx = new web3.VersionedTransaction(messageV0);
      versionedTx.sign([keypair]);

      const sig = await executeJitoTx([versionedTx], keypair, 'confirmed');
      return sig
    } else {
      const txSig = await connection.sendTransaction(transaction, [keypair]);
      const confirmSig = await connection.confirmTransaction(txSig, 'confirmed');

      console.log('confirm sig => ', confirmSig.value.err);

      console.log(`Sending transaction for buying ${mint.toString()}, ${new Date().toISOString()}`);
      const sig = await web3.sendAndConfirmTransaction(connection, transaction, [keypair], { skipPreflight: true, commitment: "confirmed", preflightCommitment: 'confirmed' });
      return sig
    }

  } catch (error) {
    console.error(error);
    return false
  }
}
export default buyToken;
