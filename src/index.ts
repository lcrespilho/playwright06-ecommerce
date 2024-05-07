import { job } from './job'

const CONCURRENCY = 2 // free-tier GCP supports a maximum of 2 instances

let activeJobs = 0

function manageJobs() {
  while (activeJobs < CONCURRENCY) {
    startNewJob()
  }
}

async function startNewJob() {
  activeJobs++
  // process.stdout.write('.') // work indicator
  await job(0, 0.25)
  activeJobs--
  manageJobs()
}

manageJobs()
