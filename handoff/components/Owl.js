// Vanilla Owl controller.
// Usage:
//   <div class="owl" data-state="idle">
//     <img class="owl-frame" data-frame="idle"     src="/assets/owl/owl-idle.png" alt="">
//     <img class="owl-frame" data-frame="alert"    src="/assets/owl/owl-alert.png" alt="">
//     ... etc for thinking/greeting/error
//   </div>
//   <div class="owl-bubble-wrap"><div class="owl-bubble"><span></span></div></div>
//
//   const owl = new Owl({ el: document.querySelector('.owl'), bubbleEl: document.querySelector('.owl-bubble') });
//   owl.setState('thinking', { message: 'Секунду…' });

export const OWL_MESSAGES = {
  idle:     '',
  alert:    'Новий запис у Inbox — глянемо?',
  thinking: 'Секунду, обдумую…',
  greeting: 'Привіт! Радий тебе бачити',
  error:    'Ой… щось пішло не так.',
};

export class Owl {
  constructor({ el, bubbleEl }) {
    this.el = el;
    this.bubbleEl = bubbleEl || null;
    this.bubbleText = bubbleEl ? bubbleEl.querySelector('span') : null;
    this.setState('idle');
  }
  setState(state, { message } = {}) {
    if (!['idle','alert','thinking','greeting','error'].includes(state)) return;
    this.el.setAttribute('data-state', state);

    if (!this.bubbleEl) return;
    if (state === 'idle') {
      this.bubbleEl.setAttribute('data-show', 'false');
    } else {
      const text = message ?? OWL_MESSAGES[state] ?? '';
      if (this.bubbleText) this.bubbleText.textContent = text;
      // retrigger transition
      this.bubbleEl.setAttribute('data-show', 'false');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.bubbleEl.setAttribute('data-show', 'true'));
      });
    }
  }
}
