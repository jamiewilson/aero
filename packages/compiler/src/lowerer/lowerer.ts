/**
 * Walks linkedom DOM and lowers to IR (elements, components, slots, for, if/else chains, switch).
 *
 * @remarks
 * **`<template>`:** A plain `<template>` in source is still lowered through {@link compileElement},
 * which emits `<template>...</template>`. **Wrapperless** cases (no `<template>` in output,
 * children from `template.content`): `if` / `else-if` / `else` chains via
 * {@link compileWrapperAwareBranch}; `data-for` / `for` on `<template>` via
 * {@link compileWrapperlessNode} for the loop body.
 */
import type { IRNode, IRReactiveComponentLivePropExpr } from '../ir'
import type { LowererDiag, LowererReactiveState } from './types'

import * as CONST from '../constants'
import { getBuildDirectiveAttribute } from '../build-directive-attributes'
import * as Helper from '../helpers'
import { tokenizeCurlyInterpolation } from '../tokenizer'
import { textReferencesStateBindings, referencesStateBindingExpression } from '../state-mount-codegen'
import { Resolver } from '../resolver'
import { CompileError, type ComponentLivePropMetadata } from '../types'
import { collectForDirectiveBindingNames } from '../for-directive'
import {
	parseComponentAttributes,
	parseElementAttributes,
	isSingleWrappedExpression,
	warnWrapperlessTemplateAttributes,
} from './attributes'
import { compileConditionalChain, hasElseAttr, hasElseIfAttr, hasIfAttr } from './conditionals'
import {
	compileElementDefaultContent,
	compileSlot,
	compileSlotDefaultContent,
	type SlotDefaultContentDeps,
} from './slots'
import { compileSwitchContainer, hasCaseAttr, parentIsSwitchContainer } from './switch'
import { getEffectiveChildNodes, isTemplateElement } from './template'

/** Internal lowerer: walks DOM nodes and builds IR; used by compile(). */
export class Lowerer {
	private resolver: Resolver
	private slotCounter = 0
	private readonly diag: LowererDiag
	private readonly reactiveState: LowererReactiveState | null

	private readonly hypermedia: boolean
	private readonly componentLiveProps: Record<string, readonly ComponentLivePropMetadata[]>

	constructor(
		resolver: Resolver,
		diag?: LowererDiag,
		stateBindingNames?: ReadonlySet<string>,
		options?: {
			writableStateBindingNames?: ReadonlySet<string>
			hypermedia?: boolean
			componentLiveProps?: Record<string, readonly ComponentLivePropMetadata[]>
		}
	) {
		this.resolver = resolver
		this.diag = diag
		this.hypermedia = options?.hypermedia === true
		this.componentLiveProps = options?.componentLiveProps ?? {}
		this.reactiveState =
			stateBindingNames && stateBindingNames.size > 0
				? createLowererReactiveState(
						stateBindingNames,
						options?.writableStateBindingNames ?? stateBindingNames
					)
				: null
	}

	private get slotDeps(): SlotDefaultContentDeps {
		return {
			parseElementAttributes: (n: any) =>
				parseElementAttributes(
					this.resolver,
					this.diag,
					n,
					this.reactiveState ?? undefined,
					this.hypermedia
				),
			parseComponentAttributes: (n: any) => parseComponentAttributes(n, this.diag),
		}
	}

	private compileSlotDefaultContent(
		nodes: NodeList | undefined,
		skipInterpolation: boolean
	): string {
		return compileSlotDefaultContent(nodes, skipInterpolation, this.slotDeps, (n, s) =>
			this.compileElementDefaultContent(n, s)
		)
	}

	private compileElementDefaultContent(node: any, skipInterpolation: boolean): string {
		return compileElementDefaultContent(node, skipInterpolation, this.slotDeps, (nodes, skip) =>
			this.compileSlotDefaultContent(nodes, skip)
		)
	}

	compileNode(node: any, skipInterpolation = false, outVar = '__out'): IRNode[] {
		switch (node.nodeType) {
			case 3:
				return this.compileText(node, skipInterpolation, outVar)
			case 1:
				return this.compileElement(node, skipInterpolation, outVar)
			default:
				return []
		}
	}

