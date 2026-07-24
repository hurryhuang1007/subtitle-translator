import { NextResponse } from 'next/server';

export type ApiSuccess<T> = {
  code: 1;
  data: T;
  msg: string;
};

export type ApiFailure = {
  code: number;
  data: null;
  msg: string;
};

export function apiOk<T>(data: T, init?: ResponseInit) {
  const body: ApiSuccess<T> = {
    code: 1,
    data,
    msg: 'ok',
  };
  return NextResponse.json(body, init);
}

export function apiFail(msg: string, options?: { code?: number; status?: number }) {
  const code = options?.code ?? 999;
  const status = options?.status ?? 400;
  const body: ApiFailure = {
    code,
    data: null,
    msg,
  };
  return NextResponse.json(body, { status });
}
