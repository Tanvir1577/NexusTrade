import { NextRequest, NextResponse } from 'next/server';

const OANDA_KEY = '6f97eafea47ae2dd7c0f1b0e8d3bf533-a41a026e7958cfc6f40f7393453263da';
const BASE_URL = 'https://api-fxpractice.oanda.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get('pair') || 'EUR_USD';
  const count = parseInt(searchParams.get('count') || '60', 10);
  const granularity = searchParams.get('granularity') || 'M1';

  try {
    const url = `${BASE_URL}/v3/instruments/${pair}/candles?count=${count}&granularity=${granularity}&price=MBA`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${OANDA_KEY}`,
        'Accept-Datetime-Format': 'RFC3339',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'OANDA API error', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Network error' },
      { status: 500 }
    );
  }
}