	compileFragment(nodes: NodeList | undefined): IRNode[] {
		return this.compileChildNodes(nodes, false, '__out')
	}

	/**
	 * Compiles `node`'s inner structure via {@link getEffectiveChildNodes} without emitting the
	 * node's outer tags. For `<template>`, inner markup comes from `template.content`, so output
	 * IR never includes `<template>` / `</template>`.
	 */
	compileWrapperlessNode(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const children = getEffectiveChildNodes(node)
		return this.compileChildNodes(children, skipInterpolation, outVar)
	}

	/**
	 * Compiles a branch body: {@link compileElement} for normal elements; for `<template>` only,
	 * {@link compileWrapperlessNode} so the tag is not present in the output. Used by conditional
	 * chains and intended for `switch` branches.
	 */
	compileWrapperAwareBranch(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		if (isTemplateElement(node)) {
			warnWrapperlessTemplateAttributes(this.diag, node)
			return this.compileWrapperlessNode(node, skipInterpolation, outVar)
		}
		return this.compileElement(node, skipInterpolation, outVar)
	}

	private compileChildNodes(
		nodes: NodeList | undefined,
		skipInterpolation: boolean,
		outVar: string
	): IRNode[] {
		if (!nodes) return []
		const out: IRNode[] = []
		let i = 0
		while (i < nodes.length) {
			const node = nodes[i]

			if (hasIfAttr(node)) {
				const { nodes: chainNodes, consumed } = compileConditionalChain(
					{
						compileBranchBody: (n, skip, o) => this.compileWrapperAwareBranch(n, skip, o),
						bindingNames: this.reactiveState?.bindingNames,
					},
					this.diag,
					nodes,
					i,
					skipInterpolation,
					outVar
				)
				const ifNode = chainNodes[0]
				if (ifNode?.kind === 'If' && ifNode.reactive && this.reactiveState) {
					const bindId = this.reactiveState.nextIfBindId()
					const branches = [
						{ conditionExpr: ifNode.condition, body: ifNode.body },
						...(ifNode.elseIf ?? []).map(branch => ({
							conditionExpr: branch.condition,
							body: branch.body,
						})),
						...(ifNode.else ? [{ conditionExpr: null as string | null, body: ifNode.else }] : []),
					]
					out.push({ kind: 'ReactiveIfBind', bindId, branches })
					out.push({ ...ifNode, bindId })
				} else {
					out.push(...chainNodes)
				}
				i += consumed
				continue
			}

			out.push(...this.compileNode(node, skipInterpolation, outVar))
			i++
		}
		return out
	}

	private compileText(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const text = node.textContent || ''
		if (!text) return []
		if (
			!skipInterpolation &&
			this.reactiveState &&
			textReferencesStateBindings(text, this.reactiveState.bindingNames, value =>
				tokenizeCurlyInterpolation(value, { attributeMode: false })
			)
		) {
			const bindId = this.reactiveState.nextTextBindId()
			const content = `<span data-aero-text="${bindId}" style="display:contents">${Helper.compileInterpolation(text)}</span>`
			return [
				{ kind: 'Append', content, outVar },
				{
					kind: 'ReactiveTextBind',
					bindId,
					readExpr: Helper.compileReactiveTextReadExpr(text),
				},
			]
		}
		const content = skipInterpolation
			? Helper.escapeBackticks(text)
			: Helper.compileInterpolation(text)
		return [{ kind: 'Append', content, outVar }]
	}

	/**
	 * Lower a single element node to IR (tags + children). Uses `node.childNodes` for children;
	 * for `<template>`, wrapperless APIs in `template.ts` should be used when the tag must not
	 * appear in output.
	 */
	private compileElement(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const tagName = node.tagName.toLowerCase()
		warnWrapperlessTemplateAttributes(this.diag, node)

		if (tagName === CONST.TAG_SLOT) {
			return compileSlot(node, skipInterpolation, outVar, (nodes, skip) =>
				this.compileSlotDefaultContent(nodes, skip)
			)
		}

		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponent(node, tagName, skipInterpolation, outVar)
		}

