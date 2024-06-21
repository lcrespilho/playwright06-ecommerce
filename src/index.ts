import { job } from './job'

// free-tier GCP supports a maximum of 2 instances
// GCP e2-medium with 2 vCPUs and 4GB-RAM supports 8~10 instances (maximum)
const CONCURRENCY = 6

let activeJobs = 0

async function startNewJob() {
  activeJobs++
  // process.stdout.write('.') // work indicator
  await job(0, 0.25)
  activeJobs--
}

setInterval(() => {
  while (activeJobs < CONCURRENCY) {
    startNewJob()
  }
}, 1000)
