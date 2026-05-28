import { createProcessCommentWorker } from '~~/server/workers/process-comment'

export default defineNitroPlugin(() => {
  createProcessCommentWorker()
})
