// The exact same naive algorithm as the Rust version in
// native/src/lib.rs — our pure-JavaScript baseline.
export function fibonacciJs(n: number): number {
	return n < 2 ? n : fibonacciJs(n - 1) + fibonacciJs(n - 2);
}
