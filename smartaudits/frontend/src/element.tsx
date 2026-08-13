import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import styleText from './styles.css?inline'
import type { HostContext } from './types'

class DumaSmartAuditsModule extends HTMLElement {
  private root: Root | null = null
  private mountPoint: HTMLDivElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = styleText
    this.mountPoint = document.createElement('div')
    shadow.append(style, this.mountPoint)
  }

  connectedCallback() {
    if (!this.root) this.root = createRoot(this.mountPoint)
  }

  setHostContext(context: HostContext) {
    if (context.protocolVersion !== '1.0' || context.moduleId !== 'smartaudits') {
      this.dispatchEvent(new CustomEvent('duma:module-error', {
        bubbles: true,
        composed: true,
        detail: { code: 'CONTRACT_MISMATCH', recoverable: false },
      }))
      return
    }
    if (!this.root) this.root = createRoot(this.mountPoint)
    this.root.render(<App context={context} />)
    this.dispatchEvent(new CustomEvent('duma:module-ready', {
      bubbles: true,
      composed: true,
      detail: {
        protocolVersion: '1.0',
        moduleId: 'smartaudits',
        capabilities: ['dashboard', 'tenant-coverage', 'human-review-queue'],
      },
    }))
  }

  disconnectedCallback() {
    window.setTimeout(() => {
      if (!this.isConnected) {
        this.root?.unmount()
        this.root = null
      }
    })
  }
}

if (!customElements.get('duma-smartaudits-module')) {
  customElements.define('duma-smartaudits-module', DumaSmartAuditsModule)
}
