import { expect, describe, test } from 'bun:test';
import { Result, Maybe, tryCatch, attempt, composeAsync, pipeWithResult } from './monad.js';

describe('Result', () => {
  test('ok creates success result', () => {
    const r = Result.ok(42);
    expect(r.isOk).toBe(true);
    expect(r.isErr).toBe(false);
    expect(r.value).toBe(42);
  });

  test('err creates failure result', () => {
    const e = new Error('fail');
    const r = Result.err(e);
    expect(r.isOk).toBe(false);
    expect(r.isErr).toBe(true);
    expect(r.error).toBe(e);
  });

  test('isOk/isErr checks', () => {
    expect(Result.isOk(Result.ok(1))).toBe(true);
    expect(Result.isOk(Result.err(new Error()))).toBe(false);
    expect(Result.isErr(Result.err(new Error()))).toBe(true);
    expect(Result.isErr(Result.ok(1))).toBe(false);
  });

  test('map transforms ok value', () => {
    const r = Result.map(Result.ok(2))(x => x * 3);
    expect(r.value).toBe(6);
  });

  test('map skips err value', () => {
    const e = new Error('nope');
    const r = Result.map(Result.err(e))(x => x * 3);
    expect(r.isErr).toBe(true);
    expect(r.error).toBe(e);
  });

  test('mapErr transforms error', () => {
    const r = Result.mapErr(Result.err(new Error('bad')))(e => new Error('worse'));
    expect(r.error.message).toBe('worse');
  });

  test('mapErr skips ok value', () => {
    const r = Result.mapErr(Result.ok(1))(e => new Error('worse'));
    expect(r.value).toBe(1);
  });

  test('flatMap chains ok results', () => {
    const r = Result.flatMap(Result.ok(2))(x => Result.ok(x * 3));
    expect(r.value).toBe(6);
  });

  test('flatMap short-circuits on err', () => {
    const e = new Error('stop');
    const r = Result.flatMap(Result.err(e))(x => Result.ok(x * 3));
    expect(r.isErr).toBe(true);
  });

  test('getOrElse returns value on ok', () => {
    expect(Result.getOrElse(Result.ok(1))(99)).toBe(1);
  });

  test('getOrElse returns default on err', () => {
    expect(Result.getOrElse(Result.err(new Error()))(99)).toBe(99);
  });

  test('getOrThrow returns value on ok', () => {
    expect(Result.getOrThrow(Result.ok(1))).toBe(1);
  });

  test('getOrThrow throws on err', () => {
    expect(() => Result.getOrThrow(Result.err(new Error('boom')))).toThrow('boom');
  });

  test('fromNullable creates ok for non-null', () => {
    const r = Result.fromNullable(0);
    expect(r.isOk).toBe(true);
    expect(r.value).toBe(0);
  });

  test('fromNullable creates err for null', () => {
    const r = Result.fromNullable(null);
    expect(r.isErr).toBe(true);
    expect(r.error.message).toBe('Value is null or undefined');
  });

  test('fromNullable creates err for undefined', () => {
    const r = Result.fromNullable(undefined);
    expect(r.isErr).toBe(true);
  });

  test('fromNullable uses custom error message', () => {
    const r = Result.fromNullable(null, 'custom msg');
    expect(r.error.message).toBe('custom msg');
  });

  test('fromThrowable catches sync function result', () => {
    const r = Result.fromThrowable(() => 42);
    expect(r.value).toBe(42);
  });

  test('fromThrowable catches thrown error', () => {
    const r = Result.fromThrowable(() => { throw new Error('crash'); });
    expect(r.isErr).toBe(true);
    expect(r.error.message).toBe('crash');
  });

  test('of aliases ok', () => {
    expect(Result.of(5).value).toBe(5);
  });

  test('empty creates ok(null)', () => {
    expect(Result.empty().value).toBe(null);
  });
});

