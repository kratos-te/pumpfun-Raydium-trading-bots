import * as web3 from "@solana/web3.js";
import inquirer from "inquirer";
async function promptUserBuy() {
  // Load token
  let tokenAddress: web3.PublicKey;

  //@ts-ignore
  const answer = await inquirer.prompt([
    {
      type: "input",
      name: "tokenAddress",
      message: "Enter token address:",
    },
  ]);

  tokenAddress = new web3.PublicKey(answer.tokenAddress);
  console.log("Loaded token address from user: ", tokenAddress.toString());

  // Load SOL amount to buy
  let solAmount: number;
  // If it's in the .env file load it
  if (process.env.SOL_AMOUNT) {
    solAmount = +process.env.SOL_AMOUNT;
    console.log("Loaded SOL amount from .env file: ", solAmount);
  }
  // Otherwise ask the user
  else {
    //@ts-ignore
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "solAmount",
        message: "Enter SOL amount:",
      },
    ]);

    solAmount = +answer.solAmount;
    console.log("Loaded SOL amount from user: ", solAmount);
  }

  // Load Slippage
  let slippage: number;
  // If it's in the .env file load it
  if (process.env.SOL_AMOUNT) {
    slippage = +process.env.SOL_AMOUNT;
    console.log("Loaded Slippage from .env file: ", slippage);
  }
  // Otherwise ask the user
  else {
    //@ts-ignore
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "slippage",
        message: "Enter Slippage:",
      },
    ]);

    slippage = +answer.slippage;
    console.log("Loaded Slippage from user: ", slippage);
  }

  // Load Slippage
  let priorityFee: number;
  // If it's in the .env file load it
  if (process.env.SOL_AMOUNT) {
    priorityFee = +process.env.SOL_AMOUNT;
    console.log("Loaded Priority Fee from .env file: ", priorityFee);
  }
  // Otherwise ask the user
  else {
    //@ts-ignore
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "priorityFee",
        message: "Enter Priority Fee:",
      },
    ]);

    priorityFee = +answer.priorityFee;
    console.log("Loaded priorityFee from user: ", priorityFee);
  }

  return { tokenAddress, solAmount, slippage, priorityFee };
}

export default promptUserBuy;
