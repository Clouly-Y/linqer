import { Function } from "@clouly_y/types";
import { combineCompare, compare, genComparer, toIterable } from "./LinqHelper";

export class Linq<T> implements Iterable<T> {
    private readonly source: Iterable<T> | Function<Iterator<T>> | Function<Iterable<T>>;
    constructor(source: Iterable<T> | Function<Iterator<T>> | Function<Iterable<T>>) {
        this.source = source;
    }
    private comparer: Function<number, [T, T]> | undefined;

    public *[Symbol.iterator](): Iterator<T> {
        if (!compare) {
            yield* toIterable(this.source);
        }
        else {
            const arr = [...toIterable(this.source)];
            yield* arr.sort(compare);
        }
    }

    public append<T2>(other: T2): Linq<T | T2> {
        const next = function* (this: Linq<T>) {
            yield* this;
            yield other;
        }
        return new Linq(next.bind(this));
    }

    public prepend<T2>(other: T2): Linq<T | T2> {
        const next = function* (this: Linq<T>) {
            yield other;
            yield* this;
        }
        return new Linq(next.bind(this));
    }

    public concat<T2>(other: Iterable<T2>): Linq<T | T2> {
        const next = function* (this: Linq<T>) {
            yield* this;
            yield* other;
        }
        return new Linq(next.bind(this));
    }

    public where(func: (t: T) => boolean): Linq<T> {
        const next = function* (this: Linq<T>) {
            for (const A of this)
                if (func(A))
                    yield A;
        }
        return new Linq(next.bind(this));
    }

    public whereNot(func: (t: T) => boolean): Linq<T> {
        return this.where(A => !func(A));
    }

    public whereType<TOut extends object>(type: (new (...args: any[]) => TOut) | (abstract new (...args: any[]) => TOut)): Linq<TOut> {
        return this.where(A => A instanceof type) as unknown as Linq<TOut>;
    }

    public select<TOut>(func: (t: T) => TOut): Linq<TOut> {
        const next = function* (this: Linq<T>) {
            for (const A of this)
                yield func(A);
        }
        return new Linq(next.bind(this));
    }

    public selectMany<TCollection>(func: (t: T) => Iterable<TCollection>): Linq<TCollection>
    public selectMany<TCollection, TResult>(func: (t: T) => Iterable<TCollection>, resultSelector: Function<TResult, [T, TCollection]>): Linq<TCollection>
    public selectMany<TCollection, TResult>(func: (t: T) => Iterable<TCollection>, resultSelector?: Function<TResult, [T, TCollection]>): Linq<TCollection | TResult> {
        const next = function* (this: Linq<T>) {
            for (const A of this)
                for (const B of func(A)) {
                    if (resultSelector)
                        yield resultSelector(A, B);
                    else
                        yield B;
                }
        }
        return new Linq(next.bind(this));
    }

    public except(other: Iterable<unknown>): Linq<T> {
        const set = new Set(other);
        return this.where(A => !set.has(A))
    }

    public union<T2>(other: Iterable<T2>): Linq<T | T2> {
        return this.concat(other).distinct();
    }

    public reverse(): Linq<T> {
        const next = function* (this: Linq<T>) {
            const arr = [...this];
            for (let i = arr.length - 1; i >= 0; i--)
                yield arr[i];
        }
        return new Linq(next.bind(this));
    }

    public take(count: number): Linq<T> {
        const next = function* (this: Linq<T>) {
            let i = 0;
            for (const A of this) {
                if (++i > count)
                    break;
                yield A;
            }
        }
        return new Linq(next.bind(this));
    }

    public skip(count: number): Linq<T> {
        const next = function* (this: Linq<T>) {
            let i = 0;
            for (const A of this) {
                if (++i <= count)
                    continue;
                yield A;
            }
        }
        return new Linq(next.bind(this));
    }

    public distinct(): Linq<T> {
        const next = function* (this: Linq<T>) {
            const set: Set<T> = new Set();
            for (const A of this) {
                if (set.has(A))
                    continue;
                set.add(A);
                yield A;
            }
        }
        return new Linq(next.bind(this));
    }

    public orderBy<K>(keySelector?: (item: T) => K): Linq<T> {
        const comparer = genComparer(keySelector, false);
        const linq = new Linq<T>(this);
        linq.comparer = comparer;
        return linq;
    }

    public orderByDescending<K>(keySelector: (item: T) => K): Linq<T> {
        const comparer = genComparer(keySelector, true);
        const linq = new Linq<T>(this);
        linq.comparer = comparer;
        return linq;
    }

    public thenBy<K>(keySelector: (item: T) => K): Linq<T> {
        if (this.comparer === undefined)
            return this.orderBy(keySelector);

        const newComparer = genComparer(keySelector, false);
        const comparer = combineCompare(this.comparer, newComparer);
        const linq = new Linq<T>(this);
        linq.comparer = comparer;
        return linq;
    }