describe('Maybe', () => {
  test('just creates some value', () => {
    const m = Maybe.just(42);
    expect(m.isJust).toBe(true);
    expect(m.isNothing).toBe(false);
    expect(m.value).toBe(42);
  });

  test('nothing creates absent value', () => {
    const m = Maybe.nothing();
    expect(m.isJust).toBe(false);
    expect(m.isNothing).toBe(true);
    expect(m.value).toBe(null);
  });

  test('isJust/isNothing checks', () => {
    expect(Maybe.isJust(Maybe.just(1))).toBe(true);
    expect(Maybe.isJust(Maybe.nothing())).toBe(false);
    expect(Maybe.isNothing(Maybe.nothing())).toBe(true);
    expect(Maybe.isNothing(Maybe.just(1))).toBe(false);
  });

  test('map transforms just value', () => {
    expect(Maybe.map(Maybe.just(3))(x => x * 2).value).toBe(6);
  });

  test('map skips nothing', () => {
    const m = Maybe.map(Maybe.nothing())(x => x * 2);
    expect(m.isNothing).toBe(true);
  });

  test('flatMap chains just', () => {
    const m = Maybe.flatMap(Maybe.just(2))(x => Maybe.just(x * 3));
    expect(m.value).toBe(6);
  });

  test('flatMap short-circuits on nothing', () => {
    const m = Maybe.flatMap(Maybe.nothing())(x => Maybe.just(x * 3));
    expect(m.isNothing).toBe(true);
  });

  test('getOrElse returns value on just', () => {
    expect(Maybe.getOrElse(Maybe.just(1))(99)).toBe(1);
  });

  test('getOrElse returns default on nothing', () => {
    expect(Maybe.getOrElse(Maybe.nothing())(99)).toBe(99);
  });

  test('fromNullable creates just for non-null', () => {
    expect(Maybe.fromNullable(0).value).toBe(0);
  });

  test('fromNullable creates nothing for null', () => {
    expect(Maybe.fromNullable(null).isNothing).toBe(true);
  });

  test('of aliases just', () => {
    expect(Maybe.of(5).value).toBe(5);
  });

  test('empty creates nothing', () => {
    expect(Maybe.empty().isNothing).toBe(true);
  });
});

describe('tryCatch', () => {
  test('returns ok on success', () => {
    const safe = tryCatch((x) => x + 1);
    const r = safe(2);
    expect(r.value).toBe(3);
  });

  test('returns err on thrown error', () => {
    const safe = tryCatch(() => { throw new Error('oops'); });
    const r = safe();
    expect(r.isErr).toBe(true);
  });
});

describe('attempt', () => {
  test('returns ok on success', () => {
    const r = attempt(() => 42);
    expect(r.value).toBe(42);
  });

  test('returns err on thrown error', () => {
    const r = attempt(() => { throw new Error('fail'); });
    expect(r.isErr).toBe(true);
  });
});

describe('composeAsync', () => {
  test('chains async functions successfully', async () => {
    const add1 = async (x) => Result.ok(x + 1);
    const mul2 = async (x) => Result.ok(x * 2);
    const pipeline = composeAsync(add1, mul2);
    const r = await pipeline(Result.ok(3));
    expect(r).toEqual({ isOk: true, isErr: false, value: 8 });
  });

  test('short-circuits on error', async () => {
    const fail = async (x) => Result.err(new Error('stop'));
    const pipeline = composeAsync(fail);
    const r = await pipeline(Result.ok(1));
    expect(r.isErr).toBe(true);
  });
});

describe('pipeWithResult', () => {
  test('chains functions over initial value', () => {
    const r = pipeWithResult(3, x => Result.ok(x + 2), x => Result.ok(x * 3));
    expect(r.value).toBe(15);
  });

  test('short-circuits on error', () => {
    const r = pipeWithResult(3, () => Result.err(new Error('stop')), () => Result.ok(99));
    expect(r.isErr).toBe(true);
  });
});
