import { fromWebHandler } from 'h3'

export default defineEventHandler(fromWebHandler(request => useAuth().handler(request)))
