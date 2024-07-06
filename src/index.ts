import { job } from './job'

// free-tier GCP supports a maximum of 2 instances
// GCP e2-medium with 2 vCPUs and 4GB-RAM supports ~8a instances (maximum)
const CONCURRENCY = 6
export const USERBASE = 20000 // number of users
export const CHURNPROBABILITY = 0.05 // Small chance of churning the user
export const NAVIGATIONSKIPTHRESHOLD = 0.25 // Chance to drop navigation between steps

let activeJobs = 0
async function startNewJob() {
  activeJobs++
  // process.stdout.write('.') // work indicator
  await job()
  activeJobs--
}

setInterval(() => {
  while (activeJobs < CONCURRENCY) {
    startNewJob()
  }
}, 1000)
