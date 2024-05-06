import { job } from './job'

const CONCURRENCY = 2 // Navegações concorrentes: precisa ser no máximo 2 na VM free-tier do GCP.

let activeJobs = 0

function manageJobs() {
  while (activeJobs < CONCURRENCY) {
    startNewJob()
  }
}

async function startNewJob() {
  activeJobs++
  process.stdout.write('.')
  await job(0, 0.25)
  activeJobs--
  manageJobs()
}

manageJobs()
