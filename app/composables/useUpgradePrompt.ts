interface UpgradePromptState {
  open: boolean
  message: string
}

export function useUpgradePrompt() {
  const state = useState<UpgradePromptState>('upgradePrompt', () => ({
    open: false,
    message: '',
  }))

  function showUpgradePrompt(message: string = 'You\'ve reached your plan limit.') {
    state.value = { open: true, message }
  }

  function closeUpgradePrompt() {
    state.value = { open: false, message: '' }
  }

  return {
    state: readonly(state),
    showUpgradePrompt,
    closeUpgradePrompt,
  }
}
