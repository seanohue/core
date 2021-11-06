import { EventEmitter } from "events";

export type Constructor<T = EventEmitter> = new (...args: any[]) => T;

/**
 * Check to see if a given object is iterable
 */
export function isIterable<T = unknown>(obj: Iterable<T>): obj is Iterable<T> {
	return obj && typeof obj[Symbol.iterator] === 'function';
}
