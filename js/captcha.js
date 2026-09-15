// 100201 Football Shop - Human Verification & Anti-Bot CAPTCHA
// Embedded Canvas-based verification challenge requiring zero external dependencies

export class FootballCaptcha {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    this.onSuccess = options.onSuccess || null;
    this.currentCode = '';
    this.isVerified = false;
    this.id = `captcha-${Math.random().toString(36).substr(2, 9)}`;
    if (this.container) {
      this.render();
    }
  }

  generateCode() {
    // Generate a simple football-themed 4-character alphanumeric challenge
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  drawCanvas(code) {
    const canvas = document.getElementById(`${this.id}-canvas`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas dimensions
    const w = canvas.width;
    const h = canvas.height;

    // Dark sleek terrace background
    ctx.fillStyle = '#0E0E12';
    ctx.fillRect(0, 0, w, h);

    // Subtle interference grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let j = 0; j < h; j += 16) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(w, j);
      ctx.stroke();
    }

    // Interference curve lines
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(118, 34, 11, 0.6)' : 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.bezierCurveTo(
        Math.random() * w, Math.random() * h,
        Math.random() * w, Math.random() * h,
        Math.random() * w, Math.random() * h
      );
      ctx.stroke();
    }

    // Draw characters with randomized rotation and position
    ctx.font = 'bold 22px "Space Grotesk", sans-serif';
    ctx.textBaseline = 'middle';

    const charWidth = w / 5;
    for (let i = 0; i < code.length; i++) {
      ctx.save();
      const x = (i + 0.8) * charWidth;
      const y = h / 2 + (Math.random() * 6 - 3);
      const angle = (Math.random() * 30 - 15) * (Math.PI / 180);

      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#E4E4E7';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }

    // Noise dots
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  refresh() {
    this.currentCode = this.generateCode();
    this.isVerified = false;
    this.drawCanvas(this.currentCode);
    const input = document.getElementById(`${this.id}-input`);
    const status = document.getElementById(`${this.id}-status`);
    if (input) {
      input.value = '';
      input.classList.remove('valid', 'invalid');
    }
    if (status) {
      status.textContent = 'Enter the 4 characters above to verify';
      status.className = 'captcha-status-hint';
    }
  }

  validate() {
    if (this.isVerified) return true;
    const input = document.getElementById(`${this.id}-input`);
    const status = document.getElementById(`${this.id}-status`);
    if (!input) return false;

    const val = input.value.trim().toUpperCase();
    if (val === this.currentCode) {
      this.isVerified = true;
      input.classList.remove('invalid');
      input.classList.add('valid');
      if (status) {
        status.textContent = '✓ Verified Human';
        status.className = 'captcha-status-hint success';
      }
      if (typeof this.onSuccess === 'function') {
        this.onSuccess();
      }
      return true;
    } else {
      this.isVerified = false;
      input.classList.remove('valid');
      input.classList.add('invalid');
      if (status) {
        status.textContent = 'Incorrect code. Try again or refresh.';
        status.className = 'captcha-status-hint error';
      }
      return false;
    }
  }

  render() {
    if (!this.container) return;
    this.currentCode = this.generateCode();
    this.container.innerHTML = `
      <div class="football-captcha-card">
        <div class="captcha-header-row">
          <span class="captcha-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Security Verification
          </span>
          <button type="button" id="${this.id}-refresh-btn" class="captcha-refresh-btn" title="Get a new challenge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Refresh
          </button>
        </div>
        <div class="captcha-challenge-row">
          <canvas id="${this.id}-canvas" width="160" height="46" class="captcha-canvas" aria-label="Security challenge text"></canvas>
          <input type="text" id="${this.id}-input" class="captcha-input" maxlength="4" placeholder="Code" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false">
        </div>
        <div id="${this.id}-status" class="captcha-status-hint">Enter the 4 characters above</div>
      </div>
    `;

    setTimeout(() => {
      this.drawCanvas(this.currentCode);

      const refreshBtn = document.getElementById(`${this.id}-refresh-btn`);
      const input = document.getElementById(`${this.id}-input`);

      if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.refresh();
        });
      }

      if (input) {
        input.addEventListener('input', () => {
          if (input.value.trim().length === 4) {
            this.validate();
          }
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.validate();
          }
        });
      }
    }, 10);
  }
}
