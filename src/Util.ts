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
 * Helper to generate a record type consumable by Meta generics, e.g.:
 * player.getMeta<DeepResolveRecord<IPlayerMetadata>>('resources.scrap_metal')
 */
export type DeepResolveRecord<ObjectType> = {
	[Property in Paths<ObjectType, 4>]: DeepResolveType<ObjectType, Property, void>;
}

/**
 * From jzcalz/Michael Ziluck here: 
 * https://stackoverflow.com/questions/58434389/typescript-deep-keyof-of-a-nested-object
 */

// Joins strings/numbers to make dotted paths
export type Join<K, P> = K extends string | number 
	? P extends string | number 
		? `${K}${"" extends P 
			? "" 
			: "."}${P}`
		: never 
	: never;

// Gets all possible paths at all levels of nesting
export type Paths<T, D extends number = 10> = [D] extends [never] 
	? never 
	: T extends object 
		? { [K in keyof T]-?: K extends string | number 
			? `${K}` | Join<K, Paths<T[K], Prev[D]>>
			: never
		}[keyof T] : "";

// Get only paths that end in a non-object/array-like
export type Leaves<T, D extends number = 10> = [D] extends [never] 
	? never 
	: T extends object 
		? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T] 
		: "";

// Helper in unlikely case that we use array indexing...
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
	11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]];

/**
 * Check to see if a given object is iterable
 */
export function isIterable<T = unknown>(obj: Iterable<T>): obj is Iterable<T> {
	return obj && typeof obj[Symbol.iterator] === 'function';
}
