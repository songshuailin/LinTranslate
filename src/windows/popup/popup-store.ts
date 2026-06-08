import { reactive } from 'vue'
import type { TranslationPopup, TranslationStatus } from '../../services/translator/translator-types'

const popupStore = reactive({
  popups: [] as TranslationPopup[],
  activePopupId: null as string | null,

  createPopup(payload: Partial<TranslationPopup>): string {
    const popup: TranslationPopup = {
      id: crypto.randomUUID(),
      mode: 'selection',
      translatedText: '',
      targetLanguage: '中文',
      status: 'idle' as TranslationStatus,
      position: { x: 0, y: 0 },
      createdAt: Date.now(),
      ...payload,
    } as TranslationPopup
    this.popups.push(popup)
    return popup.id
  },

  appendDelta(id: string, delta: string): void {
    const popup = this.popups.find(p => p.id === id)
    if (popup) {
      popup.translatedText += delta
    }
  },

  setStatus(id: string, status: TranslationStatus): void {
    const popup = this.popups.find(p => p.id === id)
    if (popup) popup.status = status
  },

  setError(id: string, message: string): void {
    const popup = this.popups.find(p => p.id === id)
    if (popup) {
      popup.status = 'error'
      popup.errorMessage = message
    }
  },

  closePopup(id: string): void {
    const idx = this.popups.findIndex(p => p.id === id)
    if (idx !== -1) this.popups.splice(idx, 1)
  },

  setActivePopup(id: string): void {
    this.activePopupId = id
  },
})

export function usePopupStore() {
  return popupStore
}
