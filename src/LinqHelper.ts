import { Function } from "@clouly_y/types";

export function isIterator<T>(obj: any): obj is Iterator<T> {
    return obj != null && typeof obj.next === 'function';
}

export function* iterateIterator<T>(iterator: Iterator<T>): Generator<T> {
    let result = iterator.next();
    while (!result.done) {
        yield result.value;
        result = iterator.next();
    }
}

export function compare(a: any, b: any): number {
    if (a === b) return 0;
    return a > b ? 1 : -1;
}

export function genComparer<T, K>(keySelector: Function<K, [T]> | undefined, descending: boolean): Function<number, [T, T]> {
    if (keySelector) {
        if (!descending)
            return (a: T, b: T) => compare(keySelector(a), keySelector(b));
        else
            return (a: T, b: T) => compare(keySelector(b), keySelector(a));
    }
    else {
        if (!descending)
            return (a: T, b: T) => compare(a, b);
        else
            return (a: T, b: T) => compare(b, a);
    }
}

export function combineCompare<T>(first: Function<number, [T, T]>, second: Function<number, [T, T]>): Function<number, [T, T]> {
    return function (a: T, b: T): number {
        const firV = first(a, b);
        if (firV !== 0)
            return firV;
        else
            return second(a, b);
    };
}


export function toIterable<T>(source: Iterable<T> | Function<Iterator<T>> | Function<Iterable<T>>): Iterable<T> {
    if (typeof source == "object") {
        return source;
    }
    else {
        const res = source();
        if (isIterator(res))
            return iterateIterator(res);
        else
            return res;
    }
}