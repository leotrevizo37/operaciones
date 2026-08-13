import { createRoot, Root } from 'react-dom/client'
import App from './App'
import styleText from './styles.css?inline'
import type { HostContext } from './types'

class DumaExperienceModule extends HTMLElement {
  private root: Root | null = null
  private context: HostContext | null = null
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
    if (context.protocolVersion !== '1.0' || context.moduleId !== 'experiencia-digital') {
      this.dispatchEvent(new CustomEvent('duma:module-error', { bubbles: true, composed: true, detail: { code: 'CONTRACT_MISMATCH', recoverable: false } }))
      return
    }
    this.context = context
    if (!this.root) this.root = createRoot(this.mountPoint)
    this.root.render(<App context={context} />)
    this.dispatchEvent(new CustomEvent('duma:module-ready', { bubbles: true, composed: true, detail: { protocolVersion: '1.0', moduleId: 'experiencia-digital', capabilities: ['dashboard', 'tenant-coverage', 'drilldown'] } }))
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

if (!customElements.get('duma-experience-module')) customElements.define('duma-experience-module', DumaExperienceModule)
