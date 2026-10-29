/**
 * 视图错误边界：单个视图渲染抛错时只降级这一块，不再让整个工作台黑屏。
 * 报错文本直接显示在界面上，便于定位（控制台同一份）。
 */

import * as React from 'react'

import { h } from '../h'

type Props = { label?: string; children?: React.ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error(`[dsh-vscode-ide] 「${this.props.label ?? '视图'}」渲染失败`, error, info)
  }

  render() {
    if (this.state.error) {
      return h(
        'div',
        { className: 'dsv-boundary' },
        h('div', { className: 'dsv-boundary-title' }, `「${this.props.label ?? '视图'}」渲染失败`),
        h('div', { className: 'dsv-boundary-message' }, this.state.error.message || String(this.state.error)),
        h(
          'button',
          {
            className: 'dsv-boundary-retry',
            onClick: () => this.setState({ error: null })
          },
          '重试'
        )
      )
    }
    return this.props.children as React.ReactElement
  }
}
