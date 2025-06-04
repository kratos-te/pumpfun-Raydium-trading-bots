import * as web3 from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { RPC_ENDPOINT } from "../constants";
import { NATIVE_MINT } from "@solana/spl-token";
import { getTokenPrice } from "../config";

const TRADE_PROGRAM_ID = new PublicKey(
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);
const BONDING_ADDR_SEED = new Uint8Array([
    98, 111, 110, 100, 105, 110, 103, 45, 99, 117, 114, 118, 101,
]);

function readBytes(buf: Buffer, offset: number, length: number): Buffer {
    const end = offset + length;
    if (buf.byteLength < end) throw new RangeError("range out of bounds");
    return buf.subarray(offset, end);
}

function readBigUintLE(buf: Buffer, offset: number, length: number): bigint {
    switch (length) {
        case 1:
            return BigInt(buf.readUint8(offset));
        case 2:
            return BigInt(buf.readUint16LE(offset));
        case 4:
            return BigInt(buf.readUint32LE(offset));
        case 8:
            return buf.readBigUint64LE(offset);
    }
    throw new Error(`unsupported data size (${length} bytes)`);
}

function readBoolean(buf: Buffer, offset: number, length: number): boolean {
    const data = readBytes(buf, offset, length);
    for (const b of data) {
        if (b) return true;
    }
    return false;
}

//////////////////////////////////////////////////

const PUMP_CURVE_TOKEN_DECIMALS = 6;

// Calculated as the first 8 bytes of: `sha256("account:BondingCurve")`.
const PUMP_CURVE_STATE_SIGNATURE = Uint8Array.from([
    0x17, 0xb7, 0xf8, 0x37, 0x60, 0xd8, 0xac, 0x60,
]);

const PUMP_CURVE_STATE_SIZE = 0x29;
const PUMP_CURVE_STATE_OFFSETS = {
    VIRTUAL_TOKEN_RESERVES: 0x08,
    VIRTUAL_SOL_RESERVES: 0x10,
    REAL_TOKEN_RESERVES: 0x18,
    REAL_SOL_RESERVES: 0x20,
    TOKEN_TOTAL_SUPPLY: 0x28,
    COMPLETE: 0x30,
};

interface PumpCurveState {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    complete: boolean;
}

export async function getPumpCurveState(
    curveAddress: string
): Promise<PumpCurveState> {
    const conn = new web3.Connection(RPC_ENDPOINT, "confirmed");
    const pubKey = new web3.PublicKey(curveAddress);
    const response = await conn.getAccountInfo(pubKey);
    // console.log("🚀 ~ response:", response)
    if (
        !response ||
        !response.data ||
        response.data.byteLength <
        PUMP_CURVE_STATE_SIGNATURE.byteLength + PUMP_CURVE_STATE_SIZE
    ) {
        throw new Error("unexpected curve state");
    }

    const idlSignature = readBytes(
        response.data,
        0,
        PUMP_CURVE_STATE_SIGNATURE.byteLength
    );
    // console.log("🚀 ~ idlSignature:", idlSignature)
    // console.log(idlSignature.compare(PUMP_CURVE_STATE_SIGNATURE))
    if (idlSignature.compare(PUMP_CURVE_STATE_SIGNATURE) !== 0) {
        throw new Error("unexpected curve state IDL signature");
    }
    // console.log(readBigUintLE(
    //     response.data,
    //     PUMP_CURVE_STATE_OFFSETS.VIRTUAL_TOKEN_RESERVES,
    //     8
    // ))
    return {
        virtualTokenReserves: readBigUintLE(
            response.data,
            PUMP_CURVE_STATE_OFFSETS.VIRTUAL_TOKEN_RESERVES,
            8
        ),
        virtualSolReserves: readBigUintLE(
            response.data,
            PUMP_CURVE_STATE_OFFSETS.VIRTUAL_SOL_RESERVES,
            8
        ),
        realTokenReserves: readBigUintLE(
            response.data,
            PUMP_CURVE_STATE_OFFSETS.REAL_TOKEN_RESERVES,
            8
        ),
        realSolReserves: readBigUintLE(
            response.data,
            PUMP_CURVE_STATE_OFFSETS.REAL_SOL_RESERVES,
            8
        ),
        tokenTotalSupply: readBigUintLE(
            response.data,
            PUMP_CURVE_STATE_OFFSETS.TOKEN_TOTAL_SUPPLY,
            8
        ),
        complete: readBoolean(response.data, PUMP_CURVE_STATE_OFFSETS.COMPLETE, 1),
    };
}

export const getPairAddress = (mintAddress: string) => {
    const tokenMint = new PublicKey(mintAddress);
    // get the address of bonding curve and associated bonding curve
    const [bonding] = PublicKey.findProgramAddressSync(
        [BONDING_ADDR_SEED, tokenMint.toBuffer()],
        TRADE_PROGRAM_ID
    );
    return bonding;
};

// Calculates token price (in SOL) of a Pump.fun bonding curve.
export function calculatePumpCurvePrice(curveState: PumpCurveState): number {
    if (
        curveState === null ||
        typeof curveState !== "object" ||
        !(
            typeof curveState.virtualTokenReserves === "bigint" &&
            typeof curveState.virtualSolReserves === "bigint"
        )
    ) {
        throw new TypeError("curveState must be a PumpCurveState");
    }

    if (
        curveState.virtualTokenReserves <= 0 ||
        curveState.virtualSolReserves <= 0
    ) {
        throw new RangeError("curve state contains invalid reserve data");
    }

    return (
        Number(curveState.virtualSolReserves) /
        web3.LAMPORTS_PER_SOL /
        (Number(curveState.virtualTokenReserves) / 10 ** PUMP_CURVE_TOKEN_DECIMALS)
    );
}

export const getPumpCurveData = async (address: string) => {
    const newAddress = await getPairAddress(address);
    const bondingCurveAddress = newAddress.toString();

    const bondingCurveData = await getPumpCurveState(bondingCurveAddress);

    const pumpCurvePrice = calculatePumpCurvePrice(bondingCurveData);

    const marketCap = pumpCurvePrice * 10 ** 9;

    const liquidity =
        (Number(bondingCurveData.realSolReserves) * 2) / web3.LAMPORTS_PER_SOL;

    const solPrice: any = await getTokenPrice(NATIVE_MINT.toBase58())

    const bondingProgress: number = ((marketCap * solPrice) / 690) * 2;

    return { solPrice: pumpCurvePrice, usdPrice: pumpCurvePrice * solPrice, marketCap, liquidity, bondingProgress };
};