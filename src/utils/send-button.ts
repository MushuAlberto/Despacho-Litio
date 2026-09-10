// Web Component: <send-button autoreset="1800">
// Implements the origami paper plane folding and launch animation
// based on CSS polygon facets and custom property interpolation.

export class SendButtonElement extends HTMLElement {
  private autoresetDelay: number = 1800;
  private isAnimating: boolean = false;
  private resetButtonTimer: ReturnType<typeof setTimeout> | null = null;

  static get observedAttributes() {
    return ['autoreset'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.autoresetDelay = parseInt(this.getAttribute('autoreset') || '1800', 10);
    this.render();
    this.addEventListener('click', this.handleClick.bind(this));
  }

  disconnectedCallback() {
    if (this.resetButtonTimer) {
      clearTimeout(this.resetButtonTimer);
    }
  }

  attributeChangedCallback(name: string, _oldVal: string, newVal: string) {
    if (name === 'autoreset' && newVal) {
      this.autoresetDelay = parseInt(newVal, 10) || 1800;
    }
  }

  private handleClick(e: MouseEvent) {
    if (this.isAnimating) {
      e.preventDefault();
      return;
    }
    this.triggerAnimation();
  }

  public triggerAnimation() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const btn = this.shadowRoot?.querySelector('.send-button');
    if (btn) {
      btn.classList.add('is-active');
    }

    if (this.resetButtonTimer) clearTimeout(this.resetButtonTimer);
    this.resetButtonTimer = setTimeout(() => {
      this.reset();
    }, this.autoresetDelay);
  }

  public reset() {
    this.isAnimating = false;
    const btn = this.shadowRoot?.querySelector('.send-button');
    if (btn) {
      btn.classList.remove('is-active');
    }
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        @property --sb-corner-l-x { syntax: '<percentage>'; inherits: true; initial-value: 0%; }
        @property --sb-corner-r-x { syntax: '<percentage>'; inherits: true; initial-value: 100%; }
        @property --sb-wing-l-x { syntax: '<percentage>'; inherits: true; initial-value: 0%; }
        @property --sb-wing-r-x { syntax: '<percentage>'; inherits: true; initial-value: 100%; }
        @property --sb-notch-y { syntax: '<percentage>'; inherits: true; initial-value: 100%; }
        @property --sb-nose-y { syntax: '<percentage>'; inherits: true; initial-value: 0%; }
        @property --sb-wing-y { syntax: '<percentage>'; inherits: true; initial-value: 100%; }

        :host {
          display: block;
          width: 100%;
        }

        .send-button {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 16px;
          background: #ffffff;
          border: 2px solid #7177EC;
          color: #7177EC;
          border-radius: 16px;
          font-family: inherit;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .send-button:hover {
          background: rgba(113, 119, 236, 0.05);
          border-color: rgba(113, 119, 236, 0.7);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(113, 119, 236, 0.15);
        }

        .send-button:active {
          transform: translateY(0.5px);
        }

        /* Plane container */
        .plane-box {
          position: relative;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: center center;
        }

        .plane-sheet {
          position: absolute;
          inset: 0;
          display: flex;
          transform-origin: center center;
        }

        /* Facets from send-button.js */
        .facet {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .facet--left {
          background: linear-gradient(135deg, #7177EC, #5459dc);
          clip-path: polygon(
            var(--sb-corner-l-x, 0%) var(--sb-nose-y, 0%),
            50% var(--sb-nose-y, 0%),
            50% var(--sb-notch-y, 100%),
            var(--sb-wing-l-x, 0%) var(--sb-wing-y, 100%)
          );
        }

        .facet--right {
          background: linear-gradient(135deg, #9196f7, #7177EC);
          clip-path: polygon(
            50% var(--sb-nose-y, 0%),
            var(--sb-corner-r-x, 100%) var(--sb-nose-y, 0%),
            var(--sb-wing-r-x, 100%) var(--sb-wing-y, 100%),
            50% var(--sb-notch-y, 100%)
          );
        }

        /* Fold Animation */
        @keyframes sb-fold {
          0% {
            --sb-corner-l-x: 0%;
            --sb-corner-r-x: 100%;
            --sb-wing-l-x: 0%;
            --sb-wing-r-x: 100%;
            --sb-notch-y: 100%;
            --sb-nose-y: 0%;
            --sb-wing-y: 100%;
            rotate: 0deg;
          }
          /* corners to the top centre */
          45% {
            --sb-corner-l-x: 50%;
            --sb-corner-r-x: 50%;
            --sb-wing-l-x: 0%;
            --sb-wing-r-x: 100%;
            --sb-notch-y: 100%;
          }
          /* wings in, notch up, crease */
          78% {
            --sb-wing-l-x: 12%;
            --sb-wing-r-x: 88%;
            --sb-notch-y: 61%;
            rotate: 0deg;
          }
          /* and tip into the wind */
          100% {
            --sb-wing-l-x: 12%;
            --sb-wing-r-x: 88%;
            --sb-notch-y: 61%;
            rotate: 55deg;
          }
        }

        /* Fallback keyframes using direct polygon interpolation */
        @keyframes sb-fold-left-direct {
          0% { clip-path: polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%); }
          45% { clip-path: polygon(50% 0%, 50% 0%, 50% 100%, 0% 100%); }
          78% { clip-path: polygon(50% 0%, 50% 0%, 50% 61%, 12% 100%); }
          100% { clip-path: polygon(50% 0%, 50% 0%, 50% 61%, 12% 100%); }
        }

        @keyframes sb-fold-right-direct {
          0% { clip-path: polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%); }
          45% { clip-path: polygon(50% 0%, 50% 0%, 100% 100%, 50% 100%); }
          78% { clip-path: polygon(50% 0%, 50% 0%, 88% 100%, 50% 61%); }
          100% { clip-path: polygon(50% 0%, 50% 0%, 88% 100%, 50% 61%); }
        }

        @keyframes sb-takeoff {
          0% {
            transform: translate(0, 0) rotate(55deg) scale(1);
            opacity: 1;
          }
          30% {
            transform: translate(25px, -8px) rotate(45deg) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translate(180px, -45px) rotate(55deg) scale(0.35);
            opacity: 0;
          }
        }

        .is-active .plane-sheet {
          animation: sb-fold 0.65s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .is-active .facet--left {
          animation: sb-fold-left-direct 0.65s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .is-active .facet--right {
          animation: sb-fold-right-direct 0.65s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .is-active .plane-box {
          animation: sb-takeoff 0.6s 0.65s cubic-bezier(0.1, 0.7, 0.1, 1) forwards;
        }

        /* Default mail icon transitions out when folding begins */
        .default-icon {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .is-active .default-icon {
          opacity: 0;
          transform: scale(0.5);
        }

        .plane-sheet {
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .is-active .plane-sheet {
          opacity: 1;
        }

        /* Text transition */
        .button-text {
          position: relative;
          z-index: 1;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .is-active .button-text {
          opacity: 0.85;
          letter-spacing: 0.2em;
        }
      </style>
      <button class="send-button" type="button">
        <div class="plane-box">
          <svg class="default-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          <div class="plane-sheet">
            <div class="facet facet--left"></div>
            <div class="facet facet--right"></div>
          </div>
        </div>
        <span class="button-text">
          <slot>Compartir por Outlook</slot>
        </span>
      </button>
    `;
  }
}

// Register custom element if not already registered
if (typeof window !== 'undefined' && !customElements.get('send-button')) {
  customElements.define('send-button', SendButtonElement);
}
