import jwt from 'jsonwebtoken';
import { PUMP_URL } from '../constants';
import axios from 'axios';

export async function formatDate() {
    const options: any = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short'
    };

    const now = new Date();
    return now.toLocaleString('en-US', options);
}

export function convertHttpToWebSocket(httpUrl: string): string {
    return httpUrl.replace(/^https?:\/\//, 'wss://');
}