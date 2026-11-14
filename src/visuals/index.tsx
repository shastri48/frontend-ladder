import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'

type L = LazyExoticComponent<ComponentType>
const js = (name: string): L => lazy(() => import('./js').then((m) => ({ default: (m as unknown as Record<string, ComponentType>)[name] })))
const css = (name: string): L => lazy(() => import('./css').then((m) => ({ default: (m as unknown as Record<string, ComponentType>)[name] })))
const web = (name: string): L => lazy(() => import('./web').then((m) => ({ default: (m as unknown as Record<string, ComponentType>)[name] })))
const react = (name: string): L => lazy(() => import('./react').then((m) => ({ default: (m as unknown as Record<string, ComponentType>)[name] })))

export const VISUALS: Record<string, L> = {
  'url-journey': web('UrlJourney'),
  'http-anatomy': web('HttpAnatomy'),
  'rendering-pipeline': web('RenderingPipeline'),
  'script-loading': web('ScriptLoading'),
  'cache-layers': web('CacheLayers'),
  'cors-preflight': web('CorsPreflight'),
  'auth-flow': web('AuthFlow'),
  'storage-compare': web('StorageCompare'),
  'web-vitals': web('WebVitals'),
  'rendering-strategies': web('RenderingStrategies'),
  'box-model': css('BoxModel'),
  specificity: css('Specificity'),
  'layout-playground': css('LayoutPlayground'),
  'rem-em': css('RemEm'),
  'scope-chain': js('ScopeChain'),
  'execution-context': js('ExecutionContext'),
  'event-loop': js('EventLoop'),
  'prototype-chain': js('PrototypeChain'),
  'event-propagation': js('EventPropagation'),
  'promise-combinators': js('PromiseCombinators'),
  'debounce-throttle': js('DebounceThrottle'),
  'concurrency-limit': js('ConcurrencyLimit'),
  'vdom-diff': react('VdomDiff'),
  'react-rerender': react('ReactRerender'),
  'virtual-list': react('VirtualList'),
  'fiber-phases': react('FiberPhases'),
  'radio-framework': react('RadioFramework'),
}

export function Visual({ id }: { id: string }) {
  const C = VISUALS[id]
  if (!C) {
    return import.meta.env.DEV ? (
      <div className="my-6 rounded-xl border border-dashed border-rose-500 p-4 text-sm text-rose-500">Unknown visual: {id}</div>
    ) : null
  }
  return (
    <Suspense fallback={<div className="card my-8 h-64 animate-pulse" />}>
      <C />
    </Suspense>
  )
}
