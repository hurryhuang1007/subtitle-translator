export const isProd = process.env.NODE_ENV === 'production';

/** 测试环境标记，见规范 NEXT_PUBLIC_IS_TEST */
export const isTest = process.env.NEXT_PUBLIC_IS_TEST === 'true';
