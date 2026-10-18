import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { I18nProvider } from '@/i18n/solid'
import { vi } from 'vitest'
import type { JSX } from 'solid-js'
export const catalogServiceApi = { list: vi.fn(), create: vi.fn() }
export const testApi = { get: vi.fn() }
vi.mock('@/api/services', () => ({ listServices: (...args: unknown[]) => catalogServiceApi.list(...args).then((page: any) => ({...page,items:page.data ?? page.items,nextCursor:page.nextCursor ?? (page.total>10 ? 'next' : null)})), createService: (...args:unknown[])=>catalogServiceApi.create(...args) }))
vi.mock('@/api/catalog', () => ({ listProducts: (...args: unknown[]) => testApi.get('/v1/products', ...args).then((response: any) => ({items:response.data.data,total:response.data.total,nextCursor:response.data.total>10?'next':null})) }))
vi.mock('@/api/users', () => ({ listUsers: (...args:unknown[]) => testApi.get('/usuarios', ...args).then((response:any)=>({items:response.data.data})) }))
export const replaceProperty = (target:any,key:string,value:any) => { const old=target[key]; target[key]=value; return ()=>{target[key]=old} }
export function TestProvider(props:{children:JSX.Element}) {return <I18nProvider><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{props.children}</QueryClientProvider></I18nProvider>}
export { Route } from '@solidjs/router'
export const TestRoutes = (props:{children:JSX.Element}) => props.children
