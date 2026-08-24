import assert from "node:assert/strict"

import { getSwapPreviewView } from "../src/lib/swap-preview-state.ts"

assert.equal(getSwapPreviewView(true, true), "preview")
assert.equal(getSwapPreviewView(false, true), "loading")
assert.equal(getSwapPreviewView(false, false), "empty")

console.log("Swap preview stability check passed.")
