/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-var-requires */

import * as assert from "assert"
import { Component, createElement, render } from '../dist/index.js'
import { isEventKey, setAttribute } from "../dist/utils"

const jsdom = require('mocha-jsdom')
jsdom({ url: 'http://localhost', skipWindowCheck: true })

describe("Utils", () => {

	describe("isEventKey", () => {
		it("should return <true> for 'onClick'", () => {
			assert.ok(isEventKey("onClick"))
		})
		it("should return <false> for 'click'", () => {
			assert.ok(isEventKey("click") === false)
		})
		it("should return <false> for 'onsomeevent'", () => {
			assert.ok(isEventKey("onsomeevent") === false)
		})
	})

	describe("setAttribute", () => {
		it("should set style attribute correctly when passing a string", async () => {
			const dom = document.createElement("div")
			setAttribute(dom, "style", "height: '100%', width: '100%'")

			assert.strictEqual(dom.outerHTML, `<div style="height: '100%', width: '100%'"></div>`)
		})
		it("should be able to assign a 'value' attribute to the dom, not visible in the HTML", async () => {
			const dom = document.createElement("div")
			setAttribute(dom, "value", "test")

			assert.strictEqual(dom.outerHTML, `<div></div>`)
			assert.strictEqual((dom as unknown as Record<string, unknown>)["value"], "test")
		})
		it("should be able to assign a 'checked' attribute to the dom, not visible in the HTML", async () => {
			const dom = document.createElement("div")
			setAttribute(dom, "checked", "true")

			assert.strictEqual(dom.outerHTML, `<div></div>`)
			assert.strictEqual((dom as unknown as Record<string, unknown>)["checked"], "true")
		})
		it("should be able to assign an 'htmlFor' attribute to the dom, not visible in the HTML", async () => {
			const dom = document.createElement("div")
			setAttribute(dom, "htmlFor", "test")

			assert.strictEqual(dom.outerHTML, `<div></div>`)
			assert.strictEqual((dom as unknown as Record<string, unknown>)["htmlFor"], "test")
		})
		it("should assign the 'className' attributes under the name 'class'", async () => {
			const dom = document.createElement("div")
			setAttribute(dom, "className", "test_class")

			assert.strictEqual(dom.outerHTML, `<div class="test_class2"></div>`)
		})
	})

})
