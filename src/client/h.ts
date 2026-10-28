/**
 * JSX 工厂。
 *
 * 插件 bundle 用的是 React 的「经典」转换（h / Fragment），不是 automatic
 * runtime —— 因为 DSH 的模块加载器只保证提供 `react` 与 `react-dom/client`，
 * 不保证 `react/jsx-runtime`。
 */
import * as React from 'react'

export const h = React.createElement as unknown as (
  type: unknown,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
) => React.ReactElement

export const Fragment = React.Fragment