    public thenByDescending<K>(keySelector: (item: T) => K): Linq<T> {
        if (this.comparer === undefined)
            return this.orderByDescending(keySelector);

        const newComparer = genComparer(keySelector, true);
        const comparer = combineCompare(this.comparer, newComparer);
        const linq = new Linq<T>(this);
        linq.comparer = comparer;
        return linq;
    }

    public let<TK extends string, TV>(key: TK, func: (t: T) => TV): Linq<Record<TK, TV> & { value: T }> {
        if (key === "value")
            throw new Error("Cannot use 'value' as a key in let or thenLet");
        const next = function* (this: Linq<T>) {
            for (const A of this) {
                const res: { [K in TK]: TV } & { value: T } = { value: A } as any;
                (res as Record<TK, TV>)[key] = func(A);
                yield res;
            }
        }
        return new Linq(next.bind(this));
    }

    public thenLet<TK extends string, TV>(key: TK, func: (t: T) => TV): Linq<Record<TK, TV> & T> {
        if (key === "value")
            throw new Error("Cannot use 'value' as a key in let or thenLet");
        const next = function* (this: Linq<T>) {
            for (const A of this) {
                (A as Record<TK, TV>)[key] = func(A);
                yield A as any;
            }
        }
        return new Linq(next.bind(this));
    }

    public any(func?: (t: T) => boolean): boolean {
        for (const A of this)
            if (!func || func(A))
                return true;
        return false;
    }


    public all(func: (t: T) => boolean): boolean {
        for (const A of this)
            if (!func(A))
                return false;
        return true;
    }


    public contains(item: T): boolean {
        for (const A of this)
            if (A === item)
                return true;
        return false;
    }

    public count(predicate?: (item: T) => boolean): number {
        let count = 0;
        for (const A of this) {
            if (!predicate || predicate(A))
                count++;
        }
        return count;
    }

    public sum(selector?: (item: T) => number): number {
        let total = 0;

        for (const item of this) {
            const value = selector ? selector(item) : item;
            if (typeof value !== 'number') {
                throw new TypeError('Non-numeric values require selector');
            }
            total += value;
        }

        return total;
    }

    public minElement(selector?: (item: T) => number): T | undefined {
        let minEle: T | undefined = undefined;

        for (const item of this) {
            const value = selector ? selector(item) : item;
            if (typeof value !== 'number') {
                throw new TypeError('Non-numeric values require selector');
            }

            if (minEle === undefined || value < (selector ? selector(minEle) : minEle as number)) {
                minEle = item;
            }
        }

        return minEle;
    }
    public min(selector?: (item: T) => number): number | undefined {
        const minElement = this.minElement(selector);
        if (minElement === undefined)
            return undefined;

        return selector ? selector(minElement) : minElement as number;
    }

    public maxElement(selector?: (item: T) => number): T | undefined {
        let maxEle: T | undefined = undefined;

        for (const item of this) {
            const value = selector ? selector(item) : item;
            if (typeof value !== 'number') {
                throw new TypeError('Non-numeric values require selector');
            }

            if (maxEle === undefined || value > (selector ? selector(maxEle) : maxEle as number)) {
                maxEle = item;
            }
        }

        return maxEle;
    }

    public max(selector?: (item: T) => number): number | undefined {
        const maxElement = this.maxElement(selector);
        if (maxElement === undefined)
            return undefined;

        return selector ? selector(maxElement) : maxElement as number;
    }

    public average(predicate?: (item: T) => boolean, selector?: (item: T) => number): number {
        const count = this.count(predicate);
        const sum = this.sum(selector);
        return sum / count;
    }

    public first(predicate?: (item: T) => boolean): T | undefined {
        for (const item of this) {
            if (!predicate || predicate(item))
                return item;
        }
        return undefined;
    }

    public last(predicate?: (item: T) => boolean): T | undefined {
        for (const item of this.reverse()) {
            if (!predicate || predicate(item))
                return item;
        }
        return undefined;
    }

    public getRandomOne(predicate?: (item: T) => boolean): T | undefined {
        if (predicate)
            return this.where(predicate).orderBy(A => Math.random()).first();
        else
            return this.orderBy(A => Math.random()).first();

    }

    public getRandom(count: number = 1): T[] {
        return this.orderBy(A => Math.random()).take(count).toArray();
    }

    public toArray(): T[] {
        return [...this]
    }

    public toSet(): Set<T> {
        return new Set(this);
    }

    public foreach(func: (t: T) => void): void {
        for (const A of this)
            func(A);
    }
}

export function asLinq<T>(source: Iterable<T> | Function<Iterator<T>> | Function<Iterable<T>>): Linq<T> {
    return new Linq(source);
}