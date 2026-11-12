#![deny(clippy::all)]

use std::collections::HashMap;
use std::io::Cursor;

use image::{imageops::FilterType, DynamicImage, ImageFormat};
use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Every `#[napi]` function becomes a regular JavaScript export —
/// with TypeScript definitions generated for free.
#[napi]
pub fn greet(name: String) -> String {
    format!("Hello {name}, this string was built in Rust 🦀")
}

/// Deliberately naive, CPU-bound recursion — our benchmark workload.
/// The same source compiles to a native Node addon *and* to WebAssembly.
#[napi]
pub fn fibonacci(n: u32) -> u32 {
    if n < 2 {
        n
    } else {
        fibonacci(n - 1) + fibonacci(n - 2)
    }
}

/// A `Task` describes work for a background thread: `compute` runs off the
/// JS thread (libuv's pool natively, a Web Worker in the WASM build),
/// `resolve` converts the result back on the JS thread.
pub struct FibonacciTask {
    n: u32,
}

#[napi] // lets the TS generator see `JsValue` → `Promise<number>`
impl Task for FibonacciTask {
    type Output = u32;
    type JsValue = u32;

    fn compute(&mut self) -> Result<Self::Output> {
        Ok(fibonacci(self.n))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

/// Returning an `AsyncTask` makes this a function returning a JS `Promise`
/// — the event loop stays free while `compute` runs.
#[napi]
pub fn fibonacci_async(n: u32) -> AsyncTask<FibonacciTask> {
    AsyncTask::new(FibonacciTask { n })
}

/// Structs marked `#[napi(object)]` cross the boundary as plain JS
/// objects, with fields renamed to camelCase (`mostCommonWord`).
#[napi(object)]
pub struct TextStats {
    pub chars: u32,
    pub words: u32,
    pub lines: u32,
    pub most_common_word: String,
}

#[napi]
pub fn analyze_text(text: String) -> TextStats {
    let mut counts: HashMap<String, u32> = HashMap::new();
    for word in text.split_whitespace() {
        let word: String = word
            .chars()
            .filter(|c| c.is_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect();
        if !word.is_empty() {
            *counts.entry(word).or_default() += 1;
        }
    }
    TextStats {
        chars: text.chars().count() as u32,
        words: text.split_whitespace().count() as u32,
        lines: text.lines().count() as u32,
        most_common_word: counts
            .into_iter()
            .max_by_key(|(_, count)| *count)
            .map(|(word, _)| word)
            .unwrap_or_default(),
    }
}

/// The whole crates.io ecosystem is one `#[napi]` away: here
/// `pulldown-cmark`, the CommonMark engine behind rustdoc and mdBook.
#[napi]
pub fn render_markdown(input: String) -> String {
    let parser = pulldown_cmark::Parser::new(&input);
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);
    html
}

fn decode(bytes: &[u8]) -> Result<DynamicImage> {
    image::load_from_memory(bytes).map_err(|err| Error::from_reason(err.to_string()))
}

fn encode_png(img: &DynamicImage) -> Result<Uint8Array> {
    let mut out = Cursor::new(Vec::new());
    img.write_to(&mut out, ImageFormat::Png)
        .map_err(|err| Error::from_reason(err.to_string()))?;
    Ok(out.into_inner().into())
}

/// `Uint8Array` (or a Node `Buffer`) maps straight onto Rust byte
/// slices — zero-copy on the way in.
#[napi]
pub fn grayscale(image_data: Uint8Array) -> Result<Uint8Array> {
    encode_png(&decode(&image_data)?.grayscale())
}

#[napi]
pub fn invert(image_data: Uint8Array) -> Result<Uint8Array> {
    let mut img = decode(&image_data)?;
    img.invert();
    encode_png(&img)
}

#[napi]
pub fn pixelate(image_data: Uint8Array, block_size: u32) -> Result<Uint8Array> {
    let img = decode(&image_data)?;
    let (w, h) = (img.width(), img.height());
    let small = img.resize_exact(
        (w / block_size).max(1),
        (h / block_size).max(1),
        FilterType::Nearest,
    );
    encode_png(&small.resize_exact(w, h, FilterType::Nearest))
}

#[napi]
pub fn blur(image_data: Uint8Array, sigma: f64) -> Result<Uint8Array> {
    encode_png(&decode(&image_data)?.blur(sigma as f32))
}
