import type { ActionOptions, HttpMethod, HypermediaResponse } from './types'
import { buildRequest, executeRequest } from './request'

async function request(method: HttpMethod, url: string, options: ActionOptions = {}): Promise<HypermediaResponse> {
	const req = buildRequest({ ...options, method, url })
	return executeRequest(req)
}

export function GET(url: string, options: ActionOptions = {}): Promise<HypermediaResponse> {
	return request('GET', url, options)
}

export function POST(url: string, options: ActionOptions = {}): Promise<HypermediaResponse> {
	return request('POST', url, options)
}

export function PUT(url: string, options: ActionOptions = {}): Promise<HypermediaResponse> {
	return request('PUT', url, options)
}

export function PATCH(url: string, options: ActionOptions = {}): Promise<HypermediaResponse> {
	return request('PATCH', url, options)
}

export function DELETE(url: string, options: ActionOptions = {}): Promise<HypermediaResponse> {
	return request('DELETE', url, options)
}