		const {
			attrString,
			loopData,
			switchExpr,
			passDataExpr,
			eventBinds,
			textBinds,
			busyBinds,
			showBinds,
			htmlBinds,
			classBinds,
			propertyBinds,
			modelBinds,
		} = parseElementAttributes(
			this.resolver,
			this.diag,
			node,
			this.reactiveState ?? undefined,
			this.hypermedia
		)
		const childSkip =
			skipInterpolation || tagName === 'style' || tagName === 'script'

		if (loopData && switchExpr) {
			throw new CompileError({
				message: 'Cannot combine `switch` with `for` / `data-for` on the same element.',
				file: this.diag?.file,
			})
		}

		if (switchExpr && (hasIfAttr(node) || hasElseIfAttr(node) || hasElseAttr(node))) {
			throw new CompileError({
				message: 'Cannot combine `switch` with `if` / `else-if` / `else` on the same element.',
				file: this.diag?.file,
			})
		}

		// `case` (non-native) and misplaced `default` outside a switch are mistakes — fail loud.
		// `default` is native only on `<track>`, so a bare one there passes through untouched.
		const defaultAttr = getBuildDirectiveAttribute(node, CONST.ATTR_DEFAULT)
		const explicitDefault = defaultAttr != null && defaultAttr.name !== CONST.ATTR_DEFAULT
		const bareDefaultOnNonTrack =
			defaultAttr?.name === CONST.ATTR_DEFAULT && tagName !== 'track'
		const misplacedDefault = explicitDefault || bareDefaultOnNonTrack
		if ((hasCaseAttr(node) || misplacedDefault) && !parentIsSwitchContainer(node)) {
			throw new CompileError({
				message:
					'`case` and `default` must be direct children of an element with `switch` / `aero-switch`.',
				file: this.diag?.file,
			})
		}

		// Wrapperless `<template data-for>` / `<template for>`: body is template contents only.
		if (loopData && isTemplateElement(node)) {
			const inner = this.compileWrapperlessNode(node, childSkip, outVar)
			return this.wrapForLoop(loopData, inner, [
				...eventBinds,
				...textBinds,
				...busyBinds,
				...showBinds,
				...htmlBinds,
				...classBinds,
				...propertyBinds,
				...modelBinds,
			])
		}

		if (switchExpr && isTemplateElement(node)) {
			const sw = compileSwitchContainer(
				{
					compileBranchBody: (n, skip, o) => this.compileWrapperAwareBranch(n, skip, o),
				},
				this.diag,
				node,
				switchExpr,
				childSkip,
				outVar
			)
			return [sw]
		}

		if (switchExpr && CONST.VOID_TAGS.has(tagName)) {
			throw new CompileError({
				message:
					'`switch` cannot be used on a void element (no room for `case` / `default` children).',
				file: this.diag?.file,
			})
		}

		const inner: IRNode[] = []

		if (CONST.VOID_TAGS.has(tagName)) {
			inner.push({
				kind: 'Append',
				content: `<${tagName}${attrString}>`,
				outVar,
			})
		} else {
			inner.push({
				kind: 'Append',
				content: `<${tagName}${attrString}>`,
				outVar,
			})

			const isScript = tagName === 'script'
			const isStyle = tagName === 'style'
			let closeBlock = false

			if (isScript && passDataExpr) {
				const result = this.emitScriptPassDataIR(passDataExpr, node, outVar)
				inner.push(...result.nodes)
				closeBlock = result.closeBlock
			} else if (isStyle && passDataExpr) {
				inner.push({ kind: 'StylePassData', passDataExpr, outVar })
			}

			if (switchExpr) {
				inner.push(
					compileSwitchContainer(
						{
							compileBranchBody: (n, skip, o) => this.compileWrapperAwareBranch(n, skip, o),
						},
						this.diag,
						node,
						switchExpr,
						childSkip,
						outVar
					)
				)
			} else {
				inner.push(...this.compileChildNodes(node.childNodes, childSkip, outVar))
			}

			if (closeBlock) {
				inner.push({ kind: 'Append', content: '\\n}\\n', outVar })
			}

			inner.push({ kind: 'Append', content: `</${tagName}>`, outVar })
		}

