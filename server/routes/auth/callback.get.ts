import { useDB } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  const auth = useAuth()
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session)
    return sendRedirect(event, '/login')
  const user = await useDB().query.users.findFirst({ where: (u, { eq }) => eq(u.id, session.user.id) })
  if (user?.username && user?.useCase)
    return sendRedirect(event, '/app')
  return sendRedirect(event, '/onboarding')
})
