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

  // 예: 내부 주문 금액과 실제 결제 금액 검증
  // if (expectedAmount !== payment.amount.total) ... 위변조 의심 처리

  // 결제 상태에 따라 후처리
  // 'PAID' (완료), 'VIRTUAL_ACCOUNT_ISSUED' (가상계좌 발급) 등
  return NextResponse.json({ status: payment.status, amount: payment.amount?.total });
}