		if (loopData) {
			return this.wrapForLoop(loopData, inner, [
				...eventBinds,
				...textBinds,
				...busyBinds,
				...showBinds,
				...htmlBinds,
				...classBinds,
				...propertyBinds,
				...modelBinds,
			])
		}
	return [
		...inner,
		...eventBinds,
		...textBinds,
		...busyBinds,
		...showBinds,
		...htmlBinds,
		...classBinds,
		...propertyBinds,
		...modelBinds,
	]
	}

	private emitScriptPassDataIR(
		passDataExpr: string,
		node: any,
		outVar: string
	): { nodes: IRNode[]; closeBlock: boolean } {
		const isModule = node.getAttribute('type') === 'module'
		const nodes: IRNode[] = [{ kind: 'ScriptPassData', passDataExpr, isModule, outVar }]
		return { nodes, closeBlock: !isModule }
	}

	/**
	 * Slot content must use the same sibling-based rules as {@link compileChildNodes}, including
	 * `if` / `else-if` / `else` chains. A plain `for` over `compileNode` would miss those chains
	 * (e.g. wrapperless `<template if>` inside `<base-layout>`).
	 */
	private compileSlotChildList(
		children: any[],
		skipInterpolation: boolean,
		outVar: string
	): IRNode[] {
		const slotIR: IRNode[] = []
		let i = 0
		while (i < children.length) {
			const child = children[i]
			if (child.nodeType === 1) {
				const childTagName = child.tagName?.toLowerCase()
				if (
					childTagName === CONST.TAG_SLOT &&
					child.hasAttribute(CONST.ATTR_NAME) &&
					child.hasAttribute(CONST.ATTR_SLOT)
				) {
					const passthroughName = child.getAttribute(CONST.ATTR_NAME)
					const defaultContent = this.compileSlotDefaultContent(child.childNodes, skipInterpolation)
					slotIR.push({
						kind: 'Slot',
						name: passthroughName,
						defaultContent,
						outVar,
					})
					i++
					continue
				}
			}

			if (child.nodeType === 1 && hasIfAttr(child)) {
				const parent = child.parentNode
				if (parent?.childNodes) {
					const startIndex = Array.prototype.indexOf.call(parent.childNodes as NodeList, child)
					if (startIndex >= 0) {
						const { nodes: chainNodes, consumed } = compileConditionalChain(
							{
								compileBranchBody: (n, skip, o) => this.compileWrapperAwareBranch(n, skip, o),
							},
							this.diag,
							parent.childNodes,
							startIndex,
							skipInterpolation,
							outVar
						)
						slotIR.push(...chainNodes)
						const consumedSet = new Set<unknown>()
						for (let j = startIndex; j < startIndex + consumed; j++) {
							consumedSet.add(parent.childNodes[j])
						}
						while (i < children.length && consumedSet.has(children[i])) {
							i++
						}
						continue
					}
				}
			}

			slotIR.push(...this.compileNode(child, skipInterpolation, outVar))
			i++
		}
		return slotIR
	}

	private compileComponent(
		node: any,
		tagName: string,
		skipInterpolation: boolean,
		outVar: string
	): IRNode[] {
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = Helper.kebabToCamelCase(kebabBase)
		const isLayout = tagName.endsWith('-layout')
		const { propsString } = parseComponentAttributes(node, this.diag)
		this.validateComponentBindAttrsRequireState(node, tagName)
		const livePropExprs = this.collectComponentLivePropExprs(node)
		this.validateRequiredComponentLiveProps(tagName, kebabBase, baseName, livePropExprs)
		this.validateBindableComponentLiveProps(tagName, kebabBase, baseName, livePropExprs)
		const componentBindId = this.reactiveState
			? this.reactiveState.nextComponentBindId()
			: undefined

		const slotVarMap: Record<string, string> = {}
		const slotContentMap: Record<string, any[]> = {
			[CONST.SLOT_NAME_DEFAULT]: [],
		}

		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i]
				let slotName = CONST.SLOT_NAME_DEFAULT
				if (child.nodeType === 1) {
					const slotAttr = child.getAttribute(CONST.ATTR_SLOT)
					if (slotAttr) slotName = slotAttr
				}
				slotContentMap[slotName] = slotContentMap[slotName] || []
				slotContentMap[slotName]!.push(child)
			}
		}

		const slots: Record<string, IRNode[]> = {}
		for (const [slotName, children] of Object.entries(slotContentMap)) {
			const slotVar = `__slot_${this.slotCounter++}`
			slotVarMap[slotName] = slotVar

			slots[slotName] = this.compileSlotChildList(children, skipInterpolation, slotVar)
		}

		const componentNode: IRNode = {
			kind: 'Component',
			baseName,
			propsString,
			slots,
			slotVarMap,
			componentBindId,
			isLayout,
			outVar,
		}
		if (componentBindId === undefined) return [componentNode]
		return [
			componentNode,
			{
				kind: 'ReactiveComponentBind',
				bindId: componentBindId,
				componentExpr: baseName,
				livePropExprs,
			},
		]
	}

	private collectComponentLivePropExprs(node: any): Record<string, IRReactiveComponentLivePropExpr> {
		const out: Record<string, IRReactiveComponentLivePropExpr> = {}
		if (!this.reactiveState || !node.attributes) return out
		for (let i = 0; i < node.attributes.length; i++) {
			const attr = node.attributes[i]
			const name = String(attr.name ?? '')
			if (!name || name === CONST.ATTR_PROPS || name.startsWith(`aero-${CONST.ATTR_PROPS}`)) {
				continue
			}
			if (name.endsWith(':readonly')) {
				throw new CompileError({
					message: `Component live prop \`${name}\` is obsolete; use \`${name.slice(0, -':readonly'.length)}="{ ... }"\` because live props are readonly by default.`,
					file: this.diag?.file,
				})
			}
			const value = String(attr.value ?? '')
			const bindName = name.startsWith('bind:') ? name.slice('bind:'.length) : null
			if (bindName !== null && !isSingleWrappedExpression(value)) {
				throw new CompileError({
					message: `Component bind prop \`${name}\` must reference one writable state binding.`,
					file: this.diag?.file,
				})
			}
			if (!isSingleWrappedExpression(value)) continue
			const expr = Helper.stripBraces(value)
			if (bindName !== null) {
				if (!this.reactiveState.writableBindingNames.has(expr)) {
					throw new CompileError({
						message: `Component bind prop \`${name}\` must reference one writable state binding.`,
						file: this.diag?.file,
					})
				}
				out[bindName] = { expr, mutable: true }
				continue
			}
			if (!this.reactiveState.bindingNames.has(expr)) continue
			out[name] = { expr, mutable: false }
		}
		return out
	}

	private validateComponentBindAttrsRequireState(node: any, tagName: string): void {
		if (this.reactiveState || !node.attributes) return
		for (let i = 0; i < node.attributes.length; i++) {
			const attr = node.attributes[i]
			const name = String(attr.name ?? '')
			if (!name.startsWith('bind:')) continue
			throw new CompileError({
				message: `Component bind prop \`${name}\` on <${tagName}> requires a writable state binding in \`<script is:state>\`.`,
				file: this.diag?.file,
			})
		}
	}

	private getComponentLivePropMetadata(
		tagName: string,
		kebabBase: string,
		baseName: string
	): readonly ComponentLivePropMetadata[] {
		return (
			this.componentLiveProps[baseName] ??
			this.componentLiveProps[kebabBase] ??
			this.componentLiveProps[tagName] ??
			[]
		)
	}

	private validateRequiredComponentLiveProps(
		tagName: string,
		kebabBase: string,
		baseName: string,
		livePropExprs: Record<string, IRReactiveComponentLivePropExpr>
	): void {
		if (!this.reactiveState) return
		for (const prop of this.getComponentLivePropMetadata(tagName, kebabBase, baseName)) {
			const propName = prop.propName || prop.name
			if (!prop.required || livePropExprs[propName] !== undefined) continue
			throw new CompileError({
				message: `Required live prop \`${propName}\` for <${tagName}> must be passed as a state signal.`,
				file: this.diag?.file,
			})
		}
	}

	private validateBindableComponentLiveProps(
		tagName: string,
		kebabBase: string,
		baseName: string,
		livePropExprs: Record<string, IRReactiveComponentLivePropExpr>
	): void {
		if (!this.reactiveState) return
		for (const prop of this.getComponentLivePropMetadata(tagName, kebabBase, baseName)) {
			const propName = prop.propName || prop.name
			const passed = livePropExprs[propName]
			if (passed?.mutable === true && !prop.bindable) {
				throw new CompileError({
					message: `Child prop \`${propName}\` for <${tagName}> must be declared with \`Aero.bindable()\` before it can be passed with \`bind:${propName}\`.`,
					file: this.diag?.file,
				})
			}
			if (prop.writes && passed?.mutable === false) {
				throw new CompileError({
					message: `Live prop \`${propName}\` for <${tagName}> is readonly; use \`bind:${propName}="{ ... }"\` to allow child mutation.`,
					file: this.diag?.file,
				})
			}
		}
	}

	private wrapForLoop(
		loopData: { binding: string; items: string; keyExpr?: string },
		body: IRNode[],
		trailing: IRNode[]
	): IRNode[] {
		const reactive =
			this.reactiveState != null &&
			referencesStateBindingExpression(loopData.items, this.reactiveState.bindingNames)
		if (reactive && !loopData.keyExpr) {
			throw new CompileError({
				message: 'Reactive for loops require `key="{ ... }"` when the iterable references state.',
				file: this.diag?.file,
			})
		}
		const loopBody = [...body, ...trailing]
		let forNode: IRNode = {
			kind: 'For',
			binding: loopData.binding,
			items: loopData.items,
			body: loopBody,
			...(loopData.keyExpr ? { keyExpr: loopData.keyExpr } : {}),
			...(reactive ? { reactive: true } : {}),
		}
		const nodes: IRNode[] = [forNode]
		if (reactive && this.reactiveState && loopData.keyExpr) {
			const bindId = this.reactiveState.nextForBindId()
			forNode = { ...(forNode as import('../ir').IRFor), bindId }
			nodes[0] = forNode
			nodes.push({
				kind: 'ReactiveForBind',
				bindId,
				binding: loopData.binding,
				bindingNames: collectForDirectiveBindingNames(
					`const ${loopData.binding} of __aeroItems`
				),
				itemsExpr: loopData.items,
				keyExpr: loopData.keyExpr,
				body: loopBody,
			})
		}
		return nodes
	}
}

function createLowererReactiveState(
	bindingNames: ReadonlySet<string>,
	writableBindingNames: ReadonlySet<string>
): LowererReactiveState {
	let textBindId = 0
	let eventBindId = 0
	let busyBindId = 0
	let componentBindId = 0
	let showBindId = 0
	let htmlBindId = 0
	let classBindId = 0
	let propertyBindId = 0
	let modelBindId = 0
	let ifBindId = 0
	let forBindId = 0
	return {
		bindingNames,
		writableBindingNames,
		nextTextBindId: () => textBindId++,
		nextEventBindId: () => eventBindId++,
		nextBusyBindId: () => busyBindId++,
		nextComponentBindId: () => componentBindId++,
		nextShowBindId: () => showBindId++,
		nextHtmlBindId: () => htmlBindId++,
		nextClassBindId: () => classBindId++,
		nextPropertyBindId: () => propertyBindId++,
		nextModelBindId: () => modelBindId++,
		nextIfBindId: () => ifBindId++,
		nextForBindId: () => forBindId++,
	}
}
