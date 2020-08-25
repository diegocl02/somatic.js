/* eslint-disable fp/no-rest-parameters */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable brace-style */
/* eslint-disable @typescript-eslint/no-var-requires */

import cuid from "cuid"
import morphdom from 'morphdom'
import memoize from 'lodash/memoize'
import fastMemoize from 'fast-memoize'
import { flatten } from "@agyemanjp/standard/collections/iterable"
import { Array } from "@agyemanjp/standard/collections"
import { Obj } from "@agyemanjp/standard"

import { VNode, VNodeType, PropsExtended, Message, CSSProperties } from "./types"
import { setAttribute, isEventKey, separateWithSpace, camelCaseToDash } from "./utils"
import { svgTags, selfClosingTags, eventNames, mouseMvmntEventNames, } from "./constants"


// export const Fragment = (async () => ({})) as Renderer
export const fnStore: ((evt: Event) => unknown)[] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createElement<P extends Obj = Obj, T extends VNodeType<P> = VNodeType<P>>(type: T, props: P, ...children: any[]): VNode<P, T> {
	return { type, props, children }
}

/** Render virtual node to DOM node */
export async function render<P extends Obj = Obj>(vnode?: { toString(): string } | VNode<P> | Promise<VNode<P>>): Promise<Node> {
	if (vnode === null || vnode === undefined) { return document.createTextNode("") }

	const _vnode = await vnode
	if (typeof _vnode === 'object' && 'type' in _vnode && 'props' in _vnode) {
		const children = new Array([...flatten(_vnode.children || [])]) as Array<JSX.Element>
		switch (typeof _vnode.type) {
			case "function": {
				const _props: PropsExtended<P, Message> = { ..._vnode.props, children: [...children || []] }
				const element = await _vnode.type(_props)

				return element.children === undefined
					? await memoizedRender(element)
					: await render(element) // If element has children, we don't use the cache system (yet)
			}

			case "string": {
				const dom = svgTags.includes(_vnode.type)
					? document.createElementNS('http://www.w3.org/2000/svg', _vnode.type)
					: document.createElement(_vnode.type);

				// render and append children in order
				(await Promise.all([...children].map(render)))
					.forEach(child => dom.appendChild(child))

				// attach attributes
				const nodeProps = _vnode.props || {}
				Object.keys(nodeProps).forEach(propKey => {
					try {
						//const dashCasePropKey = camelCaseToDash(propKey)
						const propValue = nodeProps[propKey]
						const htmlPropKey = propKey.toLowerCase()
						if (isEventKey(htmlPropKey) && typeof propValue === "function") {
							const eventId = cuid()
							// We attach an eventId per possible event: an element having an onClick and onHover will have 2 such properties.
							dom.setAttribute(`data-${htmlPropKey}-eventId`, eventId)

							// If the vNode had an event, we add it to the document-wide event. 
							// We keep track of every event and its matching element through the eventId: 
							// each listener contains one, each DOM element as well
							document.addEventListener((eventNames)[htmlPropKey.toUpperCase() as keyof typeof eventNames], event => {
								const target = event.target as HTMLElement | null
								if (target !== document.getRootNode()) { // We don't want to do anything when the document itself is the target
									// We bubble up to the actual target of an event: a <div> with an onClick might be triggered by a click on a <span> inside
									//const indentedTarget = target?.closest ? target.closest(`[data-${htmlPropKey}-eventId]`) : undefined
									const indentedTarget = target?.closest(`[data-${htmlPropKey}-eventId]`)

									// For events about mouse movements (onmouseenter...), an event triggered by a child should not activate the parents handler 
									// (we when leave a span inside a div, we don't activate the onmouseleave of the div)
									const shouldNotTrigger = mouseMvmntEventNames.includes(htmlPropKey) && indentedTarget !== target

									// TODO: Deal with onLoad in a better way in the future
									if (!shouldNotTrigger && indentedTarget && indentedTarget?.getAttribute(`data-${htmlPropKey}-eventId`) === eventId) {
										(propValue)({ ...event, target: indentedTarget })
									}
								}
							}, true)
						}
						else {
							setAttribute(dom, propKey, propValue as string)
						}
					}
					catch (e) {
						console.error(`\nError setting dom attribute "${propKey}" to ${JSON.stringify(nodeProps[propKey])}:\n${e}`)
					}
				})

				return dom
			}

			default: {
				console.error(`Somatic render(): invalid vnode "${JSON.stringify(_vnode)}" of type "${typeof _vnode}"; `)
				return document.createTextNode(_vnode.toString())
			}
		}

	}
	else {
		return document.createTextNode(_vnode.toString())
	}
}
const memoizedRender = fastMemoize(render, {})

