'use client'
import React from 'react'

// ONE BROKEN TAB SHOULD NOT KILL THE WHOLE DEAL.
//
// 10 Sep 2026. Melissa clicked Compliance on Wesley Perrott and got Chrome's
// "This page couldn't load" - the entire deal page gone, every other tab with
// it, and no way to see what went wrong without opening the developer console.
// The error itself was one line of one component.
//
// React tears down the whole tree when a render throws and nothing catches it.
// This catches it at the tab, so the deal, its header, its documents and every
// other tab keep working, and the failure is reported where it happened.
//
// AND IT SAYS WHAT BROKE. In production React strips the messages out of its own
// errors, but not out of ours, and the component stack survives - so the panel
// names the component that threw. That is the difference between "the portal is
// broken" and a fix in ten minutes.
//
// Fabio, 10 Sep 2026: "I cannot have this happen again."

type Props = { tab: string; children: React.ReactNode }
type State = { error: Error | null; where: string }

export default class TabBoundary extends React.Component<Props, State> {
  state: State = { error: null, where: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // The component stack is the useful half and it is not in the message.
    const where = (info?.componentStack || '')
      .split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6).join(' → ')
    this.setState({ where })
    // Still in the console, whole, for anyone who wants the stack.
    console.error(`[${this.props.tab} tab]`, error, info?.componentStack)
  }

  // A different deal, or a different tab, deserves a fresh try rather than the
  // last deal's error.
  componentDidUpdate(prev: Props) {
    if (prev.tab !== this.props.tab && this.state.error) this.setState({ error: null, where: '' })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="bg-white border border-[#E5B7B2] rounded-xl p-5">
        <p className="text-[15px] font-semibold text-[#B23A34] mb-1">
          The {this.props.tab} tab could not be drawn
        </p>
        <p className="text-[13px] text-[#8E3A32] mb-3 leading-relaxed">
          Every other tab on this deal still works, and nothing has been lost — this is a fault in
          the screen, not in the record. Send this panel to whoever is looking after the portal.
        </p>
        <div className="bg-[#FDF0EF] border border-[#F0D2CF] rounded-lg px-3 py-2 mb-3">
          <p className="text-[12px] font-mono text-[#8E3A32] break-words">{this.state.error.message}</p>
          {this.state.where && (
            <p className="text-[11px] font-mono text-[#B87069] mt-1.5 break-words">{this.state.where}</p>
          )}
        </div>
        <button onClick={() => this.setState({ error: null, where: '' })}
          className="text-[12.5px] font-medium text-[#3E4C59] border border-[#D7DCE1] bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50">
          Try this tab again
        </button>
      </div>
    )
  }
}
