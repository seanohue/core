import { EventEmitter } from "events";

export type Constructor<T = EventEmitter> = new (...args: any[]) => T;
/**
 * From Puja's typescript-deep-path-safe repo
 * https://github.com/Pouja/typescript-deep-path-safe/blob/main/index.d.ts
 */
export type DeepResolveType<ObjectType, Path extends string, OrElse> =
	// If it is just a key of the root object, resolution is simple:
	Path extends keyof ObjectType
		? ObjectType[Path]
		// Here is where we use inference to split dot notation into new types:
		: Path extends `${infer LeftSide}.${infer RightSide}`
			? LeftSide extends keyof ObjectType
					? DeepResolveType<ObjectType[LeftSide], RightSide, OrElse>
					// Handle array-likes. This may not even be supported by Ranvier,
					// but this is needed for _.get typing:
					: Path extends `${infer LeftSide}[${number}].${infer RightSide}`
						? LeftSide extends keyof ObjectType
							? ObjectType[LeftSide] extends Array<infer U>
									// Here we call DeepResolveType recursively with the inferred type
									// wrapped in the array:
									? DeepResolveType<U, RightSide, OrElse>
									: OrElse
							: OrElse
						: OrElse
					// Handle array-like where there is not a right-side after the array access:
					: Path extends `${infer LeftSide}[${number}]`
						? LeftSide extends keyof ObjectType
							? ObjectType[LeftSide] extends Array<infer U>
								? U
								: OrElse
							: OrElse
						: OrElse;
/**
 * Check to see if a given object is iterable
 */
export function isIterable<T = unknown>(obj: Iterable<T>): obj is Iterable<T> {
	return obj && typeof obj[Symbol.iterator] === 'function';
}
