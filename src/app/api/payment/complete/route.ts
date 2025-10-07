import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { paymentId } = await req.json();

  // PortOne 결제 단건 조회
  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `PortOne 34XMGFEouagvTO9sg4Nk2v1CSdli1dsgMD1lfjoI0NDtQJlk4z8JZlFUlMaL3499RkZIkrJPddFbOlPW` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'PortOne lookup failed' }, { status: 400 });
  }

  const payment = await res.json();

  console.log('Payment verification - Status:', payment.status, 'ID:', paymentId);

  // 결제 상태만 반환 (ETH 충전은 클라이언트에서 별도 API 호출)
  return NextResponse.json({
    status: payment.status,
    amount: payment.amount?.total,
    paymentId
  });
}