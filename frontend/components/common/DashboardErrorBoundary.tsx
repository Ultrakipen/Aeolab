"use client"

import { Component, type ReactNode } from "react"

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-sm border border-red-100 text-center space-y-3">
            <p className="text-base font-semibold text-gray-900">일시적인 오류가 발생했습니다</p>
            <p className="text-sm text-gray-500">페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              새로고침
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
