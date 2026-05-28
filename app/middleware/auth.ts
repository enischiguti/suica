export default defineNuxtRouteMiddleware(() => {
  const sessionState = authClient.useSession()
  if (!sessionState.value.data)
    return navigateTo('/login')
})