/** Render virtual node to HTML string */
export async function renderToString<P extends Obj = Obj>(vnode?: { toString(): string } | VNode<P> | Promise<VNode<P>>): Promise<string> {
	if (vnode === null || vnode === undefined) {
		return ""
	}
	const _vnode = await vnode

	if (typeof _vnode === 'object' && 'type' in _vnode) {
		const children = new Array(flatten(_vnode.children || [])) as Array<JSX.Element>
		switch (typeof _vnode.type) {
			case "function": {
				const _props: PropsExtended<P, Message> = { ..._vnode.props, children: [...children || []] }

				const resolvedVNode = await _vnode.type(_props)
				return typeof resolvedVNode.type === "function" && children.length === 0
					? await memoizedRenderToString(resolvedVNode)
					: await renderToString(resolvedVNode) // If elem have children, we don't use the cache system (yet).
			}

			case "string": {
				const notSelfClosing = !selfClosingTags.includes(_vnode.type.toLocaleLowerCase())
				const childrenHtml = (notSelfClosing && _vnode.children && _vnode.children.length > 0)
					? (await Promise.all(children.map(child => {
						return renderToString(child)
					}))).join("")
					: ""

				const nodeProps = _vnode.props || {}
				const attributesHtml = (Object.keys(nodeProps)
					.map(propName => {
						const propValue = nodeProps[propName]
						if (typeof propValue === "function") {
							// eslint-disable-next-line fp/no-mutating-methods
							fnStore.push(propValue as (e: Event) => unknown)
						}
						//if (propValue === null || propValue === undefined)
						switch (propName) {
							case "style": return `${propName}="${propsToCSS(propValue as CSSProperties)}"`

							default: return /*propValue &&*/ typeof propValue === "string"
								? `${propName}="${encodeHTML(propValue)}"`
								: typeof propValue === "function"
									? `${propName.toLowerCase()}="${fnStore.length - 1}"`
									: ""
						}
					})
					.filter(attrHTML => attrHTML?.length > 0)
					.join(" ")
				)

				return notSelfClosing
					? `<${_vnode.type}${separateWithSpace(attributesHtml)}>${childrenHtml}</${_vnode.type}>`
					: `<${_vnode.type}${separateWithSpace(attributesHtml)}>`
			}

			default:
				console.error(`\n Somatic render(): invalid vnode '${JSON.stringify(_vnode)}' of type "${typeof _vnode}"; `)
				return _vnode.toString()
		}
	}
	else {
		return _vnode.toString()
	}
}
const memoizedRenderToString = memoize(renderToString, (obj: VNode) => obj.props)

/** Attach event listeners from element to corresponding nodes in container */
export function hydrate(element: HTMLElement): void {
	[...element.attributes].forEach(attr => {
		// Event attributes will give place to an event listener and be removed.
		if (isEventKey(attr.name)) {
			const callback: (evt: Event) => void = fnStore[parseInt(attr.value)]
			setAttribute(element, attr.name, callback)
			element.addEventListener(eventNames[attr.name], { handleEvent: callback })
			element.removeAttribute(attr.name)
		}
		else if (attr.name === "htmlfor") { // the innerHTML that we are hydrating might have turned the htmlFor to lowercase in some browsers
			setAttribute(element, "htmlFor", attr.value)
			element.removeAttribute(attr.name)
		}
		else if (attr.name === "classname") { // the innerHTML that we are hydrating might have turned the className to lowercase in some browsers
			setAttribute(element, "className", attr.value)
			element.removeAttribute(attr.name)
		}
		else {
			setAttribute(element, attr.name, attr.value)
		}
	});[...element["children"]].forEach(child => {
		hydrate(child as HTMLElement)
	})
}

/** Compares an HTML element with a node, and updates only the parts of the HTML element that are different
 * @param rootElement An HTML element that will be updated
 * @param node A node obtained by rendering a VNode
 */
export function updateDOM(rootElement: Element, node: Node) { morphdom(rootElement, node) }

/** */
export function propsToCSS(props: CSSProperties, important = false) {
	if (typeof props === "object") {
		return Object.keys(props)
			.map((key) => `${camelCaseToDash(key)}: ${(props)[key as keyof typeof props]}${important === true ? " !important" : ""}`)
			.join("; ")
			.concat(";")
	}
	else {
		console.warn(`Input "${JSON.stringify(props)}" to somatic.propsToCSS() is of type ${typeof props}, returning empty string`)
		return ""
	}
}

/** */
export function encodeHTML(str: string) {
	//return encodeURI(s)
	//return encodeURIComponent(s)
	//return str.replace(/"/g, '\\"');

	if (typeof str === "string") {
		return str
			.split('&')
			.join('&amp;')
			.split('<')
			.join('&lt;')
			.split('"')
			.join('&quot;')
			.split("'")
			.join('&#39;')
	}
	else {
		console.warn(`Input "${str}" to somatic.encodeHTML() is of type ${typeof str}, returning empty string`)
		return ""
	}
}


/*export function difference(object: Obj, base: Obj): Obj {
	function changes(_object: Obj, _base: Obj) {
		return transform(_object, function (result: Obj, value, key) {
			if (!isEqual(value, _base[key])) {
				result[key] = (isObject(value) && isObject(_base[key])) ? changes(value, _base[key]) : value
			}
		})
	}
	return changes(object, base)
}*